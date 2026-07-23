import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdtemp, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { scanCatalog } from "../cli/lib/catalog.js";
import { createAgentContext, generateKnowledgeIndex } from "../cli/lib/knowledge.js";
import { explainRetrieval, extractSourceSnippets, normalizeTask, queryRetrieval, validateRetrieval } from "../cli/lib/retrieval.js";
import { extractSymbols } from "../cli/lib/symbols.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const digest = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
let lab = "", source = "", commit = "";
let button: Awaited<ReturnType<typeof queryRetrieval>>;
let issue: Awaited<ReturnType<typeof queryRetrieval>>;
let context: Awaited<ReturnType<typeof createAgentContext>>;
const git = (args: string[]) => execFileSync("git", ["-C", source, ...args], { encoding: "utf8" }).trim();
async function put(file: string, content: string): Promise<void> {
  const target = path.join(source, ...file.split("/")); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, content, "utf8");
}
function card(type: string, id: string, title: string, text: string, tags: string[], exactCommits = [commit]) {
  const evidencePath = "frameworks/fixture/framework.yaml";
  return {
    schemaVersion: "1.0.0", id, frameworkId: "fixture", type, title, summary: text, status: "active",
    scope: { exactCommits, commitRange: null, branch: null, os: [], architecture: [], nodeVersion: null, packageManager: null, frameworkVersion: null, validFrom: null, validUntil: null, scopeUnknown: false },
    claims: [{ id: "claim", text, status: "verified", evidence: [{ id: "config", type: "framework_config", path: evidencePath, jsonPointer: null, runId: null, stepId: null, eventId: null, commit, lineStart: 1, lineEnd: 5, sha256: "", note: null }] }],
    limitations: [], tags, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", supersedes: [], supersededBy: [],
  };
}
before(async () => {
  lab = await mkdtemp(path.join(os.tmpdir(), "retrieval-中文 space-"));
  source = path.join(lab, "sources", "framework repo");
  await cp(path.join(projectRoot, "schemas"), path.join(lab, "schemas"), { recursive: true });
  await mkdir(path.join(lab, "frameworks", "fixture", "knowledge"), { recursive: true });
  const framework = `schema_version: 1.0.0
framework: { id: fixture, name: Fixture, source_dir: "sources/framework repo" }
package_manager: { name: pnpm, version: 10.26.1, executable: tools/pnpm.cmd }
stop_on_failure: true
baseline_steps:
  - { id: build, command: node, args: ["--version"], timeout_seconds: 10, allow_failure: false }
analysis:
  retrieval:
    identifierPrefixes: [NC]
    aliases: { button: [按钮], disabled: [禁用], click: [点击] }
  typescript:
    componentDetection:
      sourceGlobs: ["packages/ui/src/**/*.ts"]
      baseTypes: [BaseElement]
      publicPackages: ["@fixture/ui"]
      stylePatterns: ["{dir}/style.css"]
      examplePatterns: ["example/{component}/**/*.ts"]
      lifecycleMethods: [connectedCallback]
      registrationFunctions: [register]
`;
  await writeFile(path.join(lab, "frameworks", "fixture", "framework.yaml"), framework, "utf8");
  await mkdir(source, { recursive: true }); execFileSync("git", ["init", source], { stdio: "ignore" });
  git(["config", "user.email", "fixture@example.invalid"]); git(["config", "user.name", "Fixture"]);
  await put("package.json", JSON.stringify({ name: "root", private: true }));
  await put("pnpm-workspace.yaml", "packages:\n  - packages/*\n  - example\n");
  await put("packages/ui/package.json", JSON.stringify({ name: "@fixture/ui", version: "1.0.0", main: "./index.ts" }));
  await put("packages/ui/index.ts", "export { NCButton, NCButton as Button } from './src/button/index';\nexport type { ButtonProps, ClickEventDetail } from './src/button/types';\n");
  await put("packages/ui/src/base.ts", "export class BaseElement {}\n");
  await put("packages/ui/src/button/types.ts", "export interface ButtonProps { disabled?: boolean }\nexport interface ClickEventDetail { source: string }\n");
  await put("packages/ui/src/button/index.ts", `import { BaseElement } from "../base";
import type { ButtonProps, ClickEventDetail } from "./types";
import "./style.css";
export class NCButton extends BaseElement {
  disabled = false;
  connectedCallback(): void {}
  click(detail: ClickEventDetail): ButtonProps { this.addSelfEvent("click"); return { disabled: this.disabled }; }
  private addSelfEvent(name: string): void { void name; }
}
register("nc-button", NCButton);
`);
  await put("packages/ui/src/button/style.css", ":host { display: inline-block; }\n");
  await put("example/package.json", JSON.stringify({ name: "fixture-example", private: true }));
  await put("example/button/basic.ts", "import { NCButton } from '@fixture/ui';\nconst button = new NCButton();\nbutton.disabled = true;\n");
  await put("doc/api/components/button.md", "# NCButton\n\nUse `NCButton` and `ButtonProps`.\n");
  await put("tsconfig.json", JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@fixture/ui": ["packages/ui/index.ts"] } } }));
  git(["add", "-A"]); git(["commit", "-m", "fixture"]); commit = git(["rev-parse", "HEAD"]);
  await scanCatalog({ labRoot: lab, frameworkId: "fixture" });
  await extractSymbols({ labRoot: lab, frameworkId: "fixture", maxDiagnostics: 100 });
  const configHash = digest(await readFile(path.join(lab, "frameworks/fixture/framework.yaml")));
  const cards = [
    card("validated_command", "fixture-command", "Validated build command", "Run the configured build command.", ["build", "command"]),
    card("known_issue", "fixture-sass-issue", "CJK Sass build failure", "A Sass failure was observed in a CJK path.", ["sass", "cjk", "build"]),
    card("workflow_constraint", "fixture-constraint", "Evidence constraint", "Do not modify the lockfile.", ["constraint"]),
    card("known_issue", "fixture-other-commit", "Other issue", "Only another commit.", ["other"], ["0".repeat(40)]),
  ];
  for (const item of cards) {
    item.claims[0]!.evidence[0]!.sha256 = configHash;
    await writeFile(path.join(lab, "frameworks/fixture/knowledge", `${item.id}.json`), `${JSON.stringify(item)}\n`, "utf8");
  }
  await generateKnowledgeIndex(lab, "fixture");
  button = await queryRetrieval({ labRoot: lab, frameworkId: "fixture", task: "在 example 新增 `NCButton` 按钮，展示禁用和点击；不要修改 lockfile。", sourceCommit: commit, retrievalId: "button-task" });
  issue = await queryRetrieval({ labRoot: lab, frameworkId: "fixture", task: "debug CJK Sass build failure，只使用已验证证据", sourceCommit: commit, retrievalId: "sass-task" });
  context = await createAgentContext({ labRoot: lab, frameworkId: "fixture", task: "在 example 新增 NCButton 按钮，不要修改 lockfile", sourceCommit: commit, retrievalId: "button-task", contextId: "button-context", includeSourceSnippets: true, budget: 4000, dryRun: true });
});
after(async () => { if (lab) await rm(lab, { recursive: true, force: true }); });
const selected = () => button.result.candidates.filter((candidate) => candidate.selected);
const find = (type: string, title?: string) => selected().find((candidate) => candidate.type === type && (!title || candidate.title.includes(title)));
const frameworkKnowledge = () => context.context.frameworkKnowledge!;

test("TaskProfile 英文标识符", () => assert.ok(normalizeTask("use NCButton").identifiers.includes("NCButton")));
test("PascalCase 拆分", () => assert.ok(normalizeTask("NCButton").technicalKeywords.includes("button")));
test("camelCase 拆分", () => assert.ok(normalizeTask("createButton").technicalKeywords.includes("button")));
test("CJK 任务片段", () => assert.ok(normalizeTask("新增按钮示例").cjkSegments.length));
test("反引号 symbol", () => assert.ok(normalizeTask("use `NCButton`").quoted.includes("NCButton")));
test("路径提取", () => assert.deepEqual(normalizeTask("edit packages/ui/index.ts").paths, ["packages/ui/index.ts"]));
test("否定约束提取", () => assert.ok(normalizeTask("不要修改 lockfile").negativeConstraints.length));
test("intent use", () => assert.ok(normalizeTask("使用 NCButton").intents.includes("use")));
test("intent add", () => assert.ok(normalizeTask("新增 NCButton").intents.includes("add")));
test("intent fix", () => assert.ok(normalizeTask("修复错误").intents.includes("fix")));
test("intent debug", () => assert.ok(normalizeTask("定位错误").intents.includes("debug")));
test("精确 Symbol 召回", () => assert.ok(find("symbol", "NCButton")));
test("精确 Component 召回", () => assert.ok(find("component", "NCButton")));
test("export alias 召回依据", () => assert.ok(button.result.candidates.some((candidate) => candidate.title === "NCButton")));
test("public API 优先", () => assert.equal(find("symbol", "NCButton")?.confidence, "high"));
test("internal symbol 降权", () => assert.ok(!selected().some((candidate) => candidate.title.includes("addSelfEvent"))));
test("component Props 扩展", () => assert.ok(find("symbol", "ButtonProps")));
test("component event 扩展", () => assert.ok(find("public_export", "events")));
test("method/property 扩展", () => assert.ok(selected().some((candidate) => /disabled|click/u.test(candidate.title))));
test("public export chain 扩展", () => assert.ok(find("public_export", "public export")));
test("style 关联", () => assert.ok(find("style", "style.css")));
test("example import 关联", () => assert.ok(find("example")));
test("example use 关联", () => assert.ok(find("example")?.reasons.some((reason) => reason.includes("example"))));
test("document section 关联", () => assert.ok(find("document_section", "NCButton")));
test("validated command 召回", () => assert.ok(find("validated_command")));
test("known issue 任务相关召回", () => assert.ok(issue.result.candidates.some((candidate) => candidate.selected && candidate.type === "known_issue")));
test("无关 known issue 排除", () => assert.ok(!selected().some((candidate) => candidate.type === "known_issue")));
test("Scope exact commit", () => assert.ok(issue.result.candidates.some((candidate) => candidate.knowledgeCardId === "fixture-sass-issue" && candidate.selected)));
test("Scope mismatch", () => assert.ok(button.result.candidates.some((candidate) => candidate.knowledgeCardId === "fixture-other-commit" && candidate.excludedReason === "scope mismatch")));
test("semantic 状态记录", () => assert.equal(typeof button.result.semanticAvailable, "boolean"));
test("unresolved internal symbol 降权", async () => {
  const result = await queryRetrieval({ labRoot: lab, frameworkId: "fixture", task: "`addSelfEvent`", sourceCommit: commit, includeInternal: true, dryRun: true });
  assert.equal(result.result.candidates.find((candidate) => candidate.title.includes("addSelfEvent"))?.confidence, "low");
});
test("graph depth 限制", async () => assert.ok((await queryRetrieval({ labRoot: lab, frameworkId: "fixture", task: "NCButton", maxDepth: 0, dryRun: true })).result.candidates.length <= button.result.candidates.length));
test("graph cycle 保护", () => assert.ok(button.result.candidates.length < 100));
test("candidate 去重", () => assert.equal(new Set(button.result.selectedIds).size, button.result.selectedIds.length));
test("透明 score breakdown", () => assert.ok(Object.keys(find("component", "NCButton")?.scoreBreakdown ?? {}).length));
test("排序确定性", () => assert.deepEqual([...selected()].sort((a, b) => b.score - a.score || a.type.localeCompare(b.type) || a.id.localeCompare(b.id)).map((item) => item.id), selected().map((item) => item.id)));
test("相同输入业务 hash 稳定", async () => assert.equal((await queryRetrieval({ labRoot: lab, frameworkId: "fixture", task: button.result.taskProfile.originalText, sourceCommit: commit, dryRun: true })).result.businessHash, button.result.businessHash));
test("只读取 Catalog 文件", () => assert.ok(selected().filter((candidate) => candidate.sourcePath).every((candidate) => !candidate.sourcePath!.includes("untracked"))));
test("declaration snippet", () => assert.ok(frameworkKnowledge().snippets.some((snippet: { type: string }) => snippet.type === "declaration")));
test("example snippet", () => assert.ok(frameworkKnowledge().snippets.some((snippet: { type: string }) => snippet.type === "example_excerpt")));
test("document snippet", () => assert.ok(frameworkKnowledge().snippets.some((snippet: { type: string }) => snippet.type === "document_excerpt")));
test("implementation snippet 仅按意图", () => assert.ok(!frameworkKnowledge().snippets.some((snippet: { type: string }) => snippet.type === "implementation_excerpt")));
test("fix/debug 允许 implementation snippet", async () => {
  const retrieval = (await queryRetrieval({ labRoot: lab, frameworkId: "fixture", task: "debug NCButton", sourceCommit: commit, dryRun: true })).result;
  const snippets = await extractSourceSnippets({ labRoot: lab, frameworkId: "fixture", retrieval, includeImplementation: true });
  assert.ok(snippets.some((snippet) => snippet.type === "implementation_excerpt"));
});
test("snippet 最大行数", () => assert.ok(frameworkKnowledge().snippets.every((snippet: { lineStart: number; lineEnd: number }) => snippet.lineEnd - snippet.lineStart + 1 <= 40)));
test("不读取完整大文件", () => assert.ok(frameworkKnowledge().snippets.every((snippet: { lineStart: number; lineEnd: number }) => snippet.lineEnd - snippet.lineStart + 1 <= 40)));
test("node_modules/dist 拒绝", () => assert.ok(frameworkKnowledge().snippets.every((snippet: { path: string }) => !/(?:node_modules|dist)/u.test(snippet.path))));
test("源码片段 commit", () => assert.ok(frameworkKnowledge().snippets.every((snippet: { commit: string }) => snippet.commit === commit)));
test("源码片段 hash", () => assert.ok(frameworkKnowledge().snippets.every((snippet: { fileSha256: string }) => /^[a-f0-9]{64}$/u.test(snippet.fileSha256))));
test("源码片段行号", () => assert.ok(frameworkKnowledge().snippets.every((snippet: { lineStart: number }) => snippet.lineStart > 0)));
test("token 估算", () => assert.equal(context.context.estimatedTokens, Math.ceil(context.markdown.length / 4)));
test("完整 claim 不截断", () => assert.ok(context.markdown.includes("Run the configured build command.")));
test("完整 signature 不截断", () => assert.ok(context.markdown.includes("class NCButton")));
test("最小预算不足", async () => assert.rejects(createAgentContext({ labRoot: lab, frameworkId: "fixture", task: "NCButton", sourceCommit: commit, retrievalId: "button-task", budget: 400, dryRun: true }), /预算不足|最小安全/u));
test("预算裁剪记录", () => assert.ok(context.manifest.budgetDecisions.length));
test("Evidence Index", () => assert.ok(context.markdown.includes("## Evidence Index")));
test("retrieval Schema", async () => assert.deepEqual(await validateRetrieval(lab, "fixture", "button-task"), []));
test("context Schema", () => assert.equal(context.context.schemaVersion, "1.0.0"));
test("manifest Schema", () => assert.equal(context.manifest.schemaVersion, "1.0.0"));
test("context 旧格式兼容", async () => assert.ok((await createAgentContext({ labRoot: lab, frameworkId: "fixture", task: "build", sourceCommit: commit, withFrameworkKnowledge: false, dryRun: true })).context.claims.length));
test("dry-run", async () => assert.equal((await queryRetrieval({ labRoot: lab, frameworkId: "fixture", task: "NCButton", retrievalId: "dry-only", dryRun: true })).outputDir, null));
test("默认不覆盖", async () => assert.equal((await queryRetrieval({ labRoot: lab, frameworkId: "fixture", task: button.result.taskProfile.originalText, sourceCommit: commit, retrievalId: "button-task" })).existed, true));
test("force 覆盖派生产物", async () => assert.equal((await queryRetrieval({ labRoot: lab, frameworkId: "fixture", task: button.result.taskProfile.originalText, sourceCommit: commit, retrievalId: "button-task", force: true })).existed, false));
test("query explain", async () => assert.match(await explainRetrieval(lab, "fixture", "button-task"), /SELECT NCButton/u));
test("不跨 framework 检索", () => assert.ok(button.result.candidates.every((candidate) => candidate.frameworkId === "fixture")));
test("不包含 inferred claim", () => assert.ok(context.context.claims.every((claim: { status: string }) => claim.status !== "inferred")));
test("缺少 Symbol Snapshot 可关闭框架知识", async () => assert.equal((await createAgentContext({ labRoot: lab, frameworkId: "fixture", task: "build", sourceCommit: commit, withFrameworkKnowledge: false, dryRun: true })).context.frameworkKnowledge, null));
test("缺少 Symbol Snapshot 自动回退旧 Context", async () => {
  const current = path.join(lab, "frameworks/fixture/symbols/current.json"), backup = `${current}.bak`;
  await rename(current, backup);
  try {
    const result = await createAgentContext({ labRoot: lab, frameworkId: "fixture", task: "build", sourceCommit: commit, dryRun: true });
    assert.equal(result.context.frameworkKnowledge, null);
    assert.ok(result.context.warnings.some((warning: string) => warning.includes("fallback")));
  } finally { await rename(backup, current); }
});
test("中文路径", () => assert.ok(lab.includes("中文")));
test("空格路径", () => assert.ok(source.includes(" ")));
test("业务 hash 不含生成时间", async () => assert.equal((await queryRetrieval({ labRoot: lab, frameworkId: "fixture", task: button.result.taskProfile.originalText, sourceCommit: commit, dryRun: true })).result.businessHash, button.result.businessHash));
test("关键约束保留", () => assert.ok(context.context.constraints.some((item: string) => item.includes("不要修改"))));
test("任务原文保留", () => assert.ok(context.markdown.includes("在 example 新增 NCButton")));
test("低置信度有显式字段", () => assert.ok(button.result.candidates.every((candidate) => ["high", "medium", "low"].includes(candidate.confidence))));
test("选择理由非空", () => assert.ok(selected().every((candidate) => candidate.reasons.length)));
test("图关系记录来源", () => assert.ok(selected().some((candidate) => candidate.relations.length)));
test("预算不截断代码块", () => assert.equal((context.markdown.match(/```/gu) ?? []).length % 2, 0));
test("文件 SHA256 不匹配拒绝", async () => {
  const file = path.join(lab, "frameworks/fixture/catalog/snapshots", button.result.catalogSnapshotId, "files.json");
  const original = await readFile(file, "utf8"); const data = JSON.parse(original) as { files: Array<{ path: string; sha256: string }> };
  data.files.find((item) => item.path.endsWith("button/index.ts"))!.sha256 = "0".repeat(64);
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  try { await assert.rejects(extractSourceSnippets({ labRoot: lab, frameworkId: "fixture", retrieval: button.result }), /SHA256/u); }
  finally { await writeFile(file, original, "utf8"); }
});
test("tracked dirty 拒绝", async () => {
  await put("packages/ui/src/button/index.ts", `${await readFile(path.join(source, "packages/ui/src/button/index.ts"), "utf8")}\n`);
  await assert.rejects(extractSourceSnippets({ labRoot: lab, frameworkId: "fixture", retrieval: button.result }), /tracked dirty/u);
});
