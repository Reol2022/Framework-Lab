import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { scanCatalog } from "../cli/lib/catalog.js";
import { generateKnowledgeIndex } from "../cli/lib/knowledge.js";
import { extractSymbols } from "../cli/lib/symbols.js";
import {
  closeTask,
  compareTask,
  createTask,
  evaluateChangePolicy,
  handoffTask,
  inspectTask,
  listTasks,
  prepareTask,
  taskPathMatches,
  taskStatus,
  validateAcceptanceDocument,
  validateChangePolicy,
  validateTask,
  validateVerificationPlan,
  verifyTask,
  type AcceptanceDocument,
  type ChangePolicy,
  type InspectResult,
  type VerificationPlan,
} from "../cli/lib/task.js";
import { validateWithSchema } from "../cli/lib/schema.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
let lab = "", source = "", worktree = "", commit = "", port = 0;
const taskId = "task-controlled-demo";
const git = (cwd: string, args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();
async function put(root: string, file: string, content: string): Promise<void> {
  const target = path.join(root, ...file.split("/")); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, content, "utf8");
}

let acceptance: AcceptanceDocument;
let policy: ChangePolicy;
let plan: VerificationPlan;
let inspection: Awaited<ReturnType<typeof inspectTask>>;
let verification: Awaited<ReturnType<typeof verifyTask>>;
let comparison: Awaited<ReturnType<typeof compareTask>>;

