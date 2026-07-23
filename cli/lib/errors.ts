import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  errorFingerprint,
  normalizeEventPath,
  normalizeMessage,
  sanitizeExcerpt,
} from "./error-normalize.js";
import { genericFallback, parserRegistry } from "./error-parsers.js";
import { normalizeRunId } from "./run-id.js";
import { validateWithSchema } from "./schema.js";
import type {
  BaselineRunRecord,
  ErrorEvent,
  ErrorEventsDocument,
  ErrorParseContext,
  ErrorSummary,
  ParsedErrorCandidate,
  SourceRecord,
} from "./types.js";

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function summarize(events: ErrorEvent[]): ErrorSummary {
  return {
    total: events.length,
    errors: events.filter((event) => event.severity === "error").length,
    warnings: events.filter((event) => event.severity === "warning").length,
    recognized: events.filter((event) => event.parser !== "generic").length,
    unrecognized: events.filter((event) => event.parser === "generic").length,
    byTool: countBy(events.map((event) => event.tool)),
    byCategory: countBy(events.map((event) => event.category)),
  };
}

function toEvent(
  candidate: ParsedErrorCandidate,
  context: ErrorParseContext,
  fingerprint: string,
): ErrorEvent {
  return {
    id: `error-${fingerprint.slice(0, 12)}`,
    parser: candidate.parser,
    parserVersion: candidate.parserVersion,
    tool: candidate.tool,
    category: candidate.category,
    severity: candidate.severity,
    stepId: context.stepId,
    message: normalizeMessage(candidate.message, context),
    file: normalizeEventPath(candidate.file, context.sourceRoot, context.labRoot),
    line: candidate.line,
    column: candidate.column,
    rule: candidate.rule,
    code: candidate.code,
    plugin: candidate.plugin,
    rawExcerpt: sanitizeExcerpt(candidate.rawExcerpt, context),
    sourceLog: candidate.sourceLog.replaceAll("\\", "/"),
    fingerprint,
    blocking:
      !context.allowFailure && (context.status === "failed" || context.status === "timed_out"),
    confidence: candidate.confidence,
  };
}

function selectFirstBlockingError(events: ErrorEvent[]): ErrorEvent | undefined {
  const confidence = { high: 3, medium: 2, low: 1 } as const;
  return events
    .filter((event) => event.blocking && event.severity === "error")
    .sort((left, right) => {
      const leftSpecific = left.tool === "pnpm" || left.tool === "generic" ? 0 : 10;
      const rightSpecific = right.tool === "pnpm" || right.tool === "generic" ? 0 : 10;
      const leftLocated = left.file || left.code || left.rule ? 2 : 0;
      const rightLocated = right.file || right.code || right.rule ? 2 : 0;
      return (rightSpecific + confidence[right.confidence] + rightLocated)
        - (leftSpecific + confidence[left.confidence] + leftLocated);
    })[0];
}

export function parseErrorContexts(
  runId: string,
  frameworkId: string,
  runStatus: BaselineRunRecord["status"],
  contexts: ErrorParseContext[],
  generatedAt = new Date().toISOString(),
): ErrorEventsDocument {
  const deduplicated = new Map<string, ErrorEvent>();
  for (const context of contexts) {
    let candidates: ParsedErrorCandidate[] = [];
    for (const parser of parserRegistry) {
      if (parser.supports(context)) candidates.push(...parser.parse(context));
    }
    if (candidates.length === 0) candidates = genericFallback(context);
    for (const candidate of candidates) {
      const fingerprint = errorFingerprint(candidate, context);
      if (!deduplicated.has(fingerprint)) {
        deduplicated.set(fingerprint, toEvent(candidate, context, fingerprint));
      }
    }
  }

  const events = [...deduplicated.values()];
  const ids = new Set(events.map((event) => event.id));
  if (ids.size !== events.length) throw new Error("结构化错误事件 id 发生冲突。");

  return {
    schemaVersion: "1.0.0",
    runId,
    frameworkId,
    generatedAt,
    summary: summarize(events),
    firstBlockingErrorId:
      runStatus === "failed" ? selectFirstBlockingError(events)?.id ?? null : null,
    events,
  };
}

export async function generateErrorsForRun(
  labRoot: string,
  runDir: string,
  run: BaselineRunRecord,
  source: SourceRecord,
): Promise<ErrorEventsDocument> {
  const sourceRoot = path.resolve(labRoot, source.sourceDir);
  const contexts: ErrorParseContext[] = [];
  for (const step of run.steps) {
    let stdout: string;
    let stderr: string;
    try {
      [stdout, stderr] = await Promise.all([
        readFile(path.resolve(runDir, step.stdoutLog), "utf8"),
        readFile(path.resolve(runDir, step.stderrLog), "utf8"),
      ]);
    } catch (error) {
      const missing = (error as NodeJS.ErrnoException).path ?? "unknown";
      throw new Error(`缺少步骤日志：${missing}`);
    }
    contexts.push({
      runId: run.runId,
      frameworkId: run.framework.id,
      stepId: step.id,
      command: step.command,
      exitCode: step.exitCode,
      status: step.status,
      allowFailure: step.allowFailure,
      stdout,
      stderr,
      stdoutLogPath: step.stdoutLog,
      stderrLogPath: step.stderrLog,
      cwd: path.resolve(labRoot, step.cwd),
      sourceRoot,
      labRoot,
    });
  }
  return parseErrorContexts(run.runId, run.framework.id, run.status, contexts);
}

export async function parseHistoricalRunErrors(options: {
  labRoot: string;
  frameworkId: string;
  runId: string;
  force: boolean;
}): Promise<{ runDir: string; errors: ErrorEventsDocument }> {
  const runId = normalizeRunId(options.runId);
  const runDir = path.resolve(options.labRoot, "frameworks", options.frameworkId, "runs", runId);
  const errorsPath = path.join(runDir, "errors.json");
  if (!options.force) {
    try {
      await access(errorsPath);
      throw new Error(`${runId} 已存在 errors.json；使用 --force 显式覆盖。`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  let run: BaselineRunRecord;
  let source: SourceRecord;
  try {
    [run, source] = await Promise.all([
      readFile(path.join(runDir, "run.json"), "utf8").then(
        (value) => JSON.parse(value) as BaselineRunRecord,
      ),
      readFile(path.join(runDir, "source.json"), "utf8").then(
        (value) => JSON.parse(value) as SourceRecord,
      ),
    ]);
  } catch (error) {
    throw new Error(`无法读取 ${options.frameworkId}/${runId}：${(error as Error).message}`);
  }
  if (run.runId !== runId || run.framework.id !== options.frameworkId) {
    throw new Error(`${options.frameworkId}/${runId} 的 run.json 标识不一致。`);
  }
  await validateWithSchema(options.labRoot, "baseline-run.schema.json", run);
  const errors = await generateErrorsForRun(options.labRoot, runDir, run, source);
  await validateWithSchema(options.labRoot, "error-events.schema.json", errors);
  await writeFile(errorsPath, `${JSON.stringify(errors, null, 2)}\n`, {
    encoding: "utf8",
    flag: options.force ? "w" : "wx",
  });
  return { runDir, errors };
}
