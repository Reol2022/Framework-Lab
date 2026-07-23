import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { parseErrorContexts, parseHistoricalRunErrors } from "../cli/lib/errors.js";
import { normalizeEventPath, normalizeLog } from "../cli/lib/error-normalize.js";
import { generateReport } from "../cli/lib/report.js";
import { validateWithSchema } from "../cli/lib/schema.js";
import type {
  BaselineRunRecord,
  EnvironmentRecord,
  ErrorParseContext,
  SourceRecord,
  StepRecord,
} from "../cli/lib/types.js";

const repositoryRoot = path.resolve(import.meta.dirname, "..");

function context(values: Partial<ErrorParseContext> = {}): ErrorParseContext {
  return {
    runId: "run-101",
    frameworkId: "demo",
    stepId: "build",
    command: "pnpm.cmd",
    exitCode: 1,
    status: "failed",
    allowFailure: false,
    stdout: "",
    stderr: "",
    stdoutLogPath: "steps/build.stdout.log",
    stderrLogPath: "steps/build.stderr.log",
    cwd: "C:\\lab\\source",
    sourceRoot: "C:\\lab\\source",
    labRoot: "C:\\lab",
    ...values,
  };
}

function parseOne(values: Partial<ErrorParseContext>, status: BaselineRunRecord["status"] = "failed") {
  return parseErrorContexts("run-101", "demo", status, [context(values)], "2026-01-01T00:00:00.000Z");
}

test("解析 Sass import failure 及 vite:css plugin", () => {
  const result = parseOne({
    stderr: `[vite:css] [sass] Error: Can't find stylesheet to import.\r\nfile: C:/lab/source/button/style.scss?inline\r\nC:/lab/source/button/style.scss 1:1 root stylesheet`,
  });
  const event = result.events.find((item) => item.tool === "sass");
  assert.equal(event?.message, "Can't find stylesheet to import.");
  assert.equal(event?.file, "button/style.scss");
  assert.equal(event?.line, 1);
  assert.equal(event?.plugin, "vite:css");
});

test("解析 ESLint 多文件 error 和 warning", () => {
  const result = parseOne({
    stepId: "lint",
    allowFailure: true,
    stdout: `C:\\lab\\source\\a.ts\r\n  1:2  error  Unexpected any  @typescript-eslint/no-explicit-any\r\n\r\nC:\\lab\\source\\b.ts\r\n  3:4  warning  Use const  prefer-const\r\n  5:1  warning  Unused eslint-disable directive (no problems were reported)\r\n`,
  }, "partial");
  assert.equal(result.events.filter((event) => event.tool === "eslint").length, 3);
  assert.deepEqual(result.events.filter((event) => event.tool === "eslint").map((event) => event.file), ["a.ts", "b.ts", "b.ts"]);
  assert.equal(result.summary.warnings, 2);
});

test("解析 TypeScript 括号位置格式", () => {
  const result = parseOne({ stderr: "C:/lab/source/a.ts(4,9): error TS2322: Type string is not assignable" });
  const event = result.events.find((item) => item.tool === "typescript");
  assert.deepEqual([event?.file, event?.line, event?.column, event?.code], ["a.ts", 4, 9, "TS2322"]);
});

test("解析 TypeScript 冒号位置格式", () => {
  const result = parseOne({ stderr: "C:/lab/source/b.ts:7:3 - error TS2304: Cannot find name x" });
  const event = result.events.find((item) => item.tool === "typescript");
  assert.deepEqual([event?.file, event?.line, event?.column, event?.code], ["b.ts", 7, 3, "TS2304"]);
});

test("解析 Vite failed resolve import", () => {
  const result = parseOne({
    stderr: `[plugin:vite:import-analysis] Failed to resolve import "@ncom/all/theme/deepblue" from "C:/lab/source/index.html". Does the file exist?`,
  });
  const event = result.events.find((item) => item.tool === "vite");
  assert.equal(event?.category, "module-resolution");
  assert.equal(event?.plugin, "vite:import-analysis");
  assert.match(event?.message ?? "", /@ncom\/all\/theme\/deepblue/u);
});

test("解析 Rollup module resolution failure", () => {
  const result = parseOne({
    stderr: `RollupError: Could not resolve "./missing.js" from "C:/lab/source/src/index.ts"`,
  });
  const event = result.events.find((item) => item.tool === "vite");
  assert.deepEqual([event?.category, event?.plugin, event?.file], ["module-resolution", "rollup", "src/index.ts"]);
});

test("解析 Node MODULE_NOT_FOUND 和首个用户 stack frame", () => {
  const result = parseOne({
    stderr: `Error: Cannot find module 'missing-package'\n    at load (C:/lab/source/src/app.js:12:5)\n    at Module._load (node:internal/modules/cjs/loader:1:1)\n  code: 'MODULE_NOT_FOUND'`,
  });
  const event = result.events.find((item) => item.tool === "node");
  assert.deepEqual([event?.code, event?.file, event?.line, event?.column], ["MODULE_NOT_FOUND", "src/app.js", 12, 5]);
});

