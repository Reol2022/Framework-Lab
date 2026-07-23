import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  classifyFile,
  diffCatalog,
  listCatalog,
  scanCatalog,
  stableJson,
  symlinkTargetOutside,
  validateCatalog,
  workspacePatterns,
  type CatalogFile,
} from "../cli/lib/catalog.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schemaNames = [
  "framework-config.schema.json", "catalog-current.schema.json", "repository-catalog.schema.json", "source-files.schema.json",
  "packages-catalog.schema.json", "documents-catalog.schema.json", "examples-catalog.schema.json",
  "configs-catalog.schema.json", "relationships-catalog.schema.json", "catalog-snapshot.schema.json",
  "catalog-manifest.schema.json", "catalog-statistics.schema.json", "catalog-diff.schema.json",
];

let lab = "";
let source = "";
let firstCommit = "";
let secondCommit = "";
let first: Awaited<ReturnType<typeof scanCatalog>>;
let second: Awaited<ReturnType<typeof scanCatalog>>;
let diff: Awaited<ReturnType<typeof diffCatalog>>;

function git(args: string[]): string {
  return execFileSync("git", ["-C", source, ...args], { encoding: "utf8" }).trim();
}

async function put(relative: string, content: string | Buffer): Promise<void> {
  const target = path.join(source, ...relative.split("/"));
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content);
}

function file(relative: string): CatalogFile {
  const result = first.data.files.files.find((item) => item.path === relative);
  assert.ok(result, `missing file ${relative}`);
  return result;
}

before(async () => {
  lab = await mkdtemp(path.join(os.tmpdir(), "framework-lab-catalog-中文 space-"));
  source = path.join(lab, "sources", "框架 repo");
  await mkdir(path.join(lab, "schemas"), { recursive: true });
  for (const name of schemaNames) {
    await writeFile(path.join(lab, "schemas", name), await readFile(path.join(projectRoot, "schemas", name)));
  }
  await mkdir(path.join(lab, "frameworks", "fixture"), { recursive: true });
  await writeFile(path.join(lab, "frameworks", "fixture", "framework.yaml"), `schema_version: 1.0.0
framework:
  id: fixture
  name: Fixture
  source_dir: sources/框架 repo
package_manager:
  name: pnpm
  version: 10.26.1
  executable: tools/pnpm.cmd
stop_on_failure: true
baseline_steps:
  - id: test
    command: node
    args: ["--version"]
    timeout_seconds: 10
    allow_failure: false
`, "utf8");
  await mkdir(source, { recursive: true });
  execFileSync("git", ["init", source], { stdio: "ignore" });
  git(["config", "user.email", "fixture@example.invalid"]);
  git(["config", "user.name", "Fixture"]);
  await put("package.json", JSON.stringify({
    name: "fixture-root", private: true, packageManager: "pnpm@10.26.1",
    scripts: { "dev:example": "pnpm --filter fixture-demo dev" },
    devDependencies: { "@fixture/a": "workspace:*" },
  }, null, 2));
  await put("pnpm-workspace.yaml", "packages:\n  - packages/*\n  - example\n");
  await put("pnpm-lock.yaml", "lockfileVersion: '9.0'\n");
  await put("packages/a/package.json", JSON.stringify({
    name: "@fixture/a", version: "1.0.0", exports: { ".": "./src/index.ts" },
    dependencies: { "@fixture/b": "workspace:*" }, types: "./src/index.ts",
  }, null, 2));
  await put("packages/a/src/index.ts", "export const answer = 42;\n");
  await put("packages/a/README.md", "# Package A\n\nSee [source](./src/index.ts).\n");
  await put("packages/b/package.json", JSON.stringify({ name: "@fixture/b", version: "1.0.0" }, null, 2));
  await put("packages/b/src/index.ts", "export const b = true;\n");
  await put("example/package.json", JSON.stringify({
    name: "fixture-demo", private: true, scripts: { dev: "vite" }, dependencies: { "@fixture/a": "workspace:*" },
  }, null, 2));
  await put("example/index.html", "<script type=\"module\" src=\"/src/main.ts\"></script>\n");
  await put("example/src/main.ts", "import '@fixture/a';\n");
  await put("example/vite.config.ts", "import { defineConfig } from 'vite';\nexport default defineConfig({});\n");
  await put("README.md", "# Fixture\n\n## Setup\n\nSee [A](./packages/a/README.md) and [missing](./missing.md).\n\n```md\n# Not heading\n```\n");
  await put("docs/move.md", "# Movable\n");
  await put("tests/basic.test.ts", "export {};\n");
  await put("tsconfig.json", JSON.stringify({ extends: "./tsconfig.base.json", include: ["packages"] }));
  await put("tsconfig.base.json", "{}\n");
  await put("scripts/build.mjs", "console.log('fixture');\n");
  await put("src/utf8.ts", "export const 名称 = '值';\n");
  await put("src/bom.txt", Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("bom\n")]));
  await put("src/utf16.txt", Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from("wide\n", "utf16le")]));
  await put("assets/data.bin", Buffer.from([0, 1, 2, 3]));
  await put("docs/large.md", `# Large\n${"x".repeat(1024)}\n`);
  git(["add", "-A"]);
  git(["commit", "-m", "fixture one"]);
  firstCommit = git(["rev-parse", "HEAD"]);
  await mkdir(path.join(source, "node_modules", "ignored"), { recursive: true });
  await writeFile(path.join(source, "node_modules", "ignored", "x.js"), "ignored");
  first = await scanCatalog({ labRoot: lab, frameworkId: "fixture", maxFileSize: 128 });
  await put("README.md", "# Fixture\n\n## Changed\n");
  git(["mv", "docs/move.md", "docs/moved.md"]);
  await put("src/new.ts", "export const added = 1;\n");
  await put("packages/a/package.json", JSON.stringify({
    name: "@fixture/a", version: "1.0.1", exports: { ".": "./src/index.ts" },
    dependencies: { "@fixture/b": "workspace:*" }, types: "./src/index.ts",
  }, null, 2));
  git(["add", "-A"]);
  git(["commit", "-m", "fixture two"]);
  secondCommit = git(["rev-parse", "HEAD"]);
  second = await scanCatalog({ labRoot: lab, frameworkId: "fixture", maxFileSize: 128 });
  diff = await diffCatalog(lab, "fixture", first.snapshotId, second.snapshotId);
});

