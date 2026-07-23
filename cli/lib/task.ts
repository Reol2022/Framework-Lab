import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadFrameworkConfig } from "./config.js";
import { parseErrorContexts } from "./errors.js";
import { collectGitSnapshot } from "./git.js";
import { createAgentContext } from "./knowledge.js";
import { displayPath, portablePath, resolveFromLab } from "./paths.js";
import { runStep, spawnCollect, startBackgroundProcess, type BackgroundProcess } from "./process.js";
import { queryRetrieval } from "./retrieval.js";
import { validateWithSchema } from "./schema.js";
import type { ErrorEventsDocument, ErrorParseContext, FrameworkStepConfig, StepRecord } from "./types.js";

const VERSION = "0.2.0";
const SCHEMA_VERSION = "1.0.0";
const COMMIT = /^[a-f0-9]{40}$/u;
const ID = /^[a-z0-9][a-z0-9-]*$/u;
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
const now = () => new Date().toISOString();

export type TaskStatus =
  | "draft" | "validated" | "prepared" | "handed_off" | "modified"
  | "policy_failed" | "verification_failed" | "verification_partial"
  | "verification_passed" | "closed" | "aborted";
export type AcceptanceStatus = "pending" | "passed" | "failed" | "skipped" | "manual_required";

export interface AcceptanceCriterion {
  id: string;
  type: "source_change" | "file_exists" | "file_not_changed" | "path_allowed" | "path_denied"
    | "text_present" | "text_absent" | "export_present" | "symbol_used" | "command_passes"
    | "http_status" | "manual_check" | "browser_check" | "custom";
  title: string;
  description: string;
  required: boolean;
  automated: boolean;
  status: AcceptanceStatus;
  evidence: string[];
  expected: Record<string, unknown> | string | number | boolean | null;
  actual: unknown;
  evaluator: string;
  warnings: string[];
}

export interface AcceptanceDocument {
  schemaVersion: "1.0.0";
  criteria: AcceptanceCriterion[];
  summary: { passed: number; failed: number; pending: number; skipped: number; manualRequired: number };
}

export interface ChangePolicy {
  schemaVersion: "1.0.0";
  allowedPaths: string[];
  deniedPaths: string[];
  maxChangedFiles: number;
  maxAddedFiles: number;
  maxDeletedFiles: number;
  maxDiffLines: number;
  allowUntrackedFiles: boolean;
  allowedUntrackedPaths: string[];
  deniedExtensions: string[];
  requireCleanStart: boolean;
  lockfilesReadOnly: boolean;
  manifestsReadOnly: boolean;
  generatedDirectoriesIgnored: string[];
  requirePatch: boolean;
  requireDiffCheck: boolean;
  requireNoConflictMarkers: boolean;
}

export interface VerificationStep {
  id: string;
  type: "command" | "http" | "static_check" | "acceptance" | "manual";
  phase: "before" | "after" | "both";
  command: string | null;
  args: string[];
  cwd: string;
  timeoutSeconds: number;
  allowFailure: boolean;
  required: boolean;
  dependencies: string[];
  environment: Record<string, string>;
  expectedExitCode: number | null;
  expectedHttpStatus: number | null;
  outputLogs: { stdout: string; stderr: string } | null;
  status: "pending" | "passed" | "failed" | "skipped" | "timed_out" | "manual_required";
  url?: string;
  background?: boolean;
}

export interface VerificationPlan {
  schemaVersion: "1.0.0";
  steps: VerificationStep[];
}

export interface TaskRecord {
  schemaVersion: "1.0.0";
  taskId: string;
  frameworkId: string;
  title: string;
  description: string;
  originalTask: string;
  normalizedTask: string;
  intents: string[];
  constraints: string[];
  sourceCommit: string;
  sourceRunId: string | null;
  catalogSnapshotId: string;
  catalogRootHash: string;
  symbolSnapshotId: string;
  symbolRootHash: string;
  knowledgeIndexSha256: string;
  retrievalId: string;
  contextId: string;
  contextSha256: string;
  budget: number;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  currentPhase: string;
  warnings: string[];
  metrics: {
    contextEstimatedTokens: number;
    contextCharacters: number;
    selectedCandidateCount: number;
    selectedSnippetCount: number;
    sourceFilesRepresented: number;
    sourceCharactersRepresented: number;
    changedFiles: number;
    diffLines: number;
    commandCount: number;
    verificationCommandCount: number;
    failedVerificationCount: number;
    policyViolationCount: number;
    manualInterventionCount: number;
    agentReportedFilesRead: number | null;
    agentReportedSearches: number | null;
    agentReportedCommands: number | null;
    agentReportedUsage: Record<string, unknown> | null;
    wallClockDuration: number | null;
  };
}

interface TaskBundle {
  dir: string;
  task: TaskRecord;
  acceptance: AcceptanceDocument;
  policy: ChangePolicy;
  plan: VerificationPlan;
}

export interface ChangedFile {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed" | "untracked";
  oldPath: string | null;
  generated: boolean;
  binary: boolean;
}

export interface InspectResult {
  schemaVersion: "1.0.0";
  taskId: string;
  inspectedAt: string;
  head: string | null;
  headMatchesBaseline: boolean;
  trackedStatus: string[];
  untrackedStatus: string[];
  generatedFiles: string[];
  changedFiles: ChangedFile[];
  counts: { changed: number; added: number; modified: number; deleted: number; renamed: number; untracked: number };
  diffLines: number;
  patchSha256: string;
  conflictMarkers: string[];
  lockfilesChanged: string[];
  manifestsChanged: string[];
  binaryFiles: string[];
  submodulesChanged: string[];
  sourceFingerprint: string;
}

export interface PolicyResult {
  schemaVersion: "1.0.0";
  taskId: string;
  evaluatedAt: string;
  overallStatus: "passed" | "failed";
  passedRules: string[];
  failedRules: string[];
  warnings: string[];
  evidence: string[];
  blockingViolations: string[];
}

interface VerificationDocument {
  schemaVersion: "1.0.0";
  taskId: string;
  phase: "before" | "after";
  startedAt: string;
  finishedAt: string;
  status: "passed" | "failed" | "partial";
  steps: StepRecord[];
  planSteps: VerificationStep[];
  acceptance: AcceptanceDocument;
  errorSummary: ErrorEventsDocument["summary"];
  firstBlockingErrorId: string | null;
  warnings: string[];
}

function taskDirectory(labRoot: string, frameworkId: string, taskId: string): string {
  return path.join(labRoot, "frameworks", frameworkId, "tasks", taskId);
}

function assertId(value: string, label: string): void {
  if (!ID.test(value)) throw new Error(`${label} 必须匹配 ${ID.source}。`);
}

function assertPortablePath(value: string, label: string): void {
  if (!value || path.isAbsolute(value) || /^[A-Za-z]:/u.test(value) || value.includes("\\") || value.split("/").includes("..")) {
    throw new Error(`${label} 必须是安全的仓库相对路径：${value}`);
  }
}

function globRegex(pattern: string): RegExp {
  assertPortablePath(pattern, "glob");
  let output = "^";
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index]!;
    if (char === "*") {
      if (pattern[index + 1] === "*") {
        index += 1;
        if (pattern[index + 1] === "/") { index += 1; output += "(?:.*/)?"; }
        else output += ".*";
      } else output += "[^/]*";
    } else if (char === "?") output += "[^/]";
    else output += char.replace(/[.+^${}()|[\]\\]/gu, "\\$&");
  }
  return new RegExp(`${output}$`, "u");
}

export function taskPathMatches(value: string, patterns: string[]): boolean {
  return patterns.some((pattern) => globRegex(pattern).test(value));
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(temp, json(value), "utf8");
  await rm(file, { force: true });
  await rename(temp, file);
}

async function exists(file: string): Promise<boolean> {
  try { await stat(file); return true; } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function listFiles(root: string, current = root): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const target = path.join(current, entry.name);
    if (entry.isDirectory()) result.push(...await listFiles(root, target));
    else if (entry.isFile()) result.push(portablePath(path.relative(root, target)));
  }
  return result.sort();
}

async function updateManifest(bundleDir: string, task: TaskRecord): Promise<Record<string, unknown>> {
  const files = (await listFiles(bundleDir)).filter((file) => file !== "manifest.json");
  const entries = await Promise.all(files.map(async (file) => ({
    path: file,
    sha256: sha(await readFile(path.join(bundleDir, ...file.split("/")))),
    bytes: (await stat(path.join(bundleDir, ...file.split("/")))).size,
  })));
  const manifest = {
    schemaVersion: SCHEMA_VERSION,
    taskId: task.taskId,
    frameworkId: task.frameworkId,
    generatedAt: now(),
    toolVersion: VERSION,
    files: entries,
  };
  await validateWithSchema(path.resolve(bundleDir, "..", "..", "..", ".."), "task-manifest.schema.json", manifest);
  await writeJson(path.join(bundleDir, "manifest.json"), manifest);
  return manifest;
}

