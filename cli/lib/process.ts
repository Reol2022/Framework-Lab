import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { once } from "node:events";
import type { FrameworkStepConfig, StepRecord, StepStatus } from "./types.js";

export interface SpawnSpec {
  command: string;
  args: string[];
  windowsVerbatimArguments?: boolean;
}

export interface RunStepOptions {
  step: FrameworkStepConfig;
  resolvedCommand: string;
  displayCommand: string;
  cwd: string;
  displayCwd: string;
  stepsDir: string;
  env?: NodeJS.ProcessEnv;
  onProgress?: (message: string) => void;
}

export interface CollectedProcess {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  error: string | null;
}

export interface BackgroundProcess {
  pid: number | null;
  exited: Promise<{ exitCode: number | null; error: string | null }>;
  stop: () => Promise<void>;
}

function quoteCmdArgument(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

/**
 * Windows cannot execute .cmd/.bat files directly through CreateProcess.
 * Use an explicit cmd.exe adapter while keeping child_process shell=false.
 */
export function buildSpawnSpec(
  command: string,
  args: string[],
  platform: NodeJS.Platform = process.platform,
): SpawnSpec {
  if (platform === "win32" && /\.(?:cmd|bat)$/i.test(command)) {
    const commandLine = [command, ...args].map(quoteCmdArgument).join(" ");
    return {
      command: process.env.ComSpec ?? "cmd.exe",
      // With /s, cmd.exe removes the outer quote pair. Keeping a second pair
      // preserves the quoted executable path when it contains spaces or CJK.
      args: ["/d", "/s", "/c", `"${commandLine}"`],
      windowsVerbatimArguments: true,
    };
  }
  return { command, args };
}

async function terminateProcessTree(child: ChildProcess): Promise<void> {
  if (!child.pid || child.killed) {
    return;
  }

  if (process.platform === "win32") {
    await new Promise<void>((resolve) => {
      const killer = spawn("taskkill.exe", ["/pid", String(child.pid), "/t", "/f"], {
        shell: false,
        stdio: "ignore",
        windowsHide: true,
      });
      killer.once("close", () => resolve());
      killer.once("error", () => {
        child.kill();
        resolve();
      });
    });
    return;
  }

  child.kill("SIGTERM");
}

export async function startBackgroundProcess(options: {
  command: string;
  args: string[];
  cwd: string;
  stdoutPath: string;
  stderrPath: string;
  env?: NodeJS.ProcessEnv;
}): Promise<BackgroundProcess> {
  const spec = buildSpawnSpec(options.command, options.args);
  const stdoutStream = createWriteStream(options.stdoutPath, { encoding: "utf8", flags: "wx" });
  const stderrStream = createWriteStream(options.stderrPath, { encoding: "utf8", flags: "wx" });
  const child = spawn(spec.command, spec.args, {
    cwd: options.cwd,
    env: options.env,
    shell: false,
    windowsVerbatimArguments: spec.windowsVerbatimArguments,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.pipe(stdoutStream, { end: false });
  child.stderr?.pipe(stderrStream, { end: false });
  let spawnError: string | null = null;
  child.once("error", (error) => {
    spawnError = error.message;
    stderrStream.write(`Framework Lab spawn error: ${error.message}\n`);
  });
  const exited = new Promise<{ exitCode: number | null; error: string | null }>((resolve) => {
    child.once("close", async (exitCode) => {
      stdoutStream.end();
      stderrStream.end();
      await Promise.all([once(stdoutStream, "finish"), once(stderrStream, "finish")]);
      resolve({ exitCode, error: spawnError });
    });
  });
  return {
    pid: child.pid ?? null,
    exited,
    stop: async () => {
      await terminateProcessTree(child);
      await exited;
    },
  };
}

export async function spawnCollect(
  command: string,
  args: string[],
  cwd: string,
  timeoutMs = 15_000,
): Promise<CollectedProcess> {
  const spec = buildSpawnSpec(command, args);
  return await new Promise<CollectedProcess>((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;
    let spawnError: string | null = null;
    const child = spawn(spec.command, spec.args, {
      cwd,
      shell: false,
      windowsVerbatimArguments: spec.windowsVerbatimArguments,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.once("error", (error) => {
      spawnError = error.message;
    });

    const timer = setTimeout(() => {
      timedOut = true;
      void terminateProcessTree(child);
    }, timeoutMs);

    child.once("close", (exitCode) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ exitCode, stdout, stderr, timedOut, error: spawnError });
    });
  });
}

function statusFrom(exitCode: number | null, timedOut: boolean): StepStatus {
  if (timedOut) return "timed_out";
  return exitCode === 0 ? "passed" : "failed";
}

export async function runStep(options: RunStepOptions): Promise<StepRecord> {
  const { step, stepsDir } = options;
  const stdoutName = `${step.id}.stdout.log`;
  const stderrName = `${step.id}.stderr.log`;
  const stdoutPath = path.join(stepsDir, stdoutName);
  const stderrPath = path.join(stepsDir, stderrName);
  const stdoutStream = createWriteStream(stdoutPath, { encoding: "utf8", flags: "wx" });
  const stderrStream = createWriteStream(stderrPath, { encoding: "utf8", flags: "wx" });
  const startedAt = new Date();
  const startedNs = process.hrtime.bigint();
  const spec = buildSpawnSpec(options.resolvedCommand, step.args);

  options.onProgress?.(`开始 ${step.id}`);

  const result = await new Promise<{ exitCode: number | null; timedOut: boolean }>((resolve) => {
    let timedOut = false;
    let settled = false;
    let spawnError: Error | null = null;
    const child = spawn(spec.command, spec.args, {
      cwd: options.cwd,
      env: options.env,
      shell: false,
      windowsVerbatimArguments: spec.windowsVerbatimArguments,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout?.pipe(stdoutStream, { end: false });
    child.stderr?.pipe(stderrStream, { end: false });
    child.once("error", (error) => {
      spawnError = error;
      stderrStream.write(`Framework Lab spawn error: ${error.message}\n`);
    });

    const timer = setTimeout(() => {
      timedOut = true;
      stderrStream.write(`Framework Lab timeout after ${step.timeout_seconds} seconds.\n`);
      void terminateProcessTree(child);
    }, step.timeout_seconds * 1000);

    child.once("close", (exitCode) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (spawnError && exitCode === 0) {
        resolve({ exitCode: null, timedOut });
      } else {
        resolve({ exitCode, timedOut });
      }
    });
  });

  stdoutStream.end();
  stderrStream.end();
  await Promise.all([once(stdoutStream, "finish"), once(stderrStream, "finish")]);

  const finishedAt = new Date();
  const durationMs = Number((process.hrtime.bigint() - startedNs) / 1_000_000n);
  const status = statusFrom(result.exitCode, result.timedOut);
  options.onProgress?.(`完成 ${step.id}: ${status}`);

  return {
    id: step.id,
    command: options.displayCommand,
    args: [...step.args],
    cwd: options.displayCwd,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs,
    exitCode: result.exitCode,
    status,
    stdoutLog: `steps/${stdoutName}`,
    stderrLog: `steps/${stderrName}`,
    allowFailure: step.allow_failure,
    timeoutSeconds: step.timeout_seconds,
  };
}

export async function createSkippedStep(
  step: FrameworkStepConfig,
  displayCommand: string,
  displayCwd: string,
  stepsDir: string,
): Promise<StepRecord> {
  const now = new Date().toISOString();
  const stdoutName = `${step.id}.stdout.log`;
  const stderrName = `${step.id}.stderr.log`;
  await Promise.all([
    writeFile(path.join(stepsDir, stdoutName), "", { encoding: "utf8", flag: "wx" }),
    writeFile(path.join(stepsDir, stderrName), "", { encoding: "utf8", flag: "wx" }),
  ]);
  return {
    id: step.id,
    command: displayCommand,
    args: [...step.args],
    cwd: displayCwd,
    startedAt: now,
    finishedAt: now,
    durationMs: 0,
    exitCode: null,
    status: "skipped",
    stdoutLog: `steps/${stdoutName}`,
    stderrLog: `steps/${stderrName}`,
    allowFailure: step.allow_failure,
    timeoutSeconds: step.timeout_seconds,
  };
}
