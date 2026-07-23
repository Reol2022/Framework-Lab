import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadFrameworkConfig } from "./config.js";
import { collectEnvironment, collectSource } from "./environment.js";
import { generateErrorsForRun } from "./errors.js";
import { displayPath, portablePath, resolveFromLab } from "./paths.js";
import { createSkippedStep, runStep } from "./process.js";
import { generateReport } from "./report.js";
import { reserveRunDirectory } from "./run-id.js";
import { validateWithSchema } from "./schema.js";
import type {
  BaselineRunOptions,
  BaselineRunRecord,
  BaselineRunResult,
  RunStatus,
  StepRecord,
} from "./types.js";

async function writeJson(file: string, value: unknown): Promise<void> {
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
}

function resolvedCommand(labRoot: string, command: string): string {
  if (path.isAbsolute(command)) return path.normalize(command);
  if (command.includes("/") || command.includes("\\")) return path.resolve(labRoot, command);
  return command;
}

function calculateStatus(steps: StepRecord[]): RunStatus {
  const requiredFailure = steps.some(
    (step) => !step.allowFailure && (step.status === "failed" || step.status === "timed_out"),
  );
  if (requiredFailure) return "failed";
  const allowedFailure = steps.some(
    (step) => step.allowFailure && (step.status === "failed" || step.status === "timed_out"),
  );
  return allowedFailure ? "partial" : "passed";
}

export async function runBaseline(options: BaselineRunOptions): Promise<BaselineRunResult> {
  const config = await loadFrameworkConfig(options.labRoot, options.frameworkId);
  const frameworkDir = path.resolve(options.labRoot, "frameworks", options.frameworkId);
  const sourceDirectory = options.sourceDir
    ? resolveFromLab(options.labRoot, options.sourceDir)
    : resolveFromLab(options.labRoot, config.framework.source_dir);
  await access(sourceDirectory);

  const packageManagerExecutable = resolveFromLab(
    options.labRoot,
    config.package_manager.executable,
  );
  const { runId, runDir } = await reserveRunDirectory(frameworkDir, options.runId);
  const stepsDir = path.join(runDir, "steps");
  await mkdir(stepsDir);

  const startedAt = new Date();
  const startedNs = process.hrtime.bigint();
  console.log(`[${runId}] 采集环境与源码状态`);
  const sourceDisplay = displayPath(options.labRoot, sourceDirectory);
  const packageManagerDisplay = displayPath(options.labRoot, packageManagerExecutable);
  const [environment, source] = await Promise.all([
    collectEnvironment(
      options.labRoot,
      config,
      packageManagerExecutable,
      packageManagerDisplay,
    ),
    collectSource(options.frameworkId, sourceDirectory, sourceDisplay),
  ]);

  const warnings = [...environment.warnings, ...source.warnings];
  if (
    environment.packageManager.resolvedVersion !== null &&
    environment.packageManager.resolvedVersion !== config.package_manager.version
  ) {
    warnings.push(
      `${config.package_manager.name} 版本不一致：配置 ${config.package_manager.version}，实际 ${environment.packageManager.resolvedVersion}。`,
    );
  }

  const childPath = `${path.dirname(packageManagerExecutable)}${path.delimiter}${process.env.PATH ?? ""}`;
  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    PATH: childPath,
    FRAMEWORK_LAB_PNPM: packageManagerExecutable,
  };
  const steps: StepRecord[] = [];
  let blocked = false;

  for (const step of config.baseline_steps) {
    const stepCwd = path.resolve(sourceDirectory, step.cwd ?? ".");
    const displayCwd = displayPath(options.labRoot, stepCwd);
    const command = resolvedCommand(options.labRoot, step.command);
    const displayCommand = path.isAbsolute(step.command)
      ? portablePath(step.command)
      : portablePath(step.command);

    if (blocked) {
      console.log(`[${runId}] 跳过 ${step.id}`);
      steps.push(await createSkippedStep(step, displayCommand, displayCwd, stepsDir));
      continue;
    }

    const result = await runStep({
      step,
      resolvedCommand: command,
      displayCommand,
      cwd: stepCwd,
      displayCwd,
      stepsDir,
      env: childEnv,
      onProgress: (message) => console.log(`[${runId}] ${message}`),
    });
    steps.push(result);
    if (
      config.stop_on_failure &&
      !step.allow_failure &&
      (result.status === "failed" || result.status === "timed_out")
    ) {
      blocked = true;
    }
  }

  const finishedAt = new Date();
  const totalDurationMs = Number((process.hrtime.bigint() - startedNs) / 1_000_000n);
  const firstBlockingStep =
    steps.find(
      (step) =>
        !step.allowFailure && (step.status === "failed" || step.status === "timed_out"),
    )?.id ?? null;
  const run: BaselineRunRecord = {
    schemaVersion: "1.0.0",
    runId,
    framework: { id: config.framework.id, name: config.framework.name },
    status: calculateStatus(steps),
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    totalDurationMs,
    environmentFile: "environment.json",
    sourceFile: "source.json",
    reportFile: "report.md",
    steps,
    firstBlockingStep,
    warnings,
  };

  const errors = await generateErrorsForRun(options.labRoot, runDir, run, source);
  run.errorsFile = "errors.json";
  run.errorSummary = errors.summary;
  run.firstBlockingErrorId = errors.firstBlockingErrorId;
  await validateWithSchema(options.labRoot, "baseline-run.schema.json", run);
  await validateWithSchema(options.labRoot, "error-events.schema.json", errors);
  await Promise.all([
    writeJson(path.join(runDir, "run.json"), run),
    writeJson(path.join(runDir, "environment.json"), environment),
    writeJson(path.join(runDir, "source.json"), source),
    writeJson(path.join(runDir, "errors.json"), errors),
  ]);
  await writeFile(path.join(runDir, "report.md"), generateReport(run, environment, source, errors), {
    encoding: "utf8",
    flag: "wx",
  });

  console.log(`[${runId}] 最终状态: ${run.status}`);
  return { runDir, run, environment, source };
}