async function appendHistory(bundle: TaskBundle, previousStatus: TaskStatus | null, nextStatus: TaskStatus, command: string, reason: string, evidenceFile: string): Promise<void> {
  const event = { schemaVersion: SCHEMA_VERSION, timestamp: now(), previousStatus, nextStatus, command, reason, evidenceFile, toolVersion: VERSION };
  await validateWithSchema(path.resolve(bundle.dir, "..", "..", "..", ".."), "task-history.schema.json", event);
  await appendFile(path.join(bundle.dir, "task-history.jsonl"), `${JSON.stringify(event)}\n`, "utf8");
}

const transitions: Record<TaskStatus, TaskStatus[]> = {
  draft: ["validated", "aborted"],
  validated: ["prepared", "aborted"],
  prepared: ["handed_off", "aborted"],
  handed_off: ["modified", "aborted"],
  modified: ["policy_failed", "verification_failed", "verification_partial", "verification_passed", "aborted"],
  policy_failed: ["verification_failed", "verification_partial", "verification_passed", "closed", "aborted"],
  verification_failed: ["verification_failed", "verification_partial", "verification_passed", "closed", "aborted"],
  verification_partial: ["verification_failed", "verification_partial", "verification_passed", "closed", "aborted"],
  verification_passed: ["verification_failed", "verification_partial", "verification_passed", "closed", "aborted"],
  closed: [],
  aborted: [],
};

async function transition(bundle: TaskBundle, next: TaskStatus, command: string, reason: string, evidenceFile: string): Promise<void> {
  const previous = bundle.task.status;
  if (!transitions[previous].includes(next)) throw new Error(`非法任务状态转换：${previous} → ${next}`);
  bundle.task.status = next;
  bundle.task.currentPhase = next;
  bundle.task.updatedAt = now();
  await writeJson(path.join(bundle.dir, "task.json"), bundle.task);
  await appendHistory(bundle, previous, next, command, reason, evidenceFile);
  await updateManifest(bundle.dir, bundle.task);
}

function acceptanceSummary(criteria: AcceptanceCriterion[]): AcceptanceDocument["summary"] {
  return {
    passed: criteria.filter((item) => item.status === "passed").length,
    failed: criteria.filter((item) => item.status === "failed").length,
    pending: criteria.filter((item) => item.status === "pending").length,
    skipped: criteria.filter((item) => item.status === "skipped").length,
    manualRequired: criteria.filter((item) => item.status === "manual_required").length,
  };
}

function defaultAcceptance(): AcceptanceDocument {
  const criteria: AcceptanceCriterion[] = [{
    id: "source-change",
    type: "source_change",
    title: "存在任务源码修改",
    description: "候选工作树必须产生至少一个非生成文件修改。",
    required: true,
    automated: true,
    status: "pending",
    evidence: [],
    expected: { minimumChangedFiles: 1 },
    actual: null,
    evaluator: "framework-lab",
    warnings: [],
  }];
  return { schemaVersion: SCHEMA_VERSION, criteria, summary: acceptanceSummary(criteria) };
}

function defaultPolicy(): ChangePolicy {
  return {
    schemaVersion: SCHEMA_VERSION,
    allowedPaths: ["**"],
    deniedPaths: ["package.json", "pnpm-lock.yaml", "**/package.json", "**/pnpm-lock.yaml"],
    maxChangedFiles: 20,
    maxAddedFiles: 10,
    maxDeletedFiles: 0,
    maxDiffLines: 1000,
    allowUntrackedFiles: true,
    allowedUntrackedPaths: ["**"],
    deniedExtensions: [".pem", ".key"],
    requireCleanStart: true,
    lockfilesReadOnly: true,
    manifestsReadOnly: true,
    generatedDirectoriesIgnored: ["node_modules/**", "dist/**", "**/dist/**"],
    requirePatch: true,
    requireDiffCheck: true,
    requireNoConflictMarkers: true,
  };
}

function defaultPlan(): VerificationPlan {
  return {
    schemaVersion: SCHEMA_VERSION,
    steps: [{
      id: "manual-review",
      type: "manual",
      phase: "after",
      command: null,
      args: [],
      cwd: ".",
      timeoutSeconds: 1,
      allowFailure: true,
      required: false,
      dependencies: [],
      environment: {},
      expectedExitCode: null,
      expectedHttpStatus: null,
      outputLogs: null,
      status: "pending",
    }],
  };
}

async function inputDocument<T>(file: string | undefined, fallback: T): Promise<T> {
  return file ? await readJson<T>(file) : structuredClone(fallback);
}

async function loadBundle(labRoot: string, frameworkId: string, taskId: string): Promise<TaskBundle> {
  assertId(frameworkId, "framework id");
  assertId(taskId, "task id");
  const dir = taskDirectory(labRoot, frameworkId, taskId);
  const [task, acceptance, policy, plan] = await Promise.all([
    readJson<TaskRecord>(path.join(dir, "task.json")),
    readJson<AcceptanceDocument>(path.join(dir, "acceptance.json")),
    readJson<ChangePolicy>(path.join(dir, "change-policy.json")),
    readJson<VerificationPlan>(path.join(dir, "verification-plan.json")),
  ]);
  return { dir, task, acceptance, policy, plan };
}

export async function createTask(options: {
  labRoot: string;
  frameworkId: string;
  task: string;
  taskId?: string;
  sourceCommit?: string;
  runId?: string;
  catalogSnapshot?: string;
  symbolSnapshot?: string;
  budget?: number;
  acceptanceFile?: string;
  policyFile?: string;
  verificationFile?: string;
  includeCards?: string[];
  excludeCards?: string[];
  dryRun?: boolean;
  force?: boolean;
}): Promise<{ task: TaskRecord; directory: string | null }> {
  if (!options.task.trim()) throw new Error("--task 必须提供非空文本。");
  const taskId = options.taskId ?? `task-${sha(options.task).slice(0, 12)}`;
  assertId(taskId, "task id");
  const output = taskDirectory(options.labRoot, options.frameworkId, taskId);
  const outputExists = await exists(output);
  if (outputExists && !options.force) throw new Error(`任务 ${taskId} 已存在；不会覆盖。`);
  if (outputExists && options.force) {
    const existing = await loadBundle(options.labRoot, options.frameworkId, taskId);
    if (!["draft", "validated"].includes(existing.task.status)) throw new Error("--force 只允许刷新 draft/validated 任务的派生 Context 与 Retrieval。");
  }
  const retrievalId = `${taskId}-retrieval`;
  const contextId = `${taskId}-context`;
  const retrieval = await queryRetrieval({
    labRoot: options.labRoot,
    frameworkId: options.frameworkId,
    task: options.task,
    ...(options.sourceCommit ? { sourceCommit: options.sourceCommit } : {}),
    ...(options.runId ? { runId: options.runId } : {}),
    ...(options.catalogSnapshot ? { catalogSnapshot: options.catalogSnapshot } : {}),
    ...(options.symbolSnapshot ? { symbolSnapshot: options.symbolSnapshot } : {}),
    retrievalId,
    ...(options.dryRun !== undefined ? { dryRun: options.dryRun } : {}),
    ...(options.force !== undefined ? { force: options.force } : {}),
  });
  const sourceCommit = options.sourceCommit ?? retrieval.result.sourceCommit;
  if (!COMMIT.test(sourceCommit)) throw new Error("任务必须绑定精确 40 位 source commit。");
  const context = await createAgentContext({
    labRoot: options.labRoot,
    frameworkId: options.frameworkId,
    task: options.task,
    sourceCommit,
    ...(options.runId ? { runId: options.runId } : {}),
    budget: options.budget ?? 3000,
    contextId,
    ...(options.dryRun ? {} : { retrievalId }),
    includeCards: options.includeCards ?? [],
    excludeCards: options.excludeCards ?? [],
    includeSourceSnippets: true,
    ...(options.dryRun !== undefined ? { dryRun: options.dryRun } : {}),
    ...(options.force !== undefined ? { force: options.force } : {}),
  });
  const acceptance = await inputDocument(options.acceptanceFile, defaultAcceptance());
  const policy = await inputDocument(options.policyFile, defaultPolicy());
  const plan = await inputDocument(options.verificationFile, defaultPlan());
  const createdAt = now();
  const contextJson = json(context.context);
  const snippets = context.context.frameworkKnowledge?.snippets ?? [];
  const task: TaskRecord = {
    schemaVersion: SCHEMA_VERSION,
    taskId,
    frameworkId: options.frameworkId,
    title: options.task.trim().slice(0, 120),
    description: options.task.trim(),
    originalTask: options.task,
    normalizedTask: retrieval.result.taskProfile.normalizedText,
    intents: retrieval.result.taskProfile.intents,
    constraints: retrieval.result.taskProfile.constraints,
    sourceCommit,
    sourceRunId: options.runId ?? null,
    catalogSnapshotId: retrieval.result.catalogSnapshotId,
    catalogRootHash: retrieval.result.catalogRootHash,
    symbolSnapshotId: retrieval.result.symbolSnapshotId,
    symbolRootHash: retrieval.result.symbolRootHash,
    knowledgeIndexSha256: String(context.manifest.knowledgeIndexSha256),
    retrievalId,
    contextId,
    contextSha256: sha(contextJson),
    budget: options.budget ?? 3000,
    status: "draft",
    createdAt,
    updatedAt: createdAt,
    createdBy: "framework-lab-cli",
    currentPhase: "draft",
    warnings: [...retrieval.result.warnings, ...context.context.warnings],
    metrics: {
      contextEstimatedTokens: context.context.estimatedTokens,
      contextCharacters: context.markdown.length,
      selectedCandidateCount: retrieval.result.counts.selected,
      selectedSnippetCount: snippets.length,
      sourceFilesRepresented: new Set(snippets.map((item: { path: string }) => item.path)).size,
      sourceCharactersRepresented: snippets.reduce((total: number, item: { content: string }) => total + item.content.length, 0),
      changedFiles: 0,
      diffLines: 0,
      commandCount: 0,
      verificationCommandCount: 0,
      failedVerificationCount: 0,
      policyViolationCount: 0,
      manualInterventionCount: 0,
      agentReportedFilesRead: null,
      agentReportedSearches: null,
      agentReportedCommands: null,
      agentReportedUsage: null,
      wallClockDuration: null,
    },
  };
  await Promise.all([
    validateWithSchema(options.labRoot, "task.schema.json", task),
    validateWithSchema(options.labRoot, "acceptance.schema.json", acceptance),
    validateWithSchema(options.labRoot, "change-policy.schema.json", policy),
    validateWithSchema(options.labRoot, "verification-plan.schema.json", plan),
  ]);
  validateAcceptanceDocument(acceptance);
  validateChangePolicy(policy);
  validateVerificationPlan(plan);
  if (options.dryRun) return { task, directory: null };
  const temp = `${output}.tmp-${process.pid}-${Date.now()}`;
  await mkdir(path.dirname(output), { recursive: true });
  if (outputExists) {
    await rm(path.join(output, "context"), { recursive: true, force: true });
    await rm(path.join(output, "retrieval"), { recursive: true, force: true });
  } else await mkdir(temp, { recursive: false });
  const target = outputExists ? output : temp;
  await Promise.all([
    writeJson(path.join(target, "task.json"), task),
    writeJson(path.join(target, "acceptance.json"), acceptance),
    writeJson(path.join(target, "change-policy.json"), policy),
    writeJson(path.join(target, "verification-plan.json"), plan),
  ]);
  await mkdir(path.join(target, "context"), { recursive: true });
  await mkdir(path.join(target, "retrieval"), { recursive: true });
  await Promise.all([
    writeFile(path.join(target, "context", "context.json"), contextJson, "utf8"),
    writeFile(path.join(target, "context", "context.md"), context.markdown, "utf8"),
    writeJson(path.join(target, "context", "manifest.json"), context.manifest),
    writeJson(path.join(target, "retrieval", "retrieval.json"), retrieval.result),
    writeJson(path.join(target, "retrieval", "manifest.json"), retrieval.manifest),
  ]);
  if (!outputExists) {
    await writeFile(path.join(target, "task-history.jsonl"), "", "utf8");
    await rename(temp, output);
    const bundle = await loadBundle(options.labRoot, options.frameworkId, taskId);
    await appendHistory(bundle, null, "draft", "task create", "task created", "task.json");
    await updateManifest(output, task);
  } else {
    const bundle = await loadBundle(options.labRoot, options.frameworkId, taskId);
    await updateManifest(output, bundle.task);
  }
  return { task, directory: output };
}

