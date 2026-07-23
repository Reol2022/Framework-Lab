import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { createAgentContext, generateKnowledgeIndex, loadKnowledgeCards, validateKnowledge } from "../cli/lib/knowledge.js";
import { validateWithSchema } from "../cli/lib/schema.js";

const root = path.resolve(import.meta.dirname, "..");

test("六张 NCom KnowledgeCard 通过校验", async () => {
  const result = await validateKnowledge(root, "ncom");
  assert.equal(result.errors.length, 0);
  assert.equal(result.cards.length, 6);
});
test("所有 claim 均有证据", async () => {
  const cards = await loadKnowledgeCards(root, "ncom");
  assert.ok(cards.every((card) => card.claims.every((claim) => claim.evidence.length > 0)));
});
test("card id 唯一", async () => {
  const cards = await loadKnowledgeCards(root, "ncom");
  assert.equal(new Set(cards.map((card) => card.id)).size, cards.length);
});
test("claim id 在卡片内唯一", async () => {
  const cards = await loadKnowledgeCards(root, "ncom");
  assert.ok(cards.every((card) => new Set(card.claims.map((claim) => claim.id)).size === card.claims.length));
});
test("知识卡不含机器绝对路径", async () => {
  const cards = await loadKnowledgeCards(root, "ncom");
  assert.doesNotMatch(JSON.stringify(cards), /[A-Za-z]:[\\/]|C:\\\\Users/u);
});
test("scope 使用精确 commit", async () => {
  const cards = await loadKnowledgeCards(root, "ncom");
  assert.ok(cards.every((card) => card.scope.exactCommits.includes("a350b576bbeae6c6254273037a17d2a8730fb80f")));
});
test("知识索引排序稳定", async () => {
  const index = await generateKnowledgeIndex(root, "ncom");
  assert.deepEqual(index.cards.map((card: { id: string }) => card.id), [...index.cards.map((card: { id: string }) => card.id)].sort());
});
test("知识索引业务 hash 稳定", async () => {
  const first = await generateKnowledgeIndex(root, "ncom");
  const second = await generateKnowledgeIndex(root, "ncom");
  assert.equal(first.indexSha256, second.indexSha256);
});
test("Run 009 自动推导并选择 Sass known issue", async () => {
  const result = await createAgentContext({ labRoot: root, frameworkId: "ncom", task: "分析构建失败", runId: "run-009", dryRun: true });
  assert.ok(result.context.selectedCards.includes("ncom-run009-cjk-sass-issue"));
  assert.equal(result.context.sourceScope.commit, "a350b576bbeae6c6254273037a17d2a8730fb80f");
});
test("Run 010 选择 verified patch", async () => {
  const result = await createAgentContext({ labRoot: root, frameworkId: "ncom", task: "验证 CJK Sass 补丁", runId: "run-010", dryRun: true });
  assert.ok(result.context.selectedCards.includes("ncom-run010-verified-patch"));
});
test("Run 010 上下文保留 lint 与浏览器限制", async () => {
  const result = await createAgentContext({ labRoot: root, frameworkId: "ncom", task: "验证 CJK Sass 补丁", runId: "run-010", dryRun: true });
  assert.match(result.markdown, /lint 仍失败/u);
  assert.match(result.markdown, /浏览器与功能回归未验证/u);
});
test("显式 exclude 生效并写入 manifest", async () => {
  const result = await createAgentContext({ labRoot: root, frameworkId: "ncom", task: "验证补丁", runId: "run-010", excludeCards: ["ncom-run010-verified-patch"], dryRun: true });
  assert.ok(result.manifest.excludedCards.some((item) => item.id === "ncom-run010-verified-patch"));
});
test("显式 include 进入 manifest", async () => {
  const result = await createAgentContext({ labRoot: root, frameworkId: "ncom", task: "其他", runId: "run-010", includeCards: ["ncom-framework-overview"], dryRun: true });
  assert.ok(result.context.selectedCards.includes("ncom-framework-overview"));
});
test("scope 不匹配卡片默认排除", async () => {
  const result = await createAgentContext({ labRoot: root, frameworkId: "ncom", task: "分析构建失败", sourceCommit: "0000000000000000000000000000000000000000", dryRun: true });
  assert.equal(result.context.selectedCards.length, 0);
});
test("非法 commit 返回错误", async () => {
  await assert.rejects(() => createAgentContext({ labRoot: root, frameworkId: "ncom", task: "x", sourceCommit: "bad", dryRun: true }), /非法/u);
});
test("最小预算不足返回错误", async () => {
  await assert.rejects(() => createAgentContext({ labRoot: root, frameworkId: "ncom", task: "x", budget: 10, dryRun: true }), /最小安全预算/u);
});
test("dry-run 不写 context 目录", async () => {
  const id = "dry-run-must-not-exist";
  await createAgentContext({ labRoot: root, frameworkId: "ncom", task: "验证补丁", runId: "run-010", contextId: id, dryRun: true });
  await assert.rejects(() => access(path.join(root, "frameworks", "ncom", "contexts", id)));
});
test("默认不覆盖已有 context", async () => {
  await assert.rejects(() => createAgentContext({ labRoot: root, frameworkId: "ncom", task: "分析构建失败", runId: "run-009", contextId: "run-009-build-failure" }), /--force/u);
});
test("真实 context JSON 均通过 Schema", async () => {
  for (const id of ["run-009-build-failure", "run-010-cjk-sass-patch"]) {
    const base = path.join(root, "frameworks", "ncom", "contexts", id);
    await validateWithSchema(root, "agent-context.schema.json", JSON.parse(await readFile(path.join(base, "context.json"), "utf8")));
    await validateWithSchema(root, "context-manifest.schema.json", JSON.parse(await readFile(path.join(base, "manifest.json"), "utf8")));
  }
});
test("context.md 每条 claim 带 evidence id", async () => {
  const markdown = await readFile(path.join(root, "frameworks", "ncom", "contexts", "run-009-build-failure", "context.md"), "utf8");
  assert.ok(markdown.split("\n").filter((line) => line.startsWith("- ") && !line.startsWith("- [E")).some((line) => /\[E\d+\]/u.test(line)));
});
test("正式上下文不含 inferred claim", async () => {
  const context = JSON.parse(await readFile(path.join(root, "frameworks", "ncom", "contexts", "run-010-cjk-sass-patch", "context.json"), "utf8"));
  assert.ok(context.claims.every((claim: { status: string }) => claim.status !== "inferred"));
});
test("manifest 记录选择和排除理由", async () => {
  const manifest = JSON.parse(await readFile(path.join(root, "frameworks", "ncom", "contexts", "run-010-cjk-sass-patch", "manifest.json"), "utf8"));
  assert.ok(manifest.selectedCards.every((item: { reason?: string }) => item.reason));
  assert.ok(manifest.excludedCards.every((item: { reason?: string }) => item.reason));
});
