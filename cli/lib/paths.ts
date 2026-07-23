import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export function findLabRoot(start = process.cwd()): string {
  let current = path.resolve(start);

  while (true) {
    const packagePath = path.join(current, "package.json");
    if (existsSync(packagePath)) {
      try {
        const pkg = JSON.parse(readFileSync(packagePath, "utf8")) as { name?: string };
        if (pkg.name === "framework-lab-workflow") {
          return current;
        }
      } catch {
        // Continue walking; malformed unrelated package files are not the lab root.
      }
    }

    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error(`无法从 ${start} 定位 Framework Lab 仓库根目录。`);
    }
    current = parent;
  }
}

export function resolveFromLab(labRoot: string, value: string): string {
  return path.isAbsolute(value) ? path.normalize(value) : path.resolve(labRoot, value);
}

export function portablePath(value: string): string {
  return value.replaceAll(path.sep, "/");
}

export function displayPath(labRoot: string, value: string): string {
  const relative = path.relative(labRoot, value);
  if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
    return portablePath(relative);
  }
  if (relative === "") {
    return ".";
  }
  return portablePath(value);
}