export function validateAcceptanceDocument(document: AcceptanceDocument): void {
  const ids = document.criteria.map((item) => item.id);
  if (new Set(ids).size !== ids.length) throw new Error("Acceptance criterion id 必须唯一。");
  for (const criterion of document.criteria) assertId(criterion.id, "acceptance id");
}

export function validateChangePolicy(policy: ChangePolicy): void {
  for (const value of [...policy.allowedPaths, ...policy.deniedPaths, ...policy.allowedUntrackedPaths, ...policy.generatedDirectoriesIgnored]) {
    globRegex(value);
  }
  if (policy.allowedPaths.some((allow) => policy.deniedPaths.includes(allow))) throw new Error("Change Policy allowedPaths 与 deniedPaths 存在完全冲突。");
}

export function validateVerificationPlan(plan: VerificationPlan): void {
  const ids = plan.steps.map((item) => item.id);
  if (new Set(ids).size !== ids.length) throw new Error("Verification step id 必须唯一。");
  const known = new Set(ids);
  for (const step of plan.steps) {
    assertId(step.id, "verification step id");
    assertPortablePath(step.cwd, "verification cwd");
    for (const dependency of step.dependencies) if (!known.has(dependency)) throw new Error(`${step.id} 引用了未知 dependency：${dependency}`);
  }
  const visiting = new Set<string>(), visited = new Set<string>();
  const byId = new Map(plan.steps.map((step) => [step.id, step]));
  const visit = (id: string) => {
    if (visiting.has(id)) throw new Error("Verification dependencies 存在循环。");
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of byId.get(id)?.dependencies ?? []) visit(dependency);
    visiting.delete(id); visited.add(id);
  };
  for (const id of ids) visit(id);
}

async function validateManifest(bundle: TaskBundle): Promise<void> {
  const manifest = await readJson<{ files: Array<{ path: string; sha256: string }> }>(path.join(bundle.dir, "manifest.json"));
  await validateWithSchema(path.resolve(bundle.dir, "..", "..", "..", ".."), "task-manifest.schema.json", manifest);
  for (const entry of manifest.files) {
    assertPortablePath(entry.path, "manifest path");
    const actual = sha(await readFile(path.join(bundle.dir, ...entry.path.split("/"))));
    if (actual !== entry.sha256) throw new Error(`Task Manifest SHA256 不匹配：${entry.path}`);
  }
}

async function validateHistory(bundle: TaskBundle): Promise<void> {
  const lines = (await readFile(path.join(bundle.dir, "task-history.jsonl"), "utf8")).trim().split(/\r?\n/u).filter(Boolean);
  let previous: TaskStatus | null = null;
  for (const line of lines) {
    const event = JSON.parse(line) as { previousStatus: TaskStatus | null; nextStatus: TaskStatus };
    await validateWithSchema(path.resolve(bundle.dir, "..", "..", "..", ".."), "task-history.schema.json", event);
    if (event.previousStatus !== previous) throw new Error("Task history 非 append-only 连续状态链。");
    previous = event.nextStatus;
  }
  if (previous !== bundle.task.status) throw new Error("Task history 最终状态与 task.json 不一致。");
}

export async function validateTask(labRoot: string, frameworkId: string, taskId: string): Promise<TaskBundle> {
  const bundle = await loadBundle(labRoot, frameworkId, taskId);
  await Promise.all([
    validateWithSchema(labRoot, "task.schema.json", bundle.task),
    validateWithSchema(labRoot, "acceptance.schema.json", bundle.acceptance),
    validateWithSchema(labRoot, "change-policy.schema.json", bundle.policy),
    validateWithSchema(labRoot, "verification-plan.schema.json", bundle.plan),
    validateWithSchema(labRoot, "agent-context.schema.json", await readJson(path.join(bundle.dir, "context", "context.json"))),
    validateWithSchema(labRoot, "context-manifest.schema.json", await readJson(path.join(bundle.dir, "context", "manifest.json"))),
    validateWithSchema(labRoot, "retrieval-result.schema.json", await readJson(path.join(bundle.dir, "retrieval", "retrieval.json"))),
    validateWithSchema(labRoot, "retrieval-manifest.schema.json", await readJson(path.join(bundle.dir, "retrieval", "manifest.json"))),
  ]);
  validateAcceptanceDocument(bundle.acceptance);
  validateChangePolicy(bundle.policy);
  validateVerificationPlan(bundle.plan);
  const contextContent = await readFile(path.join(bundle.dir, "context", "context.json"), "utf8");
  if (sha(contextContent) !== bundle.task.contextSha256) throw new Error("Context hash 校验失败。");
  const retrieval = await readJson<{ sourceCommit: string; catalogSnapshotId: string; catalogRootHash: string; symbolSnapshotId: string; symbolRootHash: string }>(path.join(bundle.dir, "retrieval", "retrieval.json"));
  if (retrieval.sourceCommit !== bundle.task.sourceCommit) throw new Error("Retrieval source commit 与 task 不一致。");
  if (retrieval.catalogSnapshotId !== bundle.task.catalogSnapshotId || retrieval.catalogRootHash !== bundle.task.catalogRootHash) throw new Error("Catalog 引用不一致。");
  if (retrieval.symbolSnapshotId !== bundle.task.symbolSnapshotId || retrieval.symbolRootHash !== bundle.task.symbolRootHash) throw new Error("Symbol 引用不一致。");
  await validateHistory(bundle);
  await validateManifest(bundle);
  if (bundle.task.status === "draft") await transition(bundle, "validated", "task validate", "all task validations passed", "manifest.json");
  return bundle;
}