before(async () => {
  lab = await mkdtemp(path.join(os.tmpdir(), "task-闭环 space-"));
  source = path.join(lab, "source repo");
  await cp(path.join(projectRoot, "schemas"), path.join(lab, "schemas"), { recursive: true });
  await mkdir(path.join(lab, "frameworks", "fixture", "knowledge"), { recursive: true });
  await mkdir(source, { recursive: true });
  execFileSync("git", ["init", source], { stdio: "ignore" });
  git(source, ["config", "user.email", "fixture@example.invalid"]);
  git(source, ["config", "user.name", "Fixture"]);
  await put(source, "package.json", JSON.stringify({ name: "fixture", private: true }));
  await put(source, "src/index.ts", "export const existing = true;\n");
  await put(source, "docs/readme.md", "# Fixture\n");
  await put(source, ".gitignore", "node_modules/\ndist/\n");
  git(source, ["add", "-A"]); git(source, ["commit", "-m", "fixture"]);
  commit = git(source, ["rev-parse", "HEAD"]);
  const framework = `schema_version: 1.0.0
framework:
  id: fixture
  name: Fixture
  source_dir: "${source.replaceAll("\\", "/")}"
package_manager:
  name: node
  version: "${process.version}"
  executable: "${process.execPath.replaceAll("\\", "/")}"
stop_on_failure: true
baseline_steps:
  - id: build
    command: "${process.execPath.replaceAll("\\", "/")}"
    args: ["--version"]
    timeout_seconds: 10
    allow_failure: false
analysis:
  retrieval:
    aliases:
      demo: [示例]
  typescript:
    componentDetection:
      sourceGlobs: ["src/**/*.ts"]
      baseTypes: []
      publicPackages: []
      stylePatterns: []
      examplePatterns: ["src/**/*.ts"]
`;
  await put(lab, "frameworks/fixture/framework.yaml", framework);
  await scanCatalog({ labRoot: lab, frameworkId: "fixture" });
  await extractSymbols({ labRoot: lab, frameworkId: "fixture" });
  const configHash = hash(await readFile(path.join(lab, "frameworks/fixture/framework.yaml")));
  const card = {
    schemaVersion: "1.0.0", id: "fixture-constraint", frameworkId: "fixture", type: "workflow_constraint",
    title: "Fixture constraint", summary: "Only edit src.", status: "active",
    scope: { exactCommits: [commit], commitRange: null, branch: null, os: [], architecture: [], nodeVersion: null, packageManager: null, frameworkVersion: null, validFrom: null, validUntil: null, scopeUnknown: false },
    claims: [{ id: "constraint", text: "Only edit src.", status: "verified", evidence: [{ id: "config", type: "framework_config", path: "frameworks/fixture/framework.yaml", jsonPointer: null, runId: null, stepId: null, eventId: null, commit, lineStart: 1, lineEnd: 5, sha256: configHash, note: null }] }],
    limitations: [], tags: ["constraint", "demo"], createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", supersedes: [], supersededBy: [],
  };
  await put(lab, "frameworks/fixture/knowledge/fixture-constraint.json", `${JSON.stringify(card)}\n`);
  await generateKnowledgeIndex(lab, "fixture");
  port = 39_000 + Math.floor(Math.random() * 1000);
  const criterion = (id: string, type: AcceptanceDocument["criteria"][number]["type"], expected: Record<string, unknown>, automated = true): AcceptanceDocument["criteria"][number] => ({
    id, type, title: id, description: id, required: true, automated, status: "pending", evidence: [], expected, actual: null, evaluator: "framework-lab", warnings: [],
  });
  acceptance = {
    schemaVersion: "1.0.0",
    criteria: [
      criterion("source-change", "source_change", { glob: "src/**", minimumChangedFiles: 1 }),
      criterion("file-exists", "file_exists", { path: "src/new.ts" }),
      criterion("package-unchanged", "file_not_changed", { path: "package.json" }),
      criterion("path-allowed", "path_allowed", { paths: ["src/**"] }),
      criterion("path-denied", "path_denied", { paths: ["package.json", "pnpm-lock.yaml"] }),
      criterion("text-present", "text_present", { path: "src/new.ts", text: "observable" }),
      criterion("text-absent", "text_absent", { path: "src/new.ts", text: "alert(" }),
      criterion("symbol-used", "symbol_used", { path: "src/new.ts", symbol: "existing" }),
      criterion("command-passes", "command_passes", { stepId: "source-check" }),
      criterion("http-status", "http_status", { stepId: "http-check" }),
      criterion("manual-check", "manual_check", {}, false),
      criterion("browser-check", "browser_check", {}, false),
    ],
    summary: { passed: 0, failed: 0, pending: 12, skipped: 0, manualRequired: 0 },
  };
  policy = {
    schemaVersion: "1.0.0", allowedPaths: ["src/**"], deniedPaths: ["package.json", "pnpm-lock.yaml", "**/package.json"],
    maxChangedFiles: 3, maxAddedFiles: 2, maxDeletedFiles: 0, maxDiffLines: 80,
    allowUntrackedFiles: true, allowedUntrackedPaths: ["src/**"], deniedExtensions: [".bin"],
    requireCleanStart: true, lockfilesReadOnly: true, manifestsReadOnly: true,
    generatedDirectoriesIgnored: ["node_modules/**", "dist/**", "**/dist/**"],
    requirePatch: true, requireDiffCheck: true, requireNoConflictMarkers: true,
  };
  const node = process.execPath.replaceAll("\\", "/");
  plan = {
    schemaVersion: "1.0.0",
    steps: [
      { id: "source-check", type: "command", phase: "both", command: node, args: ["-e", "console.log('source ok')"], cwd: ".", timeoutSeconds: 10, allowFailure: false, required: true, dependencies: [], environment: {}, expectedExitCode: 0, expectedHttpStatus: null, outputLogs: null, status: "pending" },
      { id: "dev-server", type: "command", phase: "after", command: node, args: ["-e", `require('http').createServer((q,r)=>{r.end('ok')}).listen(${port},'127.0.0.1')`], cwd: ".", timeoutSeconds: 20, allowFailure: false, required: true, dependencies: ["source-check"], environment: {}, expectedExitCode: null, expectedHttpStatus: null, outputLogs: null, status: "pending", background: true },
      { id: "http-check", type: "http", phase: "after", command: `http://127.0.0.1:${port}/`, url: `http://127.0.0.1:${port}/`, args: [], cwd: ".", timeoutSeconds: 5, allowFailure: false, required: true, dependencies: ["dev-server"], environment: {}, expectedExitCode: null, expectedHttpStatus: 200, outputLogs: null, status: "pending" },
      { id: "optional-failure", type: "command", phase: "after", command: node, args: ["-e", "process.exit(2)"], cwd: ".", timeoutSeconds: 10, allowFailure: true, required: false, dependencies: ["source-check"], environment: {}, expectedExitCode: 0, expectedHttpStatus: null, outputLogs: null, status: "pending" },
      { id: "acceptance", type: "acceptance", phase: "after", command: null, args: [], cwd: ".", timeoutSeconds: 1, allowFailure: false, required: true, dependencies: ["http-check"], environment: {}, expectedExitCode: null, expectedHttpStatus: null, outputLogs: null, status: "pending" },
      { id: "manual-browser", type: "manual", phase: "after", command: null, args: [], cwd: ".", timeoutSeconds: 1, allowFailure: true, required: true, dependencies: ["acceptance"], environment: {}, expectedExitCode: null, expectedHttpStatus: null, outputLogs: null, status: "pending" },
    ],
  };
  const configDir = path.join(lab, "inputs"); await mkdir(configDir, { recursive: true });
  await Promise.all([
    writeFile(path.join(configDir, "acceptance.json"), `${JSON.stringify(acceptance)}\n`),
    writeFile(path.join(configDir, "policy.json"), `${JSON.stringify(policy)}\n`),
    writeFile(path.join(configDir, "plan.json"), `${JSON.stringify(plan)}\n`),
  ]);
});

