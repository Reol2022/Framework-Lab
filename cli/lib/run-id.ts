import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";

const RUN_PATTERN = /^run-(\d+)$/u;

export function normalizeRunId(value: string): string {
  const normalized = /^\d+$/u.test(value) ? `run-${value.padStart(3, "0")}` : value;
  if (!RUN_PATTERN.test(normalized)) {
    throw new Error(`无效 run id "${value}"；应使用 run-008 或 008 格式。`);
  }
  return normalized;
}

async function existingRunNumbers(frameworkDir: string): Promise<number[]> {
  const directories = [
    path.join(frameworkDir, "runs"),
    path.join(frameworkDir, "reports", "raw"),
  ];
  const numbers: number[] = [];

  for (const directory of directories) {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const match = RUN_PATTERN.exec(entry.name);
      if (match?.[1]) numbers.push(Number(match[1]));
    }
  }
  return numbers;
}

export async function previewNextRunId(frameworkDir: string): Promise<string> {
  const numbers = await existingRunNumbers(frameworkDir);
  const next = (numbers.length > 0 ? Math.max(...numbers) : 0) + 1;
  return `run-${String(next).padStart(3, "0")}`;
}

export async function reserveRunDirectory(
  frameworkDir: string,
  requestedRunId?: string,
): Promise<{ runId: string; runDir: string }> {
  const runsDir = path.join(frameworkDir, "runs");
  await mkdir(runsDir, { recursive: true });

  if (requestedRunId) {
    const runId = normalizeRunId(requestedRunId);
    const runDir = path.join(runsDir, runId);
    try {
      await mkdir(runDir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        throw new Error(`run id 已存在，拒绝覆盖：${runId}`);
      }
      throw error;
    }
    return { runId, runDir };
  }

  let candidate = await previewNextRunId(frameworkDir);
  while (true) {
    const runDir = path.join(runsDir, candidate);
    try {
      await mkdir(runDir);
      return { runId: candidate, runDir };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const next = Number(candidate.slice(4)) + 1;
      candidate = `run-${String(next).padStart(3, "0")}`;
    }
  }
}