function worktreeRelative(frameworkId: string, taskId: string): string {
  return `.framework-sources/tasks/${frameworkId}/${taskId}`;
}

async function resolveWorktree(labRoot: string, bundle: TaskBundle): Promise<string> {
  const record = await readJson<{ directory: string }>(path.join(bundle.dir, "worktree.json"));
  assertPortablePath(record.directory, "worktree directory");
  return path.resolve(labRoot, ...record.directory.split("/"));
}

async function packageManagerPreflight(labRoot: string, bundle: TaskBundle): Promise<{ executable: string; version: string; configured: string }> {
  const config = await loadFrameworkConfig(labRoot, bundle.task.frameworkId);
  const executable = resolveFromLab(labRoot, config.package_manager.executable);
  const result = await spawnCollect(executable, ["--version"], labRoot, 15_000);
  const version = result.stdout.trim();
  if (result.exitCode !== 0) throw new Error(`Preflight package manager 不可用：${result.stderr || result.error}`);
  if (version !== config.package_manager.version) throw new Error(`Preflight package manager 版本不一致：${version} != ${config.package_manager.version}`);
  return { executable, version, configured: config.package_manager.version };
}

async function topologicalSteps(plan: VerificationPlan, phase: "before" | "after", selected?: Set<string>): Promise<VerificationStep[]> {
  const applicable = plan.steps.filter((step) => (step.phase === phase || step.phase === "both") && (!selected || selected.has(step.id)));
  const applicableIds = new Set(applicable.map((step) => step.id));
  if (selected) for (const step of applicable) for (const dep of step.dependencies) if (!applicableIds.has(dep)) {
    const dependency = plan.steps.find((candidate) => candidate.id === dep);
    if (dependency && (dependency.phase === phase || dependency.phase === "both")) applicable.push(dependency);
  }
  const ordered: VerificationStep[] = [], pending = new Map(applicable.map((step) => [step.id, structuredClone(step)]));
  while (pending.size) {
    const ready = [...pending.values()].filter((step) => step.dependencies.every((id) => !pending.has(id))).sort((a, b) => a.id.localeCompare(b.id));
    if (!ready.length) throw new Error("Verification dependencies 存在循环。");
    for (const step of ready) { ordered.push(step); pending.delete(step.id); }
  }
  return ordered;
}

async function executePhase(options: {
  labRoot: string;
  bundle: TaskBundle;
  worktree: string;
  phase: "before" | "after";
  outputDir: string;
  inspect?: InspectResult;
  skipManual?: boolean;
  selectedSteps?: string[];
}): Promise<{ verification: VerificationDocument; errors: ErrorEventsDocument; acceptance: AcceptanceDocument }> {
  const startedAt = now();
  await mkdir(path.join(options.outputDir, "logs"), { recursive: true });
  const config = await loadFrameworkConfig(options.labRoot, options.bundle.task.frameworkId);
  const pmExecutable = resolveFromLab(options.labRoot, config.package_manager.executable);
  const selected = options.selectedSteps?.length ? new Set(options.selectedSteps) : undefined;
  const planSteps = await topologicalSteps(options.bundle.plan, options.phase, selected);
  const records: StepRecord[] = [];
  const contexts: ErrorParseContext[] = [];
  const completed = new Map<string, VerificationStep["status"]>();
  const backgrounds: BackgroundProcess[] = [];
  const backgroundTimers: NodeJS.Timeout[] = [];
  try {
    for (const step of planSteps) {
      const outputLogs = {
        stdout: `logs/${step.id}.stdout.log`,
        stderr: `logs/${step.id}.stderr.log`,
      };
      step.outputLogs = outputLogs;
      if (step.dependencies.some((dependency) => !["passed", "manual_required"].includes(completed.get(dependency) ?? "skipped"))) {
        step.status = "skipped"; completed.set(step.id, step.status); continue;
      }
      if (step.type === "manual") {
        step.status = options.skipManual ? "skipped" : "manual_required";
        completed.set(step.id, step.status); continue;
      }
      if (step.type === "acceptance" || step.type === "static_check") {
        step.status = "passed"; completed.set(step.id, step.status); continue;
      }
      if (step.type === "http") {
        const start = Date.now();
        let status: number | null = null, error: string | null = null;
        const url = step.url ?? step.command;
        if (!url) throw new Error("HTTP step 缺少 url。");
        const deadline = start + step.timeoutSeconds * 1000;
        while (Date.now() < deadline) {
          try {
            const response = await fetch(url, { signal: AbortSignal.timeout(Math.min(2_000, Math.max(1, deadline - Date.now()))) });
            status = response.status;
            await writeFile(path.join(options.outputDir, outputLogs.stdout), `URL: ${url}\nStatus: ${response.status}\nContent-Type: ${response.headers.get("content-type") ?? ""}\nLength: ${(await response.arrayBuffer()).byteLength}\n`, "utf8");
            await writeFile(path.join(options.outputDir, outputLogs.stderr), "", "utf8");
            error = null;
            break;
          } catch (cause) {
            error = (cause as Error).message;
            if (Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 250));
          }
        }
        if (error !== null) {
          await writeFile(path.join(options.outputDir, outputLogs.stdout), "", "utf8");
          await writeFile(path.join(options.outputDir, outputLogs.stderr), `${error}\n`, "utf8");
        }
        const passed = error === null && status === step.expectedHttpStatus;
        step.status = passed ? "passed" : "failed";
        const record: StepRecord = {
          id: step.id, command: url ?? "http", args: [], cwd: ".",
          startedAt: new Date(start).toISOString(), finishedAt: now(), durationMs: Date.now() - start,
          exitCode: passed ? 0 : 1, status: passed ? "passed" : "failed",
          stdoutLog: outputLogs.stdout, stderrLog: outputLogs.stderr,
          allowFailure: step.allowFailure, timeoutSeconds: step.timeoutSeconds,
        };
        records.push(record);
        contexts.push({
          runId: options.bundle.task.taskId, frameworkId: options.bundle.task.frameworkId, stepId: step.id,
          command: url ?? "http", exitCode: record.exitCode, status: record.status, allowFailure: step.allowFailure,
          stdout: await readFile(path.join(options.outputDir, outputLogs.stdout), "utf8"),
          stderr: await readFile(path.join(options.outputDir, outputLogs.stderr), "utf8"),
          stdoutLogPath: outputLogs.stdout, stderrLogPath: outputLogs.stderr,
          cwd: options.worktree, sourceRoot: options.worktree, labRoot: options.labRoot,
        });
        completed.set(step.id, step.status); continue;
      }
      const command = step.command === "$packageManager" ? pmExecutable : (step.command ?? "");
      const cwd = path.resolve(options.worktree, ...step.cwd.split("/"));
      const env = { ...process.env, ...step.environment, PATH: `${path.dirname(pmExecutable)}${path.delimiter}${process.env.PATH ?? ""}` };
      if (step.background) {
        const started = now();
        const background = await startBackgroundProcess({
          command, args: step.args, cwd,
          stdoutPath: path.join(options.outputDir, outputLogs.stdout),
          stderrPath: path.join(options.outputDir, outputLogs.stderr), env,
        });
        backgrounds.push(background);
        backgroundTimers.push(setTimeout(() => { void background.stop(); }, step.timeoutSeconds * 1000));
        await new Promise((resolve) => setTimeout(resolve, 800));
        const early = await Promise.race([background.exited.then((result) => ({ exited: true, ...result })), new Promise<{ exited: false }>((resolve) => setTimeout(() => resolve({ exited: false }), 50))]);
        const passed = !early.exited;
        step.status = passed ? "passed" : "failed";
        records.push({
          id: step.id, command: step.command ?? "", args: step.args, cwd: step.cwd,
          startedAt: started, finishedAt: now(), durationMs: 850, exitCode: passed ? 0 : (early.exitCode ?? 1),
          status: passed ? "passed" : "failed", stdoutLog: outputLogs.stdout, stderrLog: outputLogs.stderr,
          allowFailure: step.allowFailure, timeoutSeconds: step.timeoutSeconds,
        });
        completed.set(step.id, step.status); continue;
      }
      const configStep: FrameworkStepConfig = { id: step.id, command: step.command ?? "", args: step.args, timeout_seconds: step.timeoutSeconds, allow_failure: step.allowFailure };
      const record = await runStep({
        step: configStep, resolvedCommand: command, displayCommand: step.command ?? "",
        cwd, displayCwd: step.cwd, stepsDir: path.join(options.outputDir, "logs"), env,
      });
      if (step.expectedExitCode !== null && record.exitCode !== step.expectedExitCode && record.status === "passed") record.status = "failed";
      step.status = record.status;
      records.push({ ...record, stdoutLog: `logs/${path.basename(record.stdoutLog)}`, stderrLog: `logs/${path.basename(record.stderrLog)}` });
      contexts.push({
        runId: options.bundle.task.taskId, frameworkId: options.bundle.task.frameworkId, stepId: step.id,
        command: step.command ?? "", exitCode: record.exitCode, status: record.status, allowFailure: step.allowFailure,
        stdout: await readFile(path.join(options.outputDir, "logs", path.basename(record.stdoutLog)), "utf8"),
        stderr: await readFile(path.join(options.outputDir, "logs", path.basename(record.stderrLog)), "utf8"),
        stdoutLogPath: `logs/${path.basename(record.stdoutLog)}`, stderrLogPath: `logs/${path.basename(record.stderrLog)}`,
        cwd, sourceRoot: options.worktree, labRoot: options.labRoot,
      });
      completed.set(step.id, step.status);
    }
  } finally {
    for (const timer of backgroundTimers) clearTimeout(timer);
    for (const background of backgrounds) await background.stop().catch(() => undefined);
  }
  const acceptance = await evaluateAcceptance(options.bundle.acceptance, options.worktree, options.inspect, planSteps, options.phase);
  const requiredFailed = planSteps.some((step) => step.required && ["failed", "timed_out"].includes(step.status))
    || acceptance.criteria.some((item) => item.required && item.status === "failed");
  const manual = acceptance.criteria.some((item) => item.required && item.status === "manual_required")
    || planSteps.some((step) => step.required && step.status === "manual_required");
  const optionalFailed = planSteps.some((step) => ["failed", "timed_out"].includes(step.status));
  const status = requiredFailed ? "failed" : manual || optionalFailed ? "partial" : "passed";
  const errors = parseErrorContexts(options.bundle.task.taskId, options.bundle.task.frameworkId, status, contexts);
  const verification: VerificationDocument = {
    schemaVersion: SCHEMA_VERSION, taskId: options.bundle.task.taskId, phase: options.phase,
    startedAt, finishedAt: now(), status, steps: records, planSteps, acceptance,
    errorSummary: errors.summary, firstBlockingErrorId: errors.firstBlockingErrorId, warnings: [],
  };
  await Promise.all([
    validateWithSchema(options.labRoot, "task-verification.schema.json", verification),
    validateWithSchema(options.labRoot, "error-events.schema.json", errors),
  ]);
  await writeJson(path.join(options.outputDir, "verification.json"), verification);
  await writeJson(path.join(options.outputDir, "errors.json"), errors);
  return { verification, errors, acceptance };
}

