import { spawnCollect } from "./process.js";
import type { GitSnapshot } from "./types.js";

function parseChangedFiles(output: string): string[] {
  return output
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => line.slice(3).trim())
    .filter(Boolean);
}

export async function collectGitSnapshot(directory: string): Promise<GitSnapshot> {
  const warnings: string[] = [];
  const commitResult = await spawnCollect(
    "git",
    ["-C", directory, "rev-parse", "HEAD"],
    directory,
  );
  const statusResult = await spawnCollect(
    "git",
    ["-c", "core.quotepath=false", "-C", directory, "status", "--porcelain=v1", "--untracked-files=normal"],
    directory,
  );

  let commit: string | null = null;
  if (commitResult.exitCode === 0) {
    commit = commitResult.stdout.trim() || null;
  } else {
    warnings.push(
      `无法读取 Git commit：${commitResult.error ?? (commitResult.stderr.trim() || "未知错误")}`,
    );
  }

  if (statusResult.exitCode !== 0) {
    warnings.push(
      `无法读取 Git worktree 状态：${statusResult.error ?? (statusResult.stderr.trim() || "未知错误")}`,
    );
    return { commit, dirty: null, changedFiles: [], warnings };
  }

  const changedFiles = parseChangedFiles(statusResult.stdout);
  return {
    commit,
    dirty: changedFiles.length > 0,
    changedFiles,
    warnings,
  };
}