test("解析 pnpm lifecycle 包装错误", () => {
  const result = parseOne({ stderr: "ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL package build failed\nELIFECYCLE Command failed with exit code 1." });
  const events = result.events.filter((event) => event.tool === "pnpm");
  assert.equal(events.length, 2);
  assert.deepEqual(events.map((event) => event.code).sort(), ["ELIFECYCLE", "ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL"]);
});

test("专属解析器无结果时生成单一 generic fallback", () => {
  const result = parseOne({ stderr: "opaque command failure" });
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0]?.tool, "generic");
  assert.equal(result.summary.unrecognized, 1);
});

test("ANSI 与 CRLF 被规范化且重复空行被压缩", () => {
  assert.equal(normalizeLog("\u001b[31merror\u001b[0m\r\n\r\n\r\nnext  \r"), "error\n\nnext\n");
});

test("Windows source root 路径转换为 source 相对路径", () => {
  assert.equal(normalizeEventPath("C:\\lab\\source\\src\\a.ts", "C:\\lab\\source", "C:\\lab"), "src/a.ts");
});

test("Framework Lab 根目录路径转换为仓库相对路径", () => {
  assert.equal(normalizeEventPath("C:\\lab\\fixtures\\a.ts", "C:\\other", "C:\\lab"), "fixtures/a.ts");
});

test("source root 外路径被脱敏", () => {
  assert.equal(normalizeEventPath("D:\\private\\alice\\secret.ts", "C:\\lab\\source", "C:\\lab"), "<external>/secret.ts");
});

test("相同输入 fingerprint 稳定", () => {
  const first = parseOne({ stderr: "C:/lab/source/a.ts(4,9): error TS2322: bad type" });
  const second = parseOne({ stderr: "C:\\lab\\source\\a.ts(4,9): error TS2322: bad type\r\n" });
  assert.equal(first.events[0]?.fingerprint, second.events[0]?.fingerprint);
});

test("完全相同具体错误去重", () => {
  const line = "C:/lab/source/a.ts(4,9): error TS2322: bad type";
  const result = parseOne({ stdout: line, stderr: line });
  assert.equal(result.events.filter((event) => event.tool === "typescript").length, 1);
});

test("不同文件同类错误不合并", () => {
  const result = parseOne({
    stderr: "C:/lab/source/a.ts(1,1): error TS2322: bad type\nC:/lab/source/b.ts(1,1): error TS2322: bad type",
  });
  assert.equal(result.events.filter((event) => event.tool === "typescript").length, 2);
});

test("具体 Sass 错误优先于 lifecycle 成为 firstBlockingError", () => {
  const result = parseOne({
    stderr: `[vite:css] [sass] Error: Can't find stylesheet to import.\nC:/lab/source/a.scss 1:1 root stylesheet\nELIFECYCLE Command failed with exit code 1.`,
  });
  const first = result.events.find((event) => event.id === result.firstBlockingErrorId);
  assert.equal(first?.tool, "sass");
});

test("required failed 步骤选择全局阻塞错误", () => {
  const result = parseOne({ stderr: "C:/lab/source/a.ts(1,1): error TS2322: bad type" });
  assert.ok(result.firstBlockingErrorId);
  assert.equal(result.events[0]?.blocking, true);
});

test("allow_failure partial run 不设置全局阻塞错误", () => {
  const result = parseOne({
    stepId: "lint",
    allowFailure: true,
    stdout: "C:/lab/source/a.ts\n  1:1  error  bad type  rule/name",
  }, "partial");
  assert.equal(result.firstBlockingErrorId, null);
  assert.equal(result.events[0]?.blocking, false);
});

test("passed 步骤中的 error 文本不标为 blocking", () => {
  const result = parseOne({ status: "passed", exitCode: 0, stderr: "error text in successful output" }, "passed");
  assert.ok(result.events.every((event) => !event.blocking));
  assert.equal(result.firstBlockingErrorId, null);
});

test("空日志生成合法空 errors 文档", () => {
  const result = parseOne({ status: "passed", exitCode: 0 }, "passed");
  assert.deepEqual(result.summary, {
    total: 0, errors: 0, warnings: 0, recognized: 0, unrecognized: 0, byTool: {}, byCategory: {},
  });
  assert.deepEqual(result.events, []);
});

test("rawExcerpt 不超过 1200 字符", () => {
  const result = parseOne({ stderr: `opaque failure ${"x".repeat(2000)}` });
  assert.ok((result.events[0]?.rawExcerpt.length ?? 0) <= 1200);
});

test("errors.json 通过 Schema", async () => {
  const result = parseOne({ stderr: "C:/lab/source/a.ts(1,1): error TS2322: bad type" });
  await validateWithSchema(repositoryRoot, "error-events.schema.json", result);
});