async function evaluateAcceptance(base: AcceptanceDocument, worktree: string, inspect: InspectResult | undefined, steps: VerificationStep[], phase: "before" | "after"): Promise<AcceptanceDocument> {
  const result = structuredClone(base);
  const changed = inspect?.changedFiles.filter((item) => !item.generated) ?? [];
  for (const criterion of result.criteria) {
    criterion.evidence = [];
    criterion.warnings = [];
    const expected = typeof criterion.expected === "object" && criterion.expected !== null ? criterion.expected as Record<string, unknown> : {};
    const expectedPath = typeof expected.path === "string" ? expected.path : null;
    const expectedPaths = Array.isArray(expected.paths) ? expected.paths.filter((item): item is string => typeof item === "string") : [];
    try {
      if (criterion.type === "manual_check" || criterion.type === "browser_check" || criterion.type === "custom") {
        criterion.status = "manual_required"; criterion.actual = null; continue;
      }
      if (criterion.type === "source_change") {
        const pattern = typeof expected.glob === "string" ? expected.glob : "**";
        const matchesCount = changed.filter((item) => taskPathMatches(item.path, [pattern])).length;
        criterion.actual = { matchingChangedFiles: matchesCount };
        criterion.status = matchesCount >= Number(expected.minimumChangedFiles ?? 1) ? "passed" : "failed";
      } else if (criterion.type === "file_exists" && expectedPath) {
        criterion.actual = await exists(path.join(worktree, ...expectedPath.split("/")));
        criterion.status = criterion.actual ? "passed" : "failed";
      } else if (criterion.type === "file_not_changed") {
        const patterns = expectedPaths.length ? expectedPaths : expectedPath ? [expectedPath] : [];
        const touched = changed.filter((item) => taskPathMatches(item.path, patterns)).map((item) => item.path);
        criterion.actual = touched; criterion.status = touched.length ? "failed" : "passed";
      } else if (criterion.type === "path_allowed") {
        const patterns = expectedPaths.length ? expectedPaths : [String(expected.glob ?? "**")];
        const outside = changed.filter((item) => !taskPathMatches(item.path, patterns)).map((item) => item.path);
        criterion.actual = outside; criterion.status = outside.length ? "failed" : "passed";
      } else if (criterion.type === "path_denied") {
        const patterns = expectedPaths.length ? expectedPaths : [String(expected.glob ?? "")];
        const denied = changed.filter((item) => taskPathMatches(item.path, patterns)).map((item) => item.path);
        criterion.actual = denied; criterion.status = denied.length ? "failed" : "passed";
      } else if (["text_present", "text_absent", "export_present", "symbol_used"].includes(criterion.type) && expectedPath) {
        assertPortablePath(expectedPath, "acceptance path");
        const content = await readFile(path.join(worktree, ...expectedPath.split("/")), "utf8");
        const pattern = typeof expected.regex === "string" ? new RegExp(expected.regex, "mu") : null;
        const present = pattern ? pattern.test(content) : content.includes(String(expected.text ?? expected.symbol ?? ""));
        const shouldPresent = criterion.type !== "text_absent";
        criterion.actual = present; criterion.status = present === shouldPresent ? "passed" : "failed";
      } else if (criterion.type === "command_passes" || criterion.type === "http_status") {
        const stepId = String(expected.stepId ?? "");
        const step = steps.find((item) => item.id === stepId);
        criterion.actual = step?.status ?? null;
        criterion.status = step?.status === "passed" ? "passed" : step ? "failed" : phase === "before" ? "skipped" : "failed";
      } else {
        criterion.status = criterion.automated ? "failed" : "manual_required";
        criterion.warnings.push("unsupported evaluator configuration");
      }
    } catch (error) {
      criterion.actual = null; criterion.status = "failed"; criterion.warnings.push((error as Error).message);
    }
    criterion.evidence.push(`acceptance:${criterion.id}`);
  }
  result.summary = acceptanceSummary(result.criteria);
  return result;
}

export async function prepareTask(options: {
  labRoot: string;
  frameworkId: string;
  taskId: string;
  worktreeDir?: string;
  skipBeforeVerify?: boolean;
  forceCleanup?: boolean;
  dryRun?: boolean;
}): Promise<{ directory: string; preflight: Record<string, unknown> }> {
  const bundle = await loadBundle(options.labRoot, options.frameworkId, options.taskId);
  if (bundle.task.status !== "validated") throw new Error(`task prepare 需要 validated，当前为 ${bundle.task.status}。`);
  const config = await loadFrameworkConfig(options.labRoot, options.frameworkId);
  const source = resolveFromLab(options.labRoot, config.framework.source_dir);
  const relative = options.worktreeDir ? displayPath(options.labRoot, resolveFromLab(options.labRoot, options.worktreeDir)) : worktreeRelative(options.frameworkId, options.taskId);
  assertPortablePath(relative, "worktree directory");
  const target = path.resolve(options.labRoot, ...relative.split("/"));
  if (path.resolve(source) === target || !displayPath(options.labRoot, target).startsWith(".framework-sources/tasks/")) throw new Error("Task worktree 必须与原始 source 隔离并位于 .framework-sources/tasks/。");
  if (options.dryRun) return { directory: relative, preflight: { dryRun: true, sourceCommit: bundle.task.sourceCommit } };
  if (await exists(target)) {
    if (!options.forceCleanup) throw new Error(`Task worktree 已存在：${relative}`);
    const remove = await spawnCollect("git", ["-C", source, "worktree", "remove", "--force", target], source, 30_000);
    if (remove.exitCode !== 0) await rm(target, { recursive: true, force: true });
  }
  await mkdir(path.dirname(target), { recursive: true });
  const created = await spawnCollect("git", ["-C", source, "worktree", "add", "--detach", target, bundle.task.sourceCommit], source, 60_000);
  if (created.exitCode !== 0) throw new Error(`创建 detached worktree 失败：${created.stderr || created.error}`);
  const snapshot = await collectGitSnapshot(target);
  if (snapshot.commit !== bundle.task.sourceCommit) throw new Error("Preflight HEAD 与 sourceCommit 不一致。");
  if (snapshot.dirty) throw new Error("Preflight 初始 worktree 非 clean。");
  const pm = await packageManagerPreflight(options.labRoot, bundle);
  const catalog = await readJson<{ commit: string; rootHash: string }>(path.join(options.labRoot, "frameworks", options.frameworkId, "catalog", "current.json"));
  const symbols = await readJson<{ rootHash: string }>(path.join(options.labRoot, "frameworks", options.frameworkId, "symbols", "current.json"));
  if (catalog.commit !== bundle.task.sourceCommit || catalog.rootHash !== bundle.task.catalogRootHash || symbols.rootHash !== bundle.task.symbolRootHash) throw new Error("Preflight Catalog/Symbol source hash 不一致。");
  const preflight = {
    schemaVersion: SCHEMA_VERSION, checkedAt: now(), passed: true,
    head: snapshot.commit, trackedClean: true, initialUntracked: snapshot.changedFiles,
    nodeVersion: process.version, packageManager: { configured: pm.configured, actual: pm.version },
    catalogRootHash: catalog.rootHash, symbolRootHash: symbols.rootHash,
    contextReadable: await exists(path.join(bundle.dir, "context", "context.md")),
    verificationPlanValid: true,
    warnings: [],
  };
  const worktree = {
    schemaVersion: SCHEMA_VERSION, taskId: bundle.task.taskId, directory: relative,
    sourceRepository: displayPath(options.labRoot, source), sourceCommit: bundle.task.sourceCommit,
    head: snapshot.commit, detached: true, initialTrackedClean: true, initialUntracked: snapshot.changedFiles,
    createdAt: now(), status: "ready",
  };
  await validateWithSchema(options.labRoot, "task-worktree.schema.json", worktree);
  await Promise.all([
    writeJson(path.join(bundle.dir, "worktree.json"), worktree),
    writeJson(path.join(bundle.dir, "preflight.json"), preflight),
    mkdir(path.join(bundle.dir, "before", "logs"), { recursive: true }),
  ]);
  const beforeSource = { schemaVersion: SCHEMA_VERSION, commit: snapshot.commit, dirty: snapshot.dirty, changedFiles: snapshot.changedFiles, sourceFingerprint: sha(`${snapshot.commit}\0${snapshot.changedFiles.join("\0")}`) };
  await writeJson(path.join(bundle.dir, "before", "source.json"), beforeSource);
  if (!options.skipBeforeVerify) await executePhase({ labRoot: options.labRoot, bundle, worktree: target, phase: "before", outputDir: path.join(bundle.dir, "before") });
  await transition(bundle, "prepared", "task prepare", "detached worktree and preflight passed", "preflight.json");
  return { directory: relative, preflight };
}

