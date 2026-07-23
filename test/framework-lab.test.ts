import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { stringify } from "yaml";
import { runBaseline } from "../cli/lib/baseline.js";
import { loadFrameworkConfig } from "../cli/lib/config.js";
import { collectGitSnapshot } from "../cli/lib/git.js";
import { buildSpawnSpec, spawnCollect } from "../cli/lib/process.js";
import { generateReport } from "../cli/lib/report.js";
import { previewNextRunId, reserveRunDirectory } from "../cli/lib/run-id.js";
import type {
  BaselineRunRecord,
  EnvironmentRecord,
  FrameworkStepConfig,
  SourceRecord,
} from "../cli/lib/types.js";

const repositoryRoot = path.resolve(import.meta.dirname, "..");

async function temporaryDirectory(name: string): Promise<string> {
  return await mkdtemp(path.join(os.tmpdir(), `framework-lab-${name}-`));
}

function nodeStep(
  id: string,
  script: string,
  allowFailure = false,
  timeoutSeconds = 5,
): FrameworkStepConfig {
  return {
    id,
    command: process.execPath,
    args: ["-e", script],
    timeout_seconds: timeoutSeconds,
    allow_failure: allowFailure,
  };
}

async function createLab(
  name: string,
  steps: FrameworkStepConfig[],
  stopOnFailure = true,
): Promise<{ labRoot: string; sourceDir: string }> {
  const labRoot = await temporaryDirectory(name);
  const sourceDir = path.join(labRoot, "fixtures", "source with spaces", "中文");
  await Promise.all([
    mkdir(path.join(labRoot, "schemas"), { recursive: true }),
    mkdir(path.join(labRoot, "frameworks", "demo"), { recursive: true }),
    mkdir(sourceDir, { recursive: true }),
  ]);
  await Promise.all([
    cp(
      path.join(repositoryRoot, "schemas", "framework-config.schema.json"),
      path.join(labRoot, "schemas", "framework-config.schema.json"),
    ),
    cp(
      path.join(repositoryRoot, "schemas", "baseline-run.schema.json"),
      path.join(labRoot, "schemas", "baseline-run.schema.json"),
    ),
    cp(
      path.join(repositoryRoot, "schemas", "error-events.schema.json"),
      path.join(labRoot, "schemas", "error-events.schema.json"),
    ),
    writeFile(
      path.join(labRoot, "package.json"),
      `${JSON.stringify({ name: "framework-lab-workflow" })}\n`,
      "utf8",
    ),
  ]);

  const config = {
    schema_version: "1.0.0",
    framework: {
      id: "demo",
      name: "Demo Framework",
      source_dir: path.relative(labRoot, sourceDir),
    },
    package_manager: {
      name: "node",
      version: process.version,
      executable: process.execPath,
    },
    stop_on_failure: stopOnFailure,
    baseline_steps: steps,
  };
  await writeFile(
    path.join(labRoot, "frameworks", "demo", "framework.yaml"),
    stringify(config),
    "utf8",
  );
  return { labRoot, sourceDir };
}

test("配置加载并保留基线步骤", async () => {
  const { labRoot } = await createLab("config", [nodeStep("success", "process.exit(0)")]);
  const config = await loadFrameworkConfig(labRoot, "demo");
  assert.equal(config.framework.id, "demo");
  assert.equal(config.baseline_steps[0]?.id, "success");
});

test("run id 同时考虑历史 raw run 并自动递增", async () => {
  const frameworkDir = await temporaryDirectory("run-id");
  await Promise.all([
    mkdir(path.join(frameworkDir, "reports", "raw", "run-007"), { recursive: true }),
    mkdir(path.join(frameworkDir, "runs", "run-008"), { recursive: true }),
  ]);
  assert.equal(await previewNextRunId(frameworkDir), "run-009");
  const reserved = await reserveRunDirectory(frameworkDir);
  assert.equal(reserved.runId, "run-009");
  await assert.rejects(() => reserveRunDirectory(frameworkDir, "run-009"), /run-009/u);
});

test("成功命令生成 passed 运行和独立日志", async () => {
  const { labRoot } = await createLab("passed", [
    nodeStep("success", "console.log('stdout-ok'); console.error('stderr-ok')"),
  ]);
  const result = await runBaseline({ labRoot, frameworkId: "demo" });
  assert.equal(result.run.status, "passed");
  assert.equal(result.run.steps[0]?.status, "passed");
  assert.equal(result.run.errorsFile, "errors.json");
  assert.equal(result.run.errorSummary?.total, 0);
  assert.deepEqual(
    JSON.parse(await readFile(path.join(result.runDir, "errors.json"), "utf8")).events,
    [],
  );
  assert.match(await readFile(path.join(result.runDir, "steps", "success.stdout.log"), "utf8"), /stdout-ok/u);
  assert.match(await readFile(path.join(result.runDir, "steps", "success.stderr.log"), "utf8"), /stderr-ok/u);
});

test("必需命令非零退出码使运行 failed", async () => {
  const { labRoot } = await createLab("failed", [nodeStep("failure", "process.exit(7)")]);
  const result = await runBaseline({ labRoot, frameworkId: "demo" });
  assert.equal(result.run.status, "failed");
  assert.equal(result.run.steps[0]?.exitCode, 7);
  assert.equal(result.run.firstBlockingStep, "failure");
});

