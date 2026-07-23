import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";
import { validateWithSchema } from "./schema.js";
import type { FrameworkConfig } from "./types.js";

export async function loadFrameworkConfig(
  labRoot: string,
  frameworkId: string,
): Promise<FrameworkConfig> {
  const configPath = path.resolve(labRoot, "frameworks", frameworkId, "framework.yaml");
  let content: string;
  try {
    content = await readFile(configPath, "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      throw new Error(`未知框架 "${frameworkId}"：未找到 frameworks/${frameworkId}/framework.yaml。`);
    }
    throw error;
  }

  const value: unknown = parse(content);
  await validateWithSchema(labRoot, "framework-config.schema.json", value);
  const config = value as FrameworkConfig;
  if (config.framework.id !== frameworkId) {
    throw new Error(
      `框架配置 id 不一致：目录为 "${frameworkId}"，配置为 "${config.framework.id}"。`,
    );
  }
  return config;
}