export async function handoffTask(labRoot: string, frameworkId: string, taskId: string): Promise<{ instructions: string; handoff: Record<string, unknown> }> {
  const bundle = await loadBundle(labRoot, frameworkId, taskId);
  if (bundle.task.status !== "prepared") throw new Error(`task handoff 需要 prepared，当前为 ${bundle.task.status}。`);
  const worktree = await readJson<{ directory: string; sourceCommit: string }>(path.join(bundle.dir, "worktree.json"));
  const context = await readFile(path.join(bundle.dir, "context", "context.md"), "utf8");
  const required = bundle.acceptance.criteria.filter((item) => item.required).map((item) => `- ${item.id}: ${item.title} — ${item.description}`).join("\n");
  const commands = bundle.plan.steps.filter((item) => item.type === "command").map((item) => `- ${item.id}: ${item.command} ${item.args.join(" ")} (cwd=${item.cwd})`).join("\n");
  const instructions = `# Coding Agent Handoff: ${taskId}

## Task

${bundle.task.originalTask}

## Exact workspace

- Working directory relative to Framework Lab: \`${worktree.directory}\`
- Required commit: \`${worktree.sourceCommit}\`

## Required acceptance

${required}

## Change policy

- Allowed: ${bundle.policy.allowedPaths.map((item) => `\`${item}\``).join(", ")}
- Denied: ${bundle.policy.deniedPaths.map((item) => `\`${item}\``).join(", ")}
- Maximum changed files: ${bundle.policy.maxChangedFiles}
- Maximum diff lines: ${bundle.policy.maxDiffLines}

## Suggested verification order

${commands || "- Framework Lab will run configured verification after modification."}

## Context

${context}

## Mandatory operating rules

- Do not commit, merge, rebase, reset, or push.
- Do not use sub-agents.
- Do not read other Framework Lab historical materials.
- Modify only the allowed task worktree.
- Stop after implementing and making a concise factual report. Framework Lab will independently inspect and verify; do not run \`task verify\`.

## Final report

Report changed files, implementation summary, commands actually run, failures, and unverified manual behavior. Do not claim Framework Lab verification passed.
`;
  const fingerprint = sha(`${worktree.directory}\0${worktree.sourceCommit}\0${bundle.task.contextSha256}`);
  const handoff = {
    schemaVersion: SCHEMA_VERSION, taskId, contextHash: bundle.task.contextSha256,
    worktreeFingerprint: fingerprint, instructionHash: sha(instructions), generatedAt: now(),
    status: "ready", externalAgent: null, externalAgentVersion: null, model: null,
    reasoningLevel: null, sessionUsage: null, startedAt: null, finishedAt: null,
  };
  await validateWithSchema(labRoot, "task-handoff.schema.json", handoff);
  await mkdir(path.join(bundle.dir, "handoff"), { recursive: true });
  await Promise.all([
    writeFile(path.join(bundle.dir, "handoff", "agent-instructions.md"), instructions, "utf8"),
    writeJson(path.join(bundle.dir, "handoff", "handoff.json"), handoff),
  ]);
  await transition(bundle, "handed_off", "task handoff", "agent handoff generated; external agent not started", "handoff/handoff.json");
  return { instructions, handoff };
}

function parsePorcelainZ(output: string, generatedPatterns: string[]): ChangedFile[] {
  const parts = output.split("\0").filter(Boolean), result: ChangedFile[] = [];
  for (let index = 0; index < parts.length; index += 1) {
    const entry = parts[index]!;
    const code = entry.slice(0, 2), file = portablePath(entry.slice(3));
    if (code === "!!") continue;
    const status: ChangedFile["status"] = code === "??" ? "untracked" : code.includes("A") ? "added" : code.includes("D") ? "deleted" : code.includes("R") ? "renamed" : "modified";
    let oldPath: string | null = null;
    if (status === "renamed") { oldPath = file; index += 1; }
    const actualPath = status === "renamed" ? portablePath(parts[index] ?? file) : file;
    result.push({ path: actualPath, status, oldPath, generated: taskPathMatches(actualPath, generatedPatterns), binary: false });
  }
  return result;
}

async function buildPatch(worktree: string, files: ChangedFile[]): Promise<string> {
  const tracked = await spawnCollect("git", ["-c", "core.quotepath=false", "-C", worktree, "diff", "--binary", "HEAD", "--"], worktree, 30_000);
  let patch = tracked.stdout;
  for (const file of files.filter((item) => item.status === "untracked" && !item.generated)) {
    const result = await spawnCollect("git", ["-c", "core.quotepath=false", "-C", worktree, "diff", "--no-index", "--binary", "--", "/dev/null", file.path], worktree, 30_000);
    patch += result.stdout;
  }
  return patch;
}