test("allow_failure 失败且必需步骤通过时运行 partial", async () => {
  const { labRoot } = await createLab("partial", [
    nodeStep("optional", "process.exit(3)", true),
    nodeStep("required", "process.exit(0)"),
  ]);
  const result = await runBaseline({ labRoot, frameworkId: "demo" });
  assert.equal(result.run.status, "partial");
  assert.deepEqual(result.run.steps.map((step) => step.status), ["failed", "passed"]);
});

test("必需步骤失败且 stop_on_failure 时后续步骤 skipped", async () => {
  const { labRoot } = await createLab("skipped", [
    nodeStep("blocker", "process.exit(2)"),
    nodeStep("never-run", "process.exit(0)"),
  ]);
  const result = await runBaseline({ labRoot, frameworkId: "demo" });
  assert.deepEqual(result.run.steps.map((step) => step.status), ["failed", "skipped"]);
  assert.equal(result.run.steps[1]?.exitCode, null);
});

test("超时步骤被终止并记录 timed_out", async () => {
  const { labRoot } = await createLab("timeout", [
    nodeStep("slow", "setTimeout(() => {}, 10000)", false, 1),
  ]);
  const result = await runBaseline({ labRoot, frameworkId: "demo" });
  assert.equal(result.run.steps[0]?.status, "timed_out");
  assert.equal(result.run.status, "failed");
});

test("Windows pnpm.cmd 适配保持 shell=false 语义和参数边界", async (context) => {
  if (process.platform !== "win32") {
    context.skip("仅在 Windows 执行真实 .cmd 参数验证");
    return;
  }
  const directory = await temporaryDirectory("cmd-args 中文");
  const scriptPath = path.join(directory, "echo-args.mjs");
  const commandPath = path.join(directory, "fake pnpm.cmd");
  await writeFile(scriptPath, "console.log(JSON.stringify(process.argv.slice(2)))\n", "utf8");
  await writeFile(
    commandPath,
    `@echo off\r\n"${process.execPath}" "%~dp0echo-args.mjs" %*\r\n`,
    "utf8",
  );
  const spec = buildSpawnSpec(commandPath, ["alpha beta", "中文"], "win32");
  assert.match(spec.command.toLowerCase(), /cmd\.exe$/u);
  const result = await spawnCollect(commandPath, ["alpha beta", "中文"], directory);
  assert.equal(result.exitCode, 0, result.stderr || result.error || "cmd adapter failed");
  assert.deepEqual(JSON.parse(result.stdout.trim()), ["alpha beta", "中文"]);
});

test("Git dirty 采集准确包含 shared.ts", async () => {
  const directory = await temporaryDirectory("dirty-git");
  await mkdir(path.join(directory, "packages", "all", "build"), { recursive: true });
  const sharedPath = path.join(directory, "packages", "all", "build", "shared.ts");
  await writeFile(sharedPath, "export const value = 1;\n", "utf8");
  const git = (...args: string[]) => {
    const result = spawnSync("git", args, { cwd: directory, encoding: "utf8", shell: false });
    assert.equal(result.status, 0, result.stderr);
  };
  git("init");
  git("add", ".");
  git("-c", "user.name=Framework Lab Test", "-c", "user.email=test@example.invalid", "commit", "-m", "fixture");
  await writeFile(sharedPath, "export const value = 2;\n", "utf8");
  const snapshot = await collectGitSnapshot(directory);
  assert.equal(snapshot.dirty, true);
  assert.deepEqual(snapshot.changedFiles, ["packages/all/build/shared.ts"]);
});

test("Markdown 报告包含事实状态、阻塞步骤和日志路径", () => {
  const environment: EnvironmentRecord = {
    capturedAt: "2026-01-01T00:00:00.000Z",
    os: { platform: "win32", release: "fixture", arch: "x64" },
    nodeVersion: "v24.18.0",
    npmVersion: "11.7.0",
    packageManager: {
      name: "pnpm",
      configuredVersion: "10.26.1",
      resolvedVersion: "10.26.1",
      executable: ".framework-tools/pnpm.cmd",
    },
    frameworkLabCommit: "abc123",
    warnings: [],
  };
  const source: SourceRecord = {
    frameworkId: "demo",
    sourceDir: "fixtures/demo",
    commit: "def456",
    dirty: true,
    changedFiles: ["shared.ts"],
    warnings: [],
  };
  const run: BaselineRunRecord = {
    schemaVersion: "1.0.0",
    runId: "run-010",
    framework: { id: "demo", name: "Demo" },
    status: "failed",
    startedAt: "2026-01-01T00:00:00.000Z",
    finishedAt: "2026-01-01T00:00:01.000Z",
    totalDurationMs: 1000,
    environmentFile: "environment.json",
    sourceFile: "source.json",
    reportFile: "report.md",
    steps: [{
      id: "build",
      command: "pnpm.cmd",
      args: ["build"],
      cwd: "fixtures/demo",
      startedAt: "2026-01-01T00:00:00.000Z",
      finishedAt: "2026-01-01T00:00:01.000Z",
      durationMs: 1000,
      exitCode: 1,
      status: "failed",
      stdoutLog: "steps/build.stdout.log",
      stderrLog: "steps/build.stderr.log",
      allowFailure: false,
      timeoutSeconds: 60,
    }],
    firstBlockingStep: "build",
    warnings: [],
  };
  const report = generateReport(run, environment, source);
  assert.match(report, /run-010/u);
  assert.match(report, /failed/u);
  assert.match(report, /build\.stderr\.log/u);
  assert.match(report, /shared\.ts/u);
});
