import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { scanCatalog } from "../cli/lib/catalog.js";
import { diffSymbols, extractSymbols, querySymbols, validateSymbols } from "../cli/lib/symbols.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schemas = [
  "framework-config.schema.json", "catalog-current.schema.json", "repository-catalog.schema.json", "source-files.schema.json",
  "packages-catalog.schema.json", "documents-catalog.schema.json", "examples-catalog.schema.json", "configs-catalog.schema.json",
  "relationships-catalog.schema.json", "catalog-snapshot.schema.json", "catalog-manifest.schema.json", "catalog-statistics.schema.json",
  "catalog-diff.schema.json", "typescript-analysis.schema.json", "modules-catalog.schema.json", "symbols-catalog.schema.json",
  "exports-catalog.schema.json", "components-catalog.schema.json", "symbol-relationships.schema.json", "symbol-diagnostics.schema.json",
  "symbol-statistics.schema.json", "symbol-manifest.schema.json", "symbol-current.schema.json", "symbol-diff.schema.json",
];
let lab = "", source = "", firstCommit = "", secondCommit = "";
let first: Awaited<ReturnType<typeof extractSymbols>>;
let second: Awaited<ReturnType<typeof extractSymbols>>;
let symbolDiff: Awaited<ReturnType<typeof diffSymbols>>;
function git(args: string[]): string { return execFileSync("git", ["-C", source, ...args], { encoding: "utf8" }).trim(); }
async function put(file: string, content: string): Promise<void> {
  const target = path.join(source, ...file.split("/")); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, content, "utf8");
}
before(async () => {
  lab = await mkdtemp(path.join(os.tmpdir(), "symbols-中文 space-")); source = path.join(lab, "sources", "组件 repo");
  await mkdir(path.join(lab, "schemas"), { recursive: true });
  for (const name of schemas) await writeFile(path.join(lab, "schemas", name), await readFile(path.join(projectRoot, "schemas", name)));
  await mkdir(path.join(lab, "frameworks", "fixture"), { recursive: true });
  await writeFile(path.join(lab, "frameworks", "fixture", "framework.yaml"), `schema_version: 1.0.0
framework: { id: fixture, name: Fixture, source_dir: "sources/组件 repo" }
package_manager: { name: pnpm, version: 10.26.1, executable: tools/pnpm.cmd }
stop_on_failure: true
baseline_steps:
  - { id: test, command: node, args: ["--version"], timeout_seconds: 10, allow_failure: false }
analysis:
  typescript:
    componentDetection:
      sourceGlobs: ["packages/ui/src/**/*.ts", "packages/ui/src/**/*.tsx"]
      baseTypes: [BaseElement]
      publicPackages: ["@fixture/ui"]
      stylePatterns: ["{dir}/style.css"]
      examplePatterns: ["example/{component}/**/*.ts"]
      lifecycleMethods: [connectedCallback]
      registrationFunctions: [register]
`, "utf8");
  await mkdir(source, { recursive: true }); execFileSync("git", ["init", source], { stdio: "ignore" });
  git(["config", "user.email", "fixture@example.invalid"]); git(["config", "user.name", "Fixture"]);
  await put("package.json", JSON.stringify({ name: "root", private: true, packageManager: "pnpm@10.26.1" }));
  await put("pnpm-workspace.yaml", "packages:\n  - packages/*\n  - example\n");
  await put("packages/ui/package.json", JSON.stringify({ name: "@fixture/ui", version: "1.0.0", main: "./index.ts" }));
  await put("packages/ui/index.ts", "export { default as FancyBox, helper as aliasHelper } from './src/component';\nexport * from './src/types';\nexport * as Types from './src/types';\nexport * from './src/cycle-a';\nexport * from './src/collision-a';\nexport * from './src/collision-b';\n");
  await put("packages/ui/src/base.ts", "export class BaseElement {}\n");
  await put("packages/ui/src/types.ts", "export interface FancyBoxProps { value?: string }\nexport type Size = 's' | 'l';\nexport enum Mode { A, B }\nexport declare function useProps(value: FancyBoxProps): FancyBoxProps;\n");
  await put("packages/ui/src/component.ts", `import BaseDefault, { type Named as NamedType } from "external";
import * as NS from "./types";
import Equals = require("./lazy");
import "./style.css";
import { BaseElement } from "./base";
/** A fixture component.
 * @deprecated fixture only
 */
export default class FancyBox<T> extends BaseElement implements NamedType {
  public static readonly tag = "fancy-box";
  optional?: string;
  private secret = 1;
  connectedCallback(): void {}
  method(value: T): T { return value; }
}
export function helper(value: string): number;
export function helper(value: string): number { return value.length; }
export const version = "1";
void BaseDefault; void NS; void Equals;
register("fancy-box", FancyBox);
void import("./lazy");
`);
  await put("packages/ui/src/lazy.ts", "export const lazy = true;\n");
  await put("packages/ui/src/cycle-a.ts", "export * from './cycle-b';\nexport const CycleValue = 1;\n");
  await put("packages/ui/src/cycle-b.ts", "export * from './cycle-a';\n");
  await put("packages/ui/src/collision-a.ts", "export const Shared = 'a';\n");
  await put("packages/ui/src/collision-b.ts", "export const Shared = 'b';\n");
  await put("packages/ui/src/view.tsx", "export const View = () => <div />;\n");
  await put("packages/ui/src/style.css", ":host {}\n");
  await put("example/package.json", JSON.stringify({ name: "fixture-example", private: true }));
  await put("example/fancybox/index.ts", "import { FancyBox } from '@fixture/ui';\nconst box = new FancyBox();\nvoid box;\n");
  await put("docs/fancybox.md", "# FancyBox\n\nUse `FancyBox`.\n");
  await put("tsconfig.json", JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@fixture/ui": ["packages/ui/index.ts"] } }, references: [] }));
  git(["add", "-A"]); git(["commit", "-m", "first"]); firstCommit = git(["rev-parse", "HEAD"]);
  await scanCatalog({ labRoot: lab, frameworkId: "fixture" });
  first = await extractSymbols({ labRoot: lab, frameworkId: "fixture", maxDiagnostics: 100 });
  await put("packages/ui/src/component.ts", (await readFile(path.join(source, "packages/ui/src/component.ts"), "utf8")).replace("method(value: T): T", "method(value: T, flag?: boolean): T"));
  await rename(path.join(source, "packages/ui/src/lazy.ts"), path.join(source, "packages/ui/src/moved.ts"));
  await put("packages/ui/src/new.ts", "export class Added {}\n");
  git(["add", "-A"]); git(["commit", "-m", "second"]); secondCommit = git(["rev-parse", "HEAD"]);
  await scanCatalog({ labRoot: lab, frameworkId: "fixture" });
  second = await extractSymbols({ labRoot: lab, frameworkId: "fixture", maxDiagnostics: 100 });
  symbolDiff = await diffSymbols(lab, "fixture", first.snapshotId, second.snapshotId);
});
after(async () => { if (lab) await rm(lab, { recursive: true, force: true }); });
const symbols = () => first.data.symbols.symbols;
const imports = () => first.data.exports.imports;
const exportsList = () => first.data.exports.exports;
const named = (name: string) => symbols().filter((item) => item.name === name);

test("TS module 提取", () => assert.ok(first.data.modules.modules.some((m) => m.path.endsWith("component.ts"))));
test("TSX module 提取", () => assert.equal(first.data.modules.modules.find((m) => m.path.endsWith("view.tsx"))?.scriptKind, "TSX"));
test("只消费 Catalog 文件", () => assert.deepEqual(first.data.analysis.files, first.data.modules.modules.map((m) => m.path)));
test("class 提取", () => assert.equal(named("FancyBox")[0]?.kind, "class"));
test("interface 提取", () => assert.equal(named("FancyBoxProps")[0]?.kind, "interface"));
test("type alias 提取", () => assert.equal(named("Size")[0]?.kind, "type_alias"));
test("enum 提取", () => assert.equal(named("Mode")[0]?.kind, "enum"));
test("function overload 分别记录", () => assert.equal(named("helper").length, 2));
test("variable export", () => assert.equal(named("version")[0]?.exported, true));
test("class members", () => assert.ok((named("FancyBox")[0]?.members.length ?? 0) >= 5));
test("private visibility", () => assert.equal(named("secret")[0]?.visibility, "private"));
test("static readonly", () => assert.equal(named("tag")[0]?.static && named("tag")[0]?.readonly, true));
test("optional property", () => assert.equal(named("optional")[0]?.optional, true));
test("generics", () => assert.deepEqual(named("FancyBox")[0]?.typeParameters, ["T"]));
test("parameters 与 return type", () => assert.equal(named("method")[0]?.returnType, "T"));
test("heritage extends", () => assert.ok(named("FancyBox")[0]?.heritage.includes("BaseElement")));
test("implements 语法记录", () => assert.ok(named("FancyBox")[0]?.signature.includes("implements NamedType")));
test("JSDoc", () => assert.equal(named("FancyBox")[0]?.jsDoc.summary, "A fixture component."));
test("deprecated tag", () => assert.equal(named("FancyBox")[0]?.jsDoc.deprecated, true));
test("稳定 signature", () => assert.equal(named("FancyBox")[0]?.signature, "class FancyBox<T> extends BaseElement implements NamedType"));
test("declaration hash", () => assert.match(named("FancyBox")[0]?.declarationSha256 ?? "", /^[a-f0-9]{64}$/u));
test("default import", () => assert.ok(imports().some((i) => i.importedName === "default" && i.localName === "BaseDefault")));
test("named import", () => assert.ok(imports().some((i) => i.importedName === "BaseElement" && i.localName === "BaseElement")));
test("type-only named import", () => assert.ok(imports().some((i) => i.importedName === "Named" && i.typeOnly)));
test("namespace import", () => assert.ok(imports().some((i) => i.importedName === "*" && i.localName === "NS")));
test("import equals", () => assert.ok(imports().some((i) => i.localName === "Equals" && i.sourceSpecifier === "./lazy")));
test("side-effect import", () => assert.ok(imports().some((i) => i.sourceSpecifier === "./style.css" && i.localName === null)));
test("dynamic static import", () => assert.ok(imports().some((i) => i.sourceSpecifier === "./lazy")));
test("direct export", () => assert.ok(exportsList().some((e) => e.exportedName === "helper")));
test("default export", () => assert.ok(exportsList().some((e) => e.exportedName === "default")));
test("named re-export", () => assert.ok(exportsList().some((e) => e.exportedName === "FancyBox" && e.reExport)));
test("export star", () => assert.ok(exportsList().some((e) => e.exportedName === "*")));
test("namespace re-export", () => assert.ok(exportsList().some((e) => e.exportedName === "Types" && e.localName === "*")));
test("alias export", () => assert.ok(exportsList().some((e) => e.exportedName === "aliasHelper")));
test("export cycle 有终止保护", () => assert.ok(named("CycleValue")[0]?.publicReachable));
test("export name collision 记录多个候选", () => assert.equal(named("Shared").filter((item) => item.publicReachable).length, 2));
test("export name collision diagnostic", () => assert.ok(first.data.diagnostics.diagnostics.some((item) => item.category === "duplicate_public_export")));
test("public package entry", () => assert.ok(named("FancyBox")[0]?.publicPackages.includes("@fixture/ui")));
test("public export chain", () => assert.ok((named("FancyBox")[0]?.shortestExportChain?.length ?? 0) > 2));
test("unresolved import diagnostic", () => assert.ok(first.data.diagnostics.diagnostics.some((d) => d.category === "module_resolution")));
test("semantic analysis attempted", () => assert.equal(first.data.analysis.semanticAvailable, true));
test("逐模块 semantic diagnostic 计数", () => assert.ok(first.data.modules.modules.some((m) => m.semanticErrorCount > 0)));
test("组件基类检测", () => assert.equal(first.data.components.components[0]?.name, "FancyBox"));
test("组件路径信号", () => assert.ok(first.data.components.components[0]?.detectionReasons.includes("configured source path")));
test("组件公共导出信号", () => assert.ok(first.data.components.components[0]?.detectionReasons.includes("reachable from configured public package")));
test("组件高置信度", () => assert.equal(first.data.components.components[0]?.detectionConfidence, "high"));
test("非组件 PascalCase 不误判", () => assert.ok(!first.data.components.components.some((c) => c.name === "BaseElement")));
test("props 显式 interface", () => assert.equal(first.data.components.components[0]?.props.length, 1));
test("methods/properties", () => assert.ok((first.data.components.components[0]?.methods.length ?? 0) > 0));
test("lifecycle 配置", () => assert.deepEqual(first.data.components.components[0]?.lifecycleMethods, ["connectedCallback"]));
test("style pattern", () => assert.deepEqual(first.data.components.components[0]?.styles, ["packages/ui/src/style.css"]));
test("style 静态 import 不产生跨目录猜测", () => assert.ok(first.data.components.components[0]?.styles.includes("packages/ui/src/style.css")));
test("example 关联", () => assert.ok((first.data.components.components[0]?.examples.length ?? 0) > 0));
test("document 关联", () => assert.deepEqual(first.data.components.components[0]?.documents, []));
test("example import relation", () => assert.ok(first.data.relationships.relationships.some((r) => r.type === "example_imports_symbol")));
test("example use relation", () => assert.ok(first.data.relationships.relationships.some((r) => r.type === "example_uses_symbol")));
test("document inline code relation", () => assert.ok(first.data.relationships.relationships.some((r) => r.type === "document_mentions_symbol")));
test("普通文本短词不误关联", () => assert.ok(!first.data.relationships.relationships.some((r) => r.type === "document_mentions_symbol" && r.to === "Button")));
test("symbol type reference relation", () => assert.ok(first.data.relationships.relationships.some((r) => r.type === "symbol_references_type")));
test("symbol alias relation", () => assert.ok(first.data.relationships.relationships.some((r) => r.type === "symbol_aliases_symbol")));
test("提取耗时记录真实非负值", () => assert.ok(Number(first.data.statistics.extractionDurationMs) >= 0));
test("Symbol rootHash 稳定格式", () => assert.match(first.rootHash, /^sha256:[a-f0-9]{64}$/u));
test("Manifest SHA256 校验", async () => assert.deepEqual((await validateSymbols(lab, "fixture")).errors, []));
test("Catalog rootHash 错误拒绝", async () => {
  const snapshotFile = path.join(lab, "frameworks/fixture/catalog/snapshots", second.snapshotId, "snapshot.json");
  const original = await readFile(snapshotFile, "utf8");
  const changed = JSON.parse(original) as { rootHash: string };
  changed.rootHash = `sha256:${"0".repeat(64)}`;
  await writeFile(snapshotFile, `${JSON.stringify(changed, null, 2)}\n`, "utf8");
  try { await assert.rejects(extractSymbols({ labRoot: lab, frameworkId: "fixture", dryRun: true }), /Catalog/u); }
  finally { await writeFile(snapshotFile, original, "utf8"); }
});
test("Catalog commit 不匹配拒绝", async () => {
  const mismatch = path.join(lab, "sources", "mismatch");
  execFileSync("git", ["clone", "--quiet", "--no-checkout", source, mismatch]);
  execFileSync("git", ["-C", mismatch, "checkout", "--quiet", firstCommit]);
  await assert.rejects(extractSymbols({ labRoot: lab, frameworkId: "fixture", sourceDir: mismatch, dryRun: true }), /commit/u);
});
test("query name", async () => assert.ok((await querySymbols(lab, "fixture", { name: "FancyBox" })).length > 0));
test("query kind", async () => assert.ok((await querySymbols(lab, "fixture", { kind: "interface" })).every((s) => s.kind === "interface")));
test("query package", async () => assert.ok((await querySymbols(lab, "fixture", { package: "@fixture/ui" })).length > 0));
test("query public only", async () => assert.ok((await querySymbols(lab, "fixture", { publicOnly: true })).every((s) => s.publicReachable)));
test("query component only", async () => assert.ok((await querySymbols(lab, "fixture", { componentOnly: true })).every((s) => s.name === "FancyBox")));
test("Diff module added", () => assert.ok((symbolDiff.modules as { added: string[] }).added.length > 0));
test("Diff signature changed", () => assert.ok((symbolDiff.symbols as { modified: string[] }).modified.length > 0));
test("Diff exact move", () => assert.ok((symbolDiff.symbols as { moved: unknown[] }).moved.length > 0));
test("Diff relationship changed", () => assert.ok("relationships" in symbolDiff));
test("重复提取一致", async () => assert.equal((await extractSymbols({ labRoot: lab, frameworkId: "fixture" })).rootHash, second.rootHash));
test("syntax-only fallback 保留语法结果", async () => {
  const result = await extractSymbols({ labRoot: lab, frameworkId: "fixture", syntaxOnly: true, dryRun: true });
  assert.equal(result.data.analysis.semanticAvailable, false);
  assert.ok(result.data.symbols.symbols.length > 0);
});
test("默认不覆盖一致 snapshot", async () => assert.equal((await extractSymbols({ labRoot: lab, frameworkId: "fixture" })).existed, true));
test("默认拒绝覆盖内容不一致 snapshot", async () => {
  const analysisFile = path.join(second.outputDir!, "analysis.json");
  const original = await readFile(analysisFile, "utf8");
  const changed = JSON.parse(original) as { rootHash: string };
  changed.rootHash = `sha256:${"f".repeat(64)}`;
  await writeFile(analysisFile, `${JSON.stringify(changed, null, 2)}\n`, "utf8");
  await assert.rejects(extractSymbols({ labRoot: lab, frameworkId: "fixture" }), /已存在/u);
  await extractSymbols({ labRoot: lab, frameworkId: "fixture", force: true });
});
test("force 只覆盖派生 snapshot", async () => {
  const catalogCurrent = await readFile(path.join(lab, "frameworks/fixture/catalog/current.json"), "utf8");
  await extractSymbols({ labRoot: lab, frameworkId: "fixture", force: true });
  assert.equal(await readFile(path.join(lab, "frameworks/fixture/catalog/current.json"), "utf8"), catalogCurrent);
});
test("dry-run 不写", async () => {
  const result = await extractSymbols({ labRoot: lab, frameworkId: "fixture", snapshotId: "dry-symbols", dryRun: true });
  assert.equal(result.outputDir, null); await assert.rejects(stat(path.join(lab, "frameworks/fixture/symbols/snapshots/dry-symbols")));
});
test("tracked dirty 拒绝", async () => {
  await put("packages/ui/src/new.ts", "export class Dirty {}\n");
  await assert.rejects(extractSymbols({ labRoot: lab, frameworkId: "fixture" }), /tracked dirty/u);
});
test("中文和空格路径", () => assert.ok(first.outputDir?.includes("symbols")));
test("source commit 精确绑定", () => {
  assert.equal(first.data.analysis.sourceCommit, firstCommit); assert.equal(second.data.analysis.sourceCommit, secondCommit);
});