export async function inspectTask(labRoot: string, frameworkId: string, taskId: string): Promise<{ inspect: InspectResult; policy: PolicyResult }> {
  const bundle = await loadBundle(labRoot, frameworkId, taskId);
  if (!["handed_off", "modified", "policy_failed", "verification_failed", "verification_partial", "verification_passed"].includes(bundle.task.status)) throw new Error(`task inspect 不适用于状态 ${bundle.task.status}。`);
  const worktree = await resolveWorktree(labRoot, bundle);
  const [headResult, statusResult, ignoredResult, rawResult] = await Promise.all([
    spawnCollect("git", ["-C", worktree, "rev-parse", "HEAD"], worktree),
    spawnCollect("git", ["-c", "core.quotepath=false", "-C", worktree, "status", "--porcelain=v1", "-z", "--untracked-files=all"], worktree),
    spawnCollect("git", ["-c", "core.quotepath=false", "-C", worktree, "status", "--porcelain=v1", "-z", "--ignored=matching"], worktree),
    spawnCollect("git", ["-C", worktree, "diff", "--raw", "HEAD"], worktree),
  ]);
  if (statusResult.exitCode !== 0) throw new Error(`inspect git status 失败：${statusResult.stderr}`);
  const changedFiles = parsePorcelainZ(statusResult.stdout, bundle.policy.generatedDirectoriesIgnored);
  const generatedFiles = ignoredResult.stdout.split("\0").filter((item) => item.startsWith("!! ")).map((item) => portablePath(item.slice(3))).filter((item) => taskPathMatches(item, bundle.policy.generatedDirectoriesIgnored));
  const patch = await buildPatch(worktree, changedFiles);
  for (const file of changedFiles) file.binary = patch.includes(`Binary files a/${file.path}`) || patch.includes("GIT binary patch");
  const conflictMarkers: string[] = [];
  for (const file of changedFiles.filter((item) => !item.generated && item.status !== "deleted" && !item.binary)) {
    try {
      const content = await readFile(path.join(worktree, ...file.path.split("/")), "utf8");
      if (/^(?:<<<<<<<|=======|>>>>>>>)/mu.test(content)) conflictMarkers.push(file.path);
    } catch { /* binary or vanished */ }
  }
  const counted = changedFiles.filter((item) => !item.generated);
  const lineCount = patch.split(/\r?\n/u).filter((line) => /^(?:\+|-)/u.test(line) && !/^(?:\+\+\+|---)/u.test(line)).length;
  const patchHash = sha(patch);
  const head = headResult.exitCode === 0 ? headResult.stdout.trim() : null;
  const inspect: InspectResult = {
    schemaVersion: SCHEMA_VERSION, taskId, inspectedAt: now(), head,
    headMatchesBaseline: head === bundle.task.sourceCommit,
    trackedStatus: changedFiles.filter((item) => item.status !== "untracked").map((item) => item.path),
    untrackedStatus: changedFiles.filter((item) => item.status === "untracked").map((item) => item.path),
    generatedFiles, changedFiles,
    counts: {
      changed: counted.length,
      added: counted.filter((item) => item.status === "added" || item.status === "untracked").length,
      modified: counted.filter((item) => item.status === "modified").length,
      deleted: counted.filter((item) => item.status === "deleted").length,
      renamed: counted.filter((item) => item.status === "renamed").length,
      untracked: counted.filter((item) => item.status === "untracked").length,
    },
    diffLines: lineCount, patchSha256: patchHash, conflictMarkers,
    lockfilesChanged: counted.filter((item) => /(?:^|\/)(?:pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$/u.test(item.path)).map((item) => item.path),
    manifestsChanged: counted.filter((item) => /(?:^|\/)package\.json$/u.test(item.path)).map((item) => item.path),
    binaryFiles: counted.filter((item) => item.binary).map((item) => item.path),
    submodulesChanged: rawResult.stdout.split(/\r?\n/u).filter((line) => line.includes("160000")).map((line) => line.trim()),
    sourceFingerprint: sha(`${head ?? ""}\0${counted.map((item) => `${item.status}:${item.path}`).sort().join("\0")}\0${patchHash}`),
  };
  const changesDir = path.join(bundle.dir, "changes");
  await mkdir(changesDir, { recursive: true });
  await Promise.all([
    writeJson(path.join(changesDir, "status.json"), { head, porcelain: changedFiles, generatedFiles }),
    writeJson(path.join(changesDir, "changed-files.json"), { schemaVersion: SCHEMA_VERSION, taskId, files: changedFiles, counts: inspect.counts }),
    writeFile(path.join(changesDir, "patch.diff"), patch, "utf8"),
    writeFile(path.join(changesDir, "patch.sha256"), `${patchHash}\n`, "utf8"),
  ]);
  const policy = evaluateChangePolicy(bundle.policy, inspect);
  await writeJson(path.join(changesDir, "policy-result.json"), policy);
  bundle.task.metrics.changedFiles = inspect.counts.changed;
  bundle.task.metrics.diffLines = inspect.diffLines;
  bundle.task.metrics.policyViolationCount = policy.blockingViolations.length;
  await writeJson(path.join(bundle.dir, "task.json"), bundle.task);
  if (bundle.task.status === "handed_off" && inspect.counts.changed > 0) await transition(bundle, "modified", "task inspect", "source changes independently collected", "changes/changed-files.json");
  else await updateManifest(bundle.dir, bundle.task);
  return { inspect, policy };
}

export function evaluateChangePolicy(policy: ChangePolicy, inspect: InspectResult): PolicyResult {
  const passedRules: string[] = [], failedRules: string[] = [], warnings: string[] = [], evidence: string[] = [], blocking: string[] = [];
  const check = (id: string, passed: boolean, message: string, warning = false) => {
    if (passed) passedRules.push(id);
    else if (warning) { warnings.push(message); failedRules.push(id); }
    else { failedRules.push(id); blocking.push(message); }
  };
  const files = inspect.changedFiles.filter((item) => !item.generated);
  check("allowed-paths", files.every((item) => taskPathMatches(item.path, policy.allowedPaths)), `allowlist 外修改：${files.filter((item) => !taskPathMatches(item.path, policy.allowedPaths)).map((item) => item.path).join(", ")}`);
  check("denied-paths", files.every((item) => !taskPathMatches(item.path, policy.deniedPaths)), `denylist 修改：${files.filter((item) => taskPathMatches(item.path, policy.deniedPaths)).map((item) => item.path).join(", ")}`);
  check("max-changed-files", inspect.counts.changed <= policy.maxChangedFiles, `changed files ${inspect.counts.changed} > ${policy.maxChangedFiles}`);
  check("max-added-files", inspect.counts.added <= policy.maxAddedFiles, `added files ${inspect.counts.added} > ${policy.maxAddedFiles}`);
  check("max-deleted-files", inspect.counts.deleted <= policy.maxDeletedFiles, `deleted files ${inspect.counts.deleted} > ${policy.maxDeletedFiles}`);
  check("max-diff-lines", inspect.diffLines <= policy.maxDiffLines, `diff lines ${inspect.diffLines} > ${policy.maxDiffLines}`);
  const untracked = files.filter((item) => item.status === "untracked");
  check("untracked-files", policy.allowUntrackedFiles ? untracked.every((item) => taskPathMatches(item.path, policy.allowedUntrackedPaths)) : untracked.length === 0, `不允许的 untracked：${untracked.map((item) => item.path).join(", ")}`);
  check("denied-extensions", files.every((item) => !policy.deniedExtensions.some((extension) => item.path.endsWith(extension))), "修改了禁止扩展名文件");
  check("lockfiles-read-only", !policy.lockfilesReadOnly || inspect.lockfilesChanged.length === 0, `lockfile changed：${inspect.lockfilesChanged.join(", ")}`);
  check("manifests-read-only", !policy.manifestsReadOnly || inspect.manifestsChanged.length === 0, `manifest changed：${inspect.manifestsChanged.join(", ")}`);
  check("no-conflict-markers", !policy.requireNoConflictMarkers || inspect.conflictMarkers.length === 0, `conflict markers：${inspect.conflictMarkers.join(", ")}`);
  check("no-binary", inspect.binaryFiles.length === 0, `binary changes：${inspect.binaryFiles.join(", ")}`);
  check("no-submodule", inspect.submodulesChanged.length === 0, "submodule 修改");
  check("head-baseline", inspect.headMatchesBaseline, "HEAD 已变化，可能发生 commit/reset/rebase");
  check("patch", !policy.requirePatch || inspect.patchSha256 !== sha(""), "缺少源码 patch");
  evidence.push("changes/changed-files.json", "changes/patch.diff", "changes/patch.sha256");
  return {
    schemaVersion: SCHEMA_VERSION, taskId: inspect.taskId, evaluatedAt: now(),
    overallStatus: blocking.length ? "failed" : "passed", passedRules, failedRules, warnings,
    evidence, blockingViolations: blocking,
  };
}

function verificationReport(bundle: TaskBundle, verification: VerificationDocument, policy: PolicyResult): string {
  return `# Task Verification Report: ${bundle.task.taskId}

- Framework: ${bundle.task.frameworkId}
- Source commit: \`${bundle.task.sourceCommit}\`
- Task status: \`${bundle.task.status}\`
- Verification status: \`${verification.status}\`
- Policy: \`${policy.overallStatus}\`

## Steps

| Step | Status | Exit | Duration |
|---|---|---:|---:|
${verification.steps.map((step) => `| ${step.id} | ${step.status} | ${step.exitCode ?? "null"} | ${step.durationMs} ms |`).join("\n")}

## Acceptance

| Criterion | Required | Automated | Status |
|---|---:|---:|---|
${verification.acceptance.criteria.map((item) => `| ${item.id} | ${item.required} | ${item.automated} | ${item.status} |`).join("\n")}

## Policy violations

${policy.blockingViolations.map((item) => `- ${item}`).join("\n") || "- None."}

## Errors

- Total: ${verification.errorSummary.total}
- First blocking error: ${verification.firstBlockingErrorId ?? "none"}

## Limitations

- Verification only proves configured acceptance and commands.
- Manual and browser checks are not automatically passed.
- Framework Lab did not generate, accept, commit, merge, or push code.
`;
}

export async function verifyTask(options: {
  labRoot: string;
  frameworkId: string;
  taskId: string;
  verifyDespitePolicyFailure?: boolean;
  skipManual?: boolean;
  steps?: string[];
  force?: boolean;
  dryRun?: boolean;
}): Promise<{ verification: VerificationDocument | null; policy: PolicyResult }> {
  if (options.dryRun) {
    return { verification: null, policy: { schemaVersion: SCHEMA_VERSION, taskId: options.taskId, evaluatedAt: now(), overallStatus: "passed", passedRules: [], failedRules: [], warnings: ["dry-run"], evidence: [], blockingViolations: [] } };
  }
  const inspected = await inspectTask(options.labRoot, options.frameworkId, options.taskId);
  const refreshed = await loadBundle(options.labRoot, options.frameworkId, options.taskId);
  const verifiableStatuses: TaskStatus[] = ["modified", "policy_failed", "verification_failed", "verification_partial", "verification_passed"];
  if (!verifiableStatuses.includes(refreshed.task.status) || (refreshed.task.status.startsWith("verification_") && !options.force)) {
    throw new Error("task verify 需要 Agent 产生源码修改；已验证任务须使用 --force 重跑。");
  }
  if (inspected.policy.overallStatus === "failed" && !options.verifyDespitePolicyFailure) {
    if (refreshed.task.status === "modified") await transition(refreshed, "policy_failed", "task verify", "blocking change policy violation", "changes/policy-result.json");
    return { verification: null, policy: inspected.policy };
  }
  const output = path.join(refreshed.dir, "after");
  if (await exists(path.join(output, "verification.json")) && !options.force) throw new Error("after verification 已存在；使用 --force 重跑派生验证产物。");
  if (options.force) await rm(output, { recursive: true, force: true });
  await mkdir(path.join(output, "logs"), { recursive: true });
  const worktree = await resolveWorktree(options.labRoot, refreshed);
  const result = await executePhase({
    labRoot: options.labRoot, bundle: refreshed, worktree, phase: "after", outputDir: output,
    inspect: inspected.inspect,
    ...(options.skipManual !== undefined ? { skipManual: options.skipManual } : {}),
    ...(options.steps !== undefined ? { selectedSteps: options.steps } : {}),
  });
  const snapshot = await collectGitSnapshot(worktree);
  await writeJson(path.join(output, "source.json"), {
    schemaVersion: SCHEMA_VERSION, commit: snapshot.commit, dirty: snapshot.dirty,
    changedFiles: snapshot.changedFiles, sourceFingerprint: inspected.inspect.sourceFingerprint,
  });
  await writeJson(path.join(refreshed.dir, "acceptance.json"), result.acceptance);
  refreshed.task.metrics.commandCount += result.verification.steps.length;
  refreshed.task.metrics.verificationCommandCount += result.verification.steps.length;
  refreshed.task.metrics.failedVerificationCount = result.verification.steps.filter((step) => ["failed", "timed_out"].includes(step.status)).length;
  refreshed.task.metrics.manualInterventionCount = result.acceptance.summary.manualRequired;
  await writeJson(path.join(refreshed.dir, "task.json"), refreshed.task);
  const targetStatus: TaskStatus = result.verification.status === "failed" ? "verification_failed" : result.verification.status === "partial" ? "verification_partial" : "verification_passed";
  await transition(refreshed, targetStatus, "task verify", `verification ${result.verification.status}`, "after/verification.json");
  const finalBundle = await loadBundle(options.labRoot, options.frameworkId, options.taskId);
  await writeFile(path.join(finalBundle.dir, "verification-report.md"), verificationReport(finalBundle, result.verification, inspected.policy), "utf8");
  await updateManifest(finalBundle.dir, finalBundle.task);
  return { verification: result.verification, policy: inspected.policy };
}

export async function compareTask(labRoot: string, frameworkId: string, taskId: string): Promise<Record<string, unknown>> {
  const bundle = await loadBundle(labRoot, frameworkId, taskId);
  const before = await readJson<VerificationDocument>(path.join(bundle.dir, "before", "verification.json")).catch(() => null);
  const after = await readJson<VerificationDocument>(path.join(bundle.dir, "after", "verification.json"));
  const changes = await readJson<{ files: ChangedFile[] }>(path.join(bundle.dir, "changes", "changed-files.json"));
  const policy = await readJson<PolicyResult>(path.join(bundle.dir, "changes", "policy-result.json"));
  const beforeErrors = await readJson<ErrorEventsDocument>(path.join(bundle.dir, "before", "errors.json")).catch(() => null);
  const afterErrors = await readJson<ErrorEventsDocument>(path.join(bundle.dir, "after", "errors.json"));
  const beforeFingerprints = new Set(beforeErrors?.events.map((item) => item.fingerprint) ?? []);
  const afterFingerprints = new Set(afterErrors.events.map((item) => item.fingerprint));
  const requiredAutomatedPassed = after.acceptance.criteria.filter((item) => item.required && item.automated).every((item) => item.status === "passed");
  const manual = after.acceptance.criteria.filter((item) => item.status === "manual_required").map((item) => item.id);
  const conclusion = policy.overallStatus === "failed" ? "candidate_violated_change_policy"
    : after.status === "failed" ? "candidate_failed_baseline"
      : manual.length ? "candidate_requires_manual_verification"
        : requiredAutomatedPassed ? "candidate_satisfied_automated_acceptance"
          : "candidate_preserved_baseline";
  const comparison = {
    schemaVersion: SCHEMA_VERSION, taskId, sourceCommit: bundle.task.sourceCommit,
    beforeStatus: before?.status ?? null, afterStatus: after.status,
    changedFiles: changes.files.map((item) => item.path),
    patchSha256: (await readFile(path.join(bundle.dir, "changes", "patch.sha256"), "utf8")).trim(),
    policyStatus: policy.overallStatus,
    acceptanceBefore: before?.acceptance.criteria.map((item) => ({ id: item.id, status: item.status })) ?? [],
    acceptanceAfter: after.acceptance.criteria.map((item) => ({ id: item.id, status: item.status })),
    verificationStepsBefore: before?.planSteps.map((item) => ({ id: item.id, status: item.status, durationMs: before.steps.find((step) => step.id === item.id)?.durationMs ?? null })) ?? [],
    verificationStepsAfter: after.planSteps.map((item) => ({ id: item.id, status: item.status, durationMs: after.steps.find((step) => step.id === item.id)?.durationMs ?? null })),
    errorSummaryBefore: beforeErrors?.summary ?? null, errorSummaryAfter: afterErrors.summary,
    newErrors: [...afterFingerprints].filter((item) => !beforeFingerprints.has(item)),
    resolvedErrors: [...beforeFingerprints].filter((item) => !afterFingerprints.has(item)),
    unchangedErrors: [...afterFingerprints].filter((item) => beforeFingerprints.has(item)),
    performanceDurations: {
      beforeMs: before?.steps.reduce((total, step) => total + step.durationMs, 0) ?? null,
      afterMs: after.steps.reduce((total, step) => total + step.durationMs, 0),
    },
    manualChecks: manual, finalConclusion: conclusion,
    limitations: ["只证明配置的验收条件。", "manual/browser check 未自动通过。"],
  };
  await validateWithSchema(labRoot, "task-comparison.schema.json", comparison);
  await writeJson(path.join(bundle.dir, "comparison.json"), comparison);
  await updateManifest(bundle.dir, bundle.task);
  return comparison;
}

export async function taskStatus(labRoot: string, frameworkId: string, taskId: string): Promise<Record<string, unknown>> {
  const bundle = await loadBundle(labRoot, frameworkId, taskId);
  return {
    taskId, frameworkId, status: bundle.task.status, currentPhase: bundle.task.currentPhase,
    sourceCommit: bundle.task.sourceCommit, updatedAt: bundle.task.updatedAt,
    metrics: bundle.task.metrics,
  };
}

export async function listTasks(labRoot: string, frameworkId: string): Promise<Array<Record<string, unknown>>> {
  const root = path.join(labRoot, "frameworks", frameworkId, "tasks");
  const result: Array<Record<string, unknown>> = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || !ID.test(entry.name)) continue;
    try { result.push(await taskStatus(labRoot, frameworkId, entry.name)); } catch { /* authored legacy task or incomplete directory */ }
  }
  return result.sort((a, b) => String(a.taskId).localeCompare(String(b.taskId)));
}

