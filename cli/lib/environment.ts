import os from "node:os";
import path from "node:path";
import { collectGitSnapshot } from "./git.js";
import { spawnCollect } from "./process.js";
import type { EnvironmentRecord, FrameworkConfig, SourceRecord } from "./types.js";

function commandError(label: string, stderr: string, error: string | null): string {
  return `${label}：${error ?? (stderr.trim() || "未知错误")}`;
}

export async function collectEnvironment(
  labRoot: string,
  config: FrameworkConfig,
  packageManagerExecutable: string,
  packageManagerDisplay: string,
): Promise<EnvironmentRecord> {
  const warnings: string[] = [];
  // pnpm scripts prepend project node_modules/.bin to PATH, which can shadow
  // the npm shim belonging to the active Node installation on Windows.
  const npmCommand = process.platform === "win32"
    ? path.join(path.dirname(process.execPath), "npm.cmd")
    : "npm";
  const [npmResult, packageManagerResult, labGit] = await Promise.all([
    spawnCollect(npmCommand, ["--version"], labRoot),
    spawnCollect(packageManagerExecutable, ["--version"], labRoot),
    collectGitSnapshot(labRoot),
  ]);

  let npmVersion: string | null = null;
  if (npmResult.exitCode === 0) {
    npmVersion = npmResult.stdout.trim() || null;
  } else {
    warnings.push(commandError("无法读取 npm 版本", npmResult.stderr, npmResult.error));
  }

  let resolvedVersion: string | null = null;
  if (packageManagerResult.exitCode === 0) {
    resolvedVersion = packageManagerResult.stdout.trim() || null;
  } else {
    warnings.push(
      commandError(
        `无法读取 ${config.package_manager.name} 版本`,
        packageManagerResult.stderr,
        packageManagerResult.error,
      ),
    );
  }

  warnings.push(...labGit.warnings);

  return {
    capturedAt: new Date().toISOString(),
    os: {
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
    },
    nodeVersion: process.version,
    npmVersion,
    packageManager: {
      name: config.package_manager.name,
      configuredVersion: config.package_manager.version,
      resolvedVersion,
      executable: packageManagerDisplay,
    },
    frameworkLabCommit: labGit.commit,
    warnings,
  };
}

export async function collectSource(
  frameworkId: string,
  sourceDirectory: string,
  sourceDisplay: string,
): Promise<SourceRecord> {
  const git = await collectGitSnapshot(sourceDirectory);
  return {
    frameworkId,
    sourceDir: sourceDisplay,
    ...git,
  };
}