after(async () => {
  if (lab) await rm(lab, { recursive: true, force: true });
});

test("Git tracked file 清单采集", () => assert.equal(first.data.files.files.length, 23));
test("默认排除 untracked node_modules", () => assert.ok(!first.data.files.files.some((item) => item.path.includes("node_modules"))));
test("untracked 计数被记录", () => assert.ok(Number(first.data.repository.untrackedFileCount) >= 1));
test("clean commit snapshot id", () => assert.equal(first.snapshotId, firstCommit));
test("clean snapshot 标记 clean", () => assert.equal(first.data.repository.clean, true));
test("Windows 中文路径可扫描", () => assert.ok(first.data.files.files.length > 0));
test("空格路径可扫描", () => assert.ok(first.outputDir));
test("路径统一为斜杠", () => assert.ok(first.data.files.files.every((item) => !item.path.includes("\\"))));
test("机器绝对路径不进入 snapshot", () => assert.ok(!JSON.stringify(first.data).includes(lab)));
test("UTF-8 文件识别", () => assert.equal(file("src/utf8.ts").encoding, "UTF-8"));
test("UTF-8 BOM 识别", () => assert.equal(file("src/bom.txt").encoding, "UTF-8 BOM"));
test("UTF-16LE 识别", () => assert.equal(file("src/utf16.txt").encoding, "UTF-16LE"));
test("二进制识别", () => assert.equal(file("assets/data.bin").isText, false));
test("大文件跳过正文提取", () => assert.ok(file("docs/large.md").warnings.some((item) => item.includes("size exceeds"))));
test("文件 SHA256", () => assert.match(file("src/utf8.ts").sha256, /^[a-f0-9]{64}$/u));
test("稳定 rootHash 格式", () => assert.match(first.rootHash, /^sha256:[a-f0-9]{64}$/u));
test("rootHash 不含扫描时间", () => assert.equal(first.rootHash, first.data.snapshot.rootHash));
test("文件分类优先级 manifest", () => assert.equal(classifyFile("example/package.json"), "manifest"));
test("source 分类", () => assert.equal(classifyFile("src/a.ts"), "source"));
test("documentation 分类", () => assert.equal(classifyFile("docs/a.md"), "documentation"));
test("example 分类", () => assert.equal(classifyFile("examples/a.ts"), "example"));
test("test 分类", () => assert.equal(classifyFile("src/a.test.ts"), "test"));
test("config 分类", () => assert.equal(classifyFile("tsconfig.json"), "config"));
test("build 分类", () => assert.equal(classifyFile("vite.config.ts"), "build"));
test("style 分类", () => assert.equal(classifyFile("src/a.scss"), "style"));
test("asset 分类", () => assert.equal(classifyFile("assets/a.png"), "asset"));
test("pnpm workspace package 识别", () => assert.equal(first.data.packages.packages.length, 4));
test("npm workspace package 声明识别", () => assert.deepEqual(workspacePatterns({ workspaces: ["packages/*"] }, null), ["packages/*"]));
test("根 package 识别", () => assert.ok(first.data.packages.packages.some((item) => item.id === "root")));
test("package 最长路径归属", () => assert.equal(file("packages/a/src/index.ts").packageId, "package-fixture-a"));
test("根目录文件归属 root", () => assert.equal(file("README.md").packageId, "root"));
test("workspace dependency 关系", () => assert.ok(first.data.relationships.relationships.some((item) => item.type === "workspace_dependency" && item.from === "package-fixture-a")));
test("package export target 关系", () => assert.ok(first.data.relationships.relationships.some((item) => item.type === "package_export_target")));
test("package contains file 关系", () => assert.ok(first.data.relationships.relationships.some((item) => item.type === "package_contains_file")));
test("Markdown 标题提取", () => assert.equal(first.data.documents.documents.find((item) => item.path === "README.md")?.title, "Fixture"));
test("Markdown 代码块内标题忽略", () => assert.equal(first.data.documents.documents.find((item) => item.path === "README.md")?.sections.length, 2));
test("文档章节行号", () => {
  const sections = first.data.documents.documents.find((item) => item.path === "README.md")?.sections ?? [];
  assert.deepEqual(sections.map((item) => item.lineStart), [1, 3]);
});
test("内部链接解析", () => assert.equal(first.data.documents.documents.find((item) => item.path === "README.md")?.links[0]?.resolvedPath, "packages/a/README.md"));
test("有效内部链接不标 broken", () => assert.equal(first.data.documents.documents.find((item) => item.path === "README.md")?.links[0]?.broken, false));
test("无效内部链接标记 broken", () => assert.equal(first.data.documents.documents.find((item) => item.path === "README.md")?.links[1]?.broken, true));
test("文档 content SHA256", () => assert.match(first.data.documents.documents[0]?.sections[0]?.contentSha256 ?? "", /^[a-f0-9]{64}$/u));
test("示例目录识别", () => assert.equal(first.data.examples.examples[0]?.rootPath, "example"));
test("package script 示例识别", () => assert.ok((first.data.examples.examples[0]?.scripts.length ?? 0) > 0));
test("示例判断依据记录", () => assert.ok(first.data.examples.examples[0]?.detectedBy.some((item) => item.startsWith("entry:"))));
test("示例置信度", () => assert.equal(first.data.examples.examples[0]?.confidence, "high"));
test("示例引用 workspace package", () => assert.deepEqual(first.data.examples.examples[0]?.referencedPackages, ["@fixture/a"]));
test("配置文件静态采集", () => assert.ok(first.data.configs.configs.some((item) => item.type === "TypeScript")));
test("Vite 配置识别", () => assert.ok(first.data.configs.configs.some((item) => item.type === "Vite")));
test("tsconfig references 静态提取", () => assert.ok(first.data.configs.configs.find((item) => item.path === "tsconfig.json")?.references.includes("./tsconfig.base.json")));
test("statistics 由 files 派生", () => assert.equal(first.data.statistics.totalFiles, first.data.files.files.length));
test("statistics 文档数一致", () => assert.equal(first.data.statistics.documentCount, first.data.documents.documents.length));
test("manifest SHA256 可验证", async () => {
  const manifest = JSON.parse(await readFile(path.join(first.outputDir ?? "", "manifest.json"), "utf8")) as { catalogFiles: Record<string, string> };
  const content = await readFile(path.join(first.outputDir ?? "", "files.json"));
  assert.equal(manifest.catalogFiles["files.json"], createHash("sha256").update(content).digest("hex"));
});
test("catalog validate", async () => assert.deepEqual((await validateCatalog(lab, "fixture")).errors, []));
test("current.json 指向第二 snapshot", async () => {
  const current = JSON.parse(await readFile(path.join(lab, "frameworks", "fixture", "catalog", "current.json"), "utf8")) as { snapshotId: string };
  assert.equal(current.snapshotId, second.snapshotId);
});
test("catalog list", async () => assert.equal((await listCatalog(lab, "fixture")).length, 2));
test("diff added", () => assert.ok((diff.added as string[]).includes("src/new.ts")));
test("diff modified", () => assert.ok((diff.modified as Array<{ path: string }>).some((item) => item.path === "README.md")));
test("diff exact rename", () => assert.deepEqual(diff.renamed, [{ from: "docs/move.md", to: "docs/moved.md", sha256: file("docs/move.md").sha256 }]));
test("diff package modified", () => assert.ok((diff.packageModified as string[]).includes("package-fixture-a")));
test("相同输入重复扫描 rootHash 一致", async () => {
  const repeated = await scanCatalog({ labRoot: lab, frameworkId: "fixture", maxFileSize: 128 });
  assert.equal(repeated.rootHash, second.rootHash);
  assert.equal(repeated.existed, true);
});
test("force 只覆盖派生 snapshot", async () => {
  const forced = await scanCatalog({ labRoot: lab, frameworkId: "fixture", maxFileSize: 128, force: true });
  assert.equal(forced.rootHash, second.rootHash);
  assert.equal(git(["rev-parse", "HEAD"]), secondCommit);
});
test("dry-run 不写 snapshot", async () => {
  const result = await scanCatalog({ labRoot: lab, frameworkId: "fixture", snapshotId: "dry-run-only", dryRun: true, maxFileSize: 128 });
  assert.equal(result.outputDir, null);
  await assert.rejects(stat(path.join(lab, "frameworks", "fixture", "catalog", "snapshots", "dry-run-only")));
});
test("tracked dirty 默认拒绝", async () => {
  await put("README.md", "# dirty\n");
  await assert.rejects(scanCatalog({ labRoot: lab, frameworkId: "fixture" }), /tracked dirty/u);
});
test("allow-dirty snapshot id", async () => {
  const result = await scanCatalog({ labRoot: lab, frameworkId: "fixture", allowDirty: true, dryRun: true });
  assert.match(result.snapshotId, new RegExp(`^${secondCommit}-dirty-[a-f0-9]{12}$`, "u"));
  assert.equal(result.data.snapshot.dirty, true);
});
test("symlink 外部目标被判定为越界", () => {
  const root = path.resolve("C:/fixture/中文 repo");
  assert.equal(symlinkTargetOutside(root, path.join(root, "src", "link"), "../../../outside"), true);
  assert.equal(symlinkTargetOutside(root, path.join(root, "src", "link"), "../inside.ts"), false);
});
test("stable JSON key order", () => assert.equal(stableJson({ b: 1, a: 2 }), "{\"a\":2,\"b\":1}"));