export async function closeTask(options: {
  labRoot: string;
  frameworkId: string;
  taskId: string;
  outcome: "accepted" | "rejected" | "archived";
  reason: string;
  manualConfirmations?: string[];
}): Promise<Record<string, unknown>> {
  const bundle = await loadBundle(options.labRoot, options.frameworkId, options.taskId);
  if (!["verification_passed", "verification_partial", "verification_failed", "policy_failed"].includes(bundle.task.status)) throw new Error(`task close 不适用于状态 ${bundle.task.status}。`);
  const manual = bundle.acceptance.criteria.filter((item) => item.required && item.status === "manual_required").map((item) => item.id);
  const confirmations = new Set(options.manualConfirmations ?? []);
  const automatedPassed = bundle.acceptance.criteria.filter((item) => item.required && item.automated).every((item) => item.status === "passed");
  if (options.outcome === "accepted") {
    if (!["verification_passed", "verification_partial"].includes(bundle.task.status) || !automatedPassed) throw new Error("accepted close 要求 required automated acceptance 全部通过。");
    if (manual.some((id) => !confirmations.has(id))) throw new Error(`仍需人工确认：${manual.filter((id) => !confirmations.has(id)).join(", ")}`);
  }
  const manifest = await readJson<{ files: Array<{ path: string; sha256: string }> }>(path.join(bundle.dir, "manifest.json"));
  const close = {
    schemaVersion: SCHEMA_VERSION, taskId: bundle.task.taskId, finalStatus: bundle.task.status,
    outcome: options.outcome, reason: options.reason, manualConfirmations: [...confirmations].sort(),
    outputHashes: Object.fromEntries(manifest.files.map((item) => [item.path, item.sha256])),
    closedAt: now(),
  };
  await writeJson(path.join(bundle.dir, "close.json"), close);
  await transition(bundle, "closed", "task close", `${options.outcome}: ${options.reason}`, "close.json");
  return close;
}