after(async () => {
  if (lab) {
    try { git(source, ["worktree", "remove", "--force", worktree]); } catch { /* already removed */ }
    await rm(lab, { recursive: true, force: true });
  }
});

test("task create dry-run", async () => {
  const result = await createTask({ labRoot: lab, frameworkId: "fixture", task: "新增 observable demo", taskId: "task-dry-run", sourceCommit: commit, budget: 4000, dryRun: true });
  assert.equal(result.directory, null);
  await assert.rejects(stat(path.join(lab, "frameworks/fixture/tasks/task-dry-run")));
});
test("task create", async () => {
  const result = await createTask({
    labRoot: lab, frameworkId: "fixture", task: "新增 observable demo，不修改 package.json", taskId, sourceCommit: commit, budget: 4000,
    acceptanceFile: path.join(lab, "inputs/acceptance.json"), policyFile: path.join(lab, "inputs/policy.json"), verificationFile: path.join(lab, "inputs/plan.json"),
  });
  assert.equal(result.task.status, "draft");
});
test("task id 唯一", async () => assert.rejects(createTask({ labRoot: lab, frameworkId: "fixture", task: "duplicate", taskId, sourceCommit: commit }), /已存在/u));
test("task 默认不覆盖", async () => assert.rejects(createTask({ labRoot: lab, frameworkId: "fixture", task: "duplicate", taskId, sourceCommit: commit }), /不会覆盖/u));
test("source commit 绑定", async () => assert.equal((await taskStatus(lab, "fixture", taskId)).sourceCommit, commit));
test("task.json Schema", async () => validateWithSchema(lab, "task.schema.json", JSON.parse(await readFile(path.join(lab, `frameworks/fixture/tasks/${taskId}/task.json`), "utf8"))));
test("acceptance Schema", async () => validateWithSchema(lab, "acceptance.schema.json", acceptance));
test("policy Schema", async () => validateWithSchema(lab, "change-policy.schema.json", policy));
test("verification plan Schema", async () => validateWithSchema(lab, "verification-plan.schema.json", plan));
test("acceptance id 重复", () => assert.throws(() => validateAcceptanceDocument({ ...acceptance, criteria: [acceptance.criteria[0]!, acceptance.criteria[0]!] }), /唯一/u));
test("verification dependency 无循环", () => {
  const cycle = structuredClone(plan); cycle.steps[0]!.dependencies = ["manual-browser"];
  assert.throws(() => validateVerificationPlan(cycle), /循环/u);
});
test("verification 未知 dependency", () => {
  const unknown = structuredClone(plan); unknown.steps[0]!.dependencies = ["missing"];
  assert.throws(() => validateVerificationPlan(unknown), /未知/u);
});
test("policy 路径穿越拒绝", () => assert.throws(() => validateChangePolicy({ ...policy, allowedPaths: ["../src/**"] }), /安全/u));
test("policy 绝对路径拒绝", () => assert.throws(() => validateChangePolicy({ ...policy, allowedPaths: ["C:/src/**"] }), /安全/u));
test("glob 单星", () => assert.equal(taskPathMatches("src/a.ts", ["src/*.ts"]), true));
test("glob 单星不跨目录", () => assert.equal(taskPathMatches("src/a/b.ts", ["src/*.ts"]), false));
test("glob 双星", () => assert.equal(taskPathMatches("src/a/b.ts", ["src/**"]), true));
test("glob 双星目录", () => assert.equal(taskPathMatches("packages/a/package.json", ["**/package.json"]), true));
test("task validate", async () => assert.equal((await validateTask(lab, "fixture", taskId)).task.status, "validated"));
test("task validate 幂等", async () => assert.equal((await validateTask(lab, "fixture", taskId)).task.status, "validated"));
test("Context hash 校验", async () => assert.match((await readFile(path.join(lab, `frameworks/fixture/tasks/${taskId}/task.json`), "utf8")), /contextSha256/u));
test("Retrieval hash 引用", async () => assert.match((await readFile(path.join(lab, `frameworks/fixture/tasks/${taskId}/retrieval/retrieval.json`), "utf8")), /businessHash/u));
test("history draft validated", async () => assert.equal((await readFile(path.join(lab, `frameworks/fixture/tasks/${taskId}/task-history.jsonl`), "utf8")).trim().split(/\r?\n/u).length, 2));
test("prepare dry-run", async () => assert.match((await prepareTask({ labRoot: lab, frameworkId: "fixture", taskId, dryRun: true })).directory, /\.framework-sources\/tasks/u));
test("detached worktree 创建", async () => {
  const result = await prepareTask({ labRoot: lab, frameworkId: "fixture", taskId });
  worktree = path.resolve(lab, ...result.directory.split("/")); assert.equal(git(worktree, ["rev-parse", "--abbrev-ref", "HEAD"]), "HEAD");
});
test("HEAD commit 校验", () => assert.equal(git(worktree, ["rev-parse", "HEAD"]), commit));
test("clean initial worktree", async () => assert.equal((await readFile(path.join(lab, `frameworks/fixture/tasks/${taskId}/worktree.json`), "utf8")).includes('"initialTrackedClean": true'), true));
test("worktree 路径隔离", () => assert.notEqual(path.resolve(worktree), path.resolve(source)));
test("preflight package manager", async () => assert.match(await readFile(path.join(lab, `frameworks/fixture/tasks/${taskId}/preflight.json`), "utf8"), new RegExp(process.version.replaceAll(".", "\\."), "u")));
test("preflight Node", async () => assert.match(await readFile(path.join(lab, `frameworks/fixture/tasks/${taskId}/preflight.json`), "utf8"), /nodeVersion/u));
test("before verification", async () => assert.equal((await stat(path.join(lab, `frameworks/fixture/tasks/${taskId}/before/verification.json`))).isFile(), true));
test("before source clean", async () => assert.match(await readFile(path.join(lab, `frameworks/fixture/tasks/${taskId}/before/source.json`), "utf8"), /"dirty": false/u));
test("source repository 未修改", () => assert.equal(git(source, ["status", "--porcelain"]), ""));
test("task prepared status", async () => assert.equal((await taskStatus(lab, "fixture", taskId)).status, "prepared"));
test("handoff 生成", async () => assert.match((await handoffTask(lab, "fixture", taskId)).instructions, /Coding Agent Handoff/u));
test("handoff hash", async () => assert.match(await readFile(path.join(lab, `frameworks/fixture/tasks/${taskId}/handoff/handoff.json`), "utf8"), /instructionHash/u));
test("handoff 精确 commit", async () => assert.match(await readFile(path.join(lab, `frameworks/fixture/tasks/${taskId}/handoff/agent-instructions.md`), "utf8"), new RegExp(commit, "u")));
test("handoff 不 commit", async () => assert.match(await readFile(path.join(lab, `frameworks/fixture/tasks/${taskId}/handoff/agent-instructions.md`), "utf8"), /Do not commit/u));
test("handoff 不使用子 Agent", async () => assert.match(await readFile(path.join(lab, `frameworks/fixture/tasks/${taskId}/handoff/agent-instructions.md`), "utf8"), /Do not use sub-agents/u));
test("handoff 状态转换", async () => assert.equal((await taskStatus(lab, "fixture", taskId)).status, "handed_off"));
test("Agent 修改 fixture", async () => {
  await put(worktree, "src/index.ts", "export const existing = true;\nexport { observable } from './new';\n");
  await put(worktree, "src/new.ts", "import { existing } from './index';\nexport const observable = existing ? 'clicked' : 'idle';\n");
  await put(worktree, "dist/generated.js", "generated\n");
  assert.ok(git(worktree, ["status", "--porcelain"]).includes("src"));
});
test("inspect modified", async () => {
  inspection = await inspectTask(lab, "fixture", taskId);
  assert.ok(inspection.inspect.changedFiles.some((item) => item.status === "modified"));
});
test("inspect added", () => assert.ok(inspection.inspect.changedFiles.some((item) => item.status === "untracked")));
test("inspect changed count", () => assert.equal(inspection.inspect.counts.changed, 2));
test("generated directory 忽略", () => assert.ok(!inspection.inspect.changedFiles.some((item) => item.path.includes("dist/generated"))));
test("patch SHA256", async () => assert.equal((await readFile(path.join(lab, `frameworks/fixture/tasks/${taskId}/changes/patch.sha256`), "utf8")).trim(), inspection.inspect.patchSha256));
test("完整 patch 包含 tracked", async () => assert.match(await readFile(path.join(lab, `frameworks/fixture/tasks/${taskId}/changes/patch.diff`), "utf8"), /observable/u));
test("完整 patch 包含 untracked", async () => assert.match(await readFile(path.join(lab, `frameworks/fixture/tasks/${taskId}/changes/patch.diff`), "utf8"), /src\/new\.ts/u));
test("inspect 不信任 Agent 报告", async () => assert.equal(await stat(path.join(lab, `frameworks/fixture/tasks/${taskId}/changes/changed-files.json`)).then((item) => item.isFile()), true));
test("policy pass", () => assert.equal(inspection.policy.overallStatus, "passed"));
test("policy allow path", () => assert.ok(inspection.policy.passedRules.includes("allowed-paths")));
test("policy deny path", () => assert.ok(inspection.policy.passedRules.includes("denied-paths")));
test("max changed files", () => assert.ok(inspection.policy.passedRules.includes("max-changed-files")));
test("max added files", () => assert.ok(inspection.policy.passedRules.includes("max-added-files")));
test("max deleted files", () => assert.ok(inspection.policy.passedRules.includes("max-deleted-files")));
test("max diff lines", () => assert.ok(inspection.policy.passedRules.includes("max-diff-lines")));
test("lockfile read-only", () => assert.ok(inspection.policy.passedRules.includes("lockfiles-read-only")));
test("manifest read-only", () => assert.ok(inspection.policy.passedRules.includes("manifests-read-only")));
test("untracked 文件规则", () => assert.ok(inspection.policy.passedRules.includes("untracked-files")));
test("conflict marker", () => assert.ok(inspection.policy.passedRules.includes("no-conflict-markers")));
test("binary diff", () => assert.ok(inspection.policy.passedRules.includes("no-binary")));
test("不自动 commit", () => assert.equal(git(worktree, ["rev-parse", "HEAD"]), commit));
test("task modified status", async () => assert.equal((await taskStatus(lab, "fixture", taskId)).status, "modified"));