function historyRun(): BaselineRunRecord {
  const step: StepRecord = {
    id: "build",
    command: "node",
    args: [],
    cwd: "source",
    startedAt: "2026-01-01T00:00:00.000Z",
    finishedAt: "2026-01-01T00:00:01.000Z",
    durationMs: 1000,
    exitCode: 1,
    status: "failed",
    stdoutLog: "steps/build.stdout.log",
    stderrLog: "steps/build.stderr.log",
    allowFailure: false,
    timeoutSeconds: 10,
  };
  return {
    schemaVersion: "1.0.0",
    runId: "run-101",
    framework: { id: "demo", name: "Demo" },
    status: "failed",
    startedAt: "2026-01-01T00:00:00.000Z",
    finishedAt: "2026-01-01T00:00:01.000Z",
    totalDurationMs: 1000,
    environmentFile: "environment.json",
    sourceFile: "source.json",
    reportFile: "report.md",
    steps: [step],
    firstBlockingStep: "build",
    warnings: [],
  };
}

async function historyFixture(includeStderr = true): Promise<string> {
  const labRoot = await mkdtemp(path.join(os.tmpdir(), "framework-lab-history-"));
  const runDir = path.join(labRoot, "frameworks", "demo", "runs", "run-101");
  await mkdir(path.join(runDir, "steps"), { recursive: true });
  await mkdir(path.join(labRoot, "schemas"), { recursive: true });
  await Promise.all([
    cp(path.join(repositoryRoot, "schemas", "baseline-run.schema.json"), path.join(labRoot, "schemas", "baseline-run.schema.json")),
    cp(path.join(repositoryRoot, "schemas", "error-events.schema.json"), path.join(labRoot, "schemas", "error-events.schema.json")),
    writeFile(path.join(runDir, "run.json"), `${JSON.stringify(historyRun(), null, 2)}\n`),
    writeFile(path.join(runDir, "source.json"), `${JSON.stringify({
      frameworkId: "demo", sourceDir: "source", commit: "abc", dirty: false, changedFiles: [], warnings: [],
    }, null, 2)}\n`),
    writeFile(path.join(runDir, "steps", "build.stdout.log"), ""),
    ...(includeStderr ? [writeFile(path.join(runDir, "steps", "build.stderr.log"), "opaque failure\n")] : []),
  ]);
  return labRoot;
}

test("历史 parse 默认不覆盖已有 errors.json", async () => {
  const labRoot = await historyFixture();
  const file = path.join(labRoot, "frameworks", "demo", "runs", "run-101", "errors.json");
  await writeFile(file, "sentinel\n");
  await assert.rejects(
    () => parseHistoricalRunErrors({ labRoot, frameworkId: "demo", runId: "run-101", force: false }),
    /--force/u,
  );
  assert.equal(await readFile(file, "utf8"), "sentinel\n");
});

test("--force 显式覆盖历史 errors.json", async () => {
  const labRoot = await historyFixture();
  const file = path.join(labRoot, "frameworks", "demo", "runs", "run-101", "errors.json");
  await writeFile(file, "sentinel\n");
  const result = await parseHistoricalRunErrors({ labRoot, frameworkId: "demo", runId: "run-101", force: true });
  assert.equal(result.errors.summary.total, 1);
  assert.notEqual(await readFile(file, "utf8"), "sentinel\n");
});

test("历史 parse 缺失日志返回清晰错误", async () => {
  const labRoot = await historyFixture(false);
  await assert.rejects(
    () => parseHistoricalRunErrors({ labRoot, frameworkId: "demo", runId: "run-101", force: false }),
    /缺少步骤日志/u,
  );
});

test("旧 Run 在新增 optional 字段后仍通过 Schema", async () => {
  await validateWithSchema(repositoryRoot, "baseline-run.schema.json", historyRun());
});

test("报告最多显示五个代表事件且引用 errors.json", () => {
  const errors = parseErrorContexts("run-101", "demo", "failed", [
    context({ stderr: Array.from({ length: 7 }, (_, index) => `C:/lab/source/f${index}.ts(1,1): error TS2322: bad ${index}`).join("\n") }),
  ]);
  const environment: EnvironmentRecord = {
    capturedAt: "2026-01-01T00:00:00.000Z",
    os: { platform: "win32", release: "fixture", arch: "x64" },
    nodeVersion: "v24", npmVersion: "11",
    packageManager: { name: "pnpm", configuredVersion: "10", resolvedVersion: "10", executable: "pnpm.cmd" },
    frameworkLabCommit: "abc", warnings: [],
  };
  const source: SourceRecord = {
    frameworkId: "demo", sourceDir: "source", commit: "abc", dirty: false, changedFiles: [], warnings: [],
  };
  const report = generateReport(historyRun(), environment, source, errors);
  assert.match(report, /结构化错误摘要/u);
  assert.match(report, /errors\.json/u);
  assert.equal((report.match(/typescript\/typecheck/gmu) ?? []).length, 5);
  assert.doesNotMatch(report, /^## (?:根因分析|修复建议)$/gmu);
});