const fakeInspect = (files: InspectResult["changedFiles"], overrides: Partial<InspectResult> = {}): InspectResult => ({
  schemaVersion: "1.0.0", taskId: "fake", inspectedAt: new Date().toISOString(), head: commit, headMatchesBaseline: true,
  trackedStatus: [], untrackedStatus: [], generatedFiles: [], changedFiles: files,
  counts: { changed: files.length, added: files.filter((item) => ["added", "untracked"].includes(item.status)).length, modified: files.filter((item) => item.status === "modified").length, deleted: files.filter((item) => item.status === "deleted").length, renamed: files.filter((item) => item.status === "renamed").length, untracked: files.filter((item) => item.status === "untracked").length },
  diffLines: 1, patchSha256: "1".repeat(64), conflictMarkers: [], lockfilesChanged: [], manifestsChanged: [], binaryFiles: [], submodulesChanged: [], sourceFingerprint: "2".repeat(64), ...overrides,
});
const changed = (file: string, status: "added" | "modified" | "deleted" | "renamed" | "untracked" = "modified") => ({ path: file, status, oldPath: null, generated: false, binary: false });
test("deny 优先于 allow", () => assert.equal(evaluateChangePolicy(policy, fakeInspect([changed("package.json")], { manifestsChanged: ["package.json"] })).overallStatus, "failed"));
test("policy blocking fail", () => assert.ok(evaluateChangePolicy(policy, fakeInspect([changed("packages/a.ts")])).blockingViolations.length));
test("max changed files fail", () => assert.ok(evaluateChangePolicy({ ...policy, maxChangedFiles: 0 }, fakeInspect([changed("src/a.ts")])).failedRules.includes("max-changed-files")));
test("max added files fail", () => assert.ok(evaluateChangePolicy({ ...policy, maxAddedFiles: 0 }, fakeInspect([changed("src/a.ts", "added")])).failedRules.includes("max-added-files")));
test("max deleted files fail", () => assert.ok(evaluateChangePolicy(policy, fakeInspect([changed("src/a.ts", "deleted")])).failedRules.includes("max-deleted-files")));
test("max diff lines fail", () => assert.ok(evaluateChangePolicy({ ...policy, maxDiffLines: 0 }, fakeInspect([changed("src/a.ts")], { diffLines: 1 })).failedRules.includes("max-diff-lines")));
test("lockfile fail", () => assert.ok(evaluateChangePolicy(policy, fakeInspect([changed("pnpm-lock.yaml")], { lockfilesChanged: ["pnpm-lock.yaml"] })).failedRules.includes("lockfiles-read-only")));
test("manifest fail", () => assert.ok(evaluateChangePolicy(policy, fakeInspect([changed("package.json")], { manifestsChanged: ["package.json"] })).failedRules.includes("manifests-read-only")));
test("untracked fail", () => assert.ok(evaluateChangePolicy({ ...policy, allowUntrackedFiles: false }, fakeInspect([changed("src/new.ts", "untracked")])).failedRules.includes("untracked-files")));
test("conflict marker fail", () => assert.ok(evaluateChangePolicy(policy, fakeInspect([changed("src/a.ts")], { conflictMarkers: ["src/a.ts"] })).failedRules.includes("no-conflict-markers")));
test("binary fail", () => assert.ok(evaluateChangePolicy(policy, fakeInspect([{ ...changed("src/a.bin"), binary: true }], { binaryFiles: ["src/a.bin"] })).failedRules.includes("no-binary")));
test("HEAD changed fail", () => assert.ok(evaluateChangePolicy(policy, fakeInspect([changed("src/a.ts")], { headMatchesBaseline: false })).failedRules.includes("head-baseline")));
test("submodule fail", () => assert.ok(evaluateChangePolicy(policy, fakeInspect([changed("src/sub")], { submodulesChanged: ["src/sub"] })).failedRules.includes("no-submodule")));
test("verify dry-run", async () => assert.equal((await verifyTask({ labRoot: lab, frameworkId: "fixture", taskId, dryRun: true })).verification, null));
test("task verify", async () => {
  verification = await verifyTask({ labRoot: lab, frameworkId: "fixture", taskId });
  assert.equal(verification.verification?.status, "partial");
});
test("verification dependency 顺序", () => {
  const ids = verification.verification!.planSteps.map((item) => item.id);
  assert.ok(ids.indexOf("source-check") < ids.indexOf("dev-server") && ids.indexOf("dev-server") < ids.indexOf("http-check"));
});
test("verification allow failure", () => assert.equal(verification.verification!.planSteps.find((item) => item.id === "optional-failure")?.status, "failed"));
test("HTTP status criterion", () => assert.equal(verification.verification!.acceptance.criteria.find((item) => item.id === "http-status")?.status, "passed"));
test("static text criterion", () => assert.equal(verification.verification!.acceptance.criteria.find((item) => item.id === "text-present")?.status, "passed"));
test("text absent criterion", () => assert.equal(verification.verification!.acceptance.criteria.find((item) => item.id === "text-absent")?.status, "passed"));
test("file exists criterion", () => assert.equal(verification.verification!.acceptance.criteria.find((item) => item.id === "file-exists")?.status, "passed"));
test("file not changed criterion", () => assert.equal(verification.verification!.acceptance.criteria.find((item) => item.id === "package-unchanged")?.status, "passed"));
test("symbol used criterion", () => assert.equal(verification.verification!.acceptance.criteria.find((item) => item.id === "symbol-used")?.status, "passed"));
test("command passes criterion", () => assert.equal(verification.verification!.acceptance.criteria.find((item) => item.id === "command-passes")?.status, "passed"));
test("manual criterion", () => assert.equal(verification.verification!.acceptance.criteria.find((item) => item.id === "manual-check")?.status, "manual_required"));
test("browser criterion manual_required", () => assert.equal(verification.verification!.acceptance.criteria.find((item) => item.id === "browser-check")?.status, "manual_required"));
test("automated acceptance 汇总", () => assert.equal(verification.verification!.acceptance.summary.failed, 0));
test("partial 状态", async () => assert.equal((await taskStatus(lab, "fixture", taskId)).status, "verification_partial"));
test("after errors", async () => assert.equal((await stat(path.join(lab, `frameworks/fixture/tasks/${taskId}/after/errors.json`))).isFile(), true));
test("verification report", async () => assert.match(await readFile(path.join(lab, `frameworks/fixture/tasks/${taskId}/verification-report.md`), "utf8"), /Manual and browser checks/u));
test("before/after comparison", async () => {
  comparison = await compareTask(lab, "fixture", taskId); assert.equal(comparison.afterStatus, "partial");
});
test("compare conclusion", () => assert.equal(comparison.finalConclusion, "candidate_requires_manual_verification"));
test("comparison patch hash", () => assert.equal(comparison.patchSha256, inspection.inspect.patchSha256));
test("comparison changed files", () => assert.deepEqual(new Set(comparison.changedFiles as string[]), new Set(["src/index.ts", "src/new.ts"])));
test("new error", () => assert.ok(Array.isArray(comparison.newErrors)));
test("resolved error", () => assert.ok(Array.isArray(comparison.resolvedErrors)));
test("unchanged error", () => assert.ok(Array.isArray(comparison.unchangedErrors)));
test("performance durations", () => assert.equal(typeof (comparison.performanceDurations as { afterMs: number }).afterMs, "number"));
test("metrics null handling", async () => assert.equal((await taskStatus(lab, "fixture", taskId)).metrics && ((await taskStatus(lab, "fixture", taskId)).metrics as { agentReportedUsage: null }).agentReportedUsage, null));
test("metrics 不伪造 Token", async () => assert.equal(((await taskStatus(lab, "fixture", taskId)).metrics as { agentReportedFilesRead: null }).agentReportedFilesRead, null));
test("task list", async () => assert.ok((await listTasks(lab, "fixture")).some((item) => item.taskId === taskId)));
test("close manual required", async () => assert.rejects(closeTask({ labRoot: lab, frameworkId: "fixture", taskId, outcome: "accepted", reason: "test" }), /人工确认/u));
test("task close", async () => assert.equal((await closeTask({ labRoot: lab, frameworkId: "fixture", taskId, outcome: "accepted", reason: "manual confirmed", manualConfirmations: ["manual-check", "browser-check"] })).outcome, "accepted"));
test("closed status", async () => assert.equal((await taskStatus(lab, "fixture", taskId)).status, "closed"));
test("history append-only", async () => {
  const lines = (await readFile(path.join(lab, `frameworks/fixture/tasks/${taskId}/task-history.jsonl`), "utf8")).trim().split(/\r?\n/u).map((line) => JSON.parse(line) as { previousStatus: string | null; nextStatus: string });
  assert.ok(lines.every((item, index) => item.previousStatus === (index ? lines[index - 1]!.nextStatus : null)));
});
test("Task Manifest hash", async () => {
  const manifest = JSON.parse(await readFile(path.join(lab, `frameworks/fixture/tasks/${taskId}/manifest.json`), "utf8")) as { files: Array<{ path: string; sha256: string }> };
  const taskEntry = manifest.files.find((item) => item.path === "task.json")!;
  assert.equal(taskEntry.sha256, hash(await readFile(path.join(lab, `frameworks/fixture/tasks/${taskId}/task.json`))));
});
test("中文路径", () => assert.ok(lab.includes("闭环")));
test("空格路径", () => assert.ok(source.includes(" ")));
test("不自动 push", () => assert.equal(git(source, ["remote"]), ""));
test("原子输出无 tmp", async () => assert.ok(!(await readdirSafe(path.join(lab, `frameworks/fixture/tasks/${taskId}`))).some((item) => item.includes(".tmp-"))));

async function readdirSafe(directory: string): Promise<string[]> {
  const { readdir } = await import("node:fs/promises"); return await readdir(directory);
}
