#!/usr/bin/env node
import { access } from "node:fs/promises";
import path from "node:path";
import { runBaseline } from "./lib/baseline.js";
import { diffCatalog, listCatalog, scanCatalog, validateCatalog } from "./lib/catalog.js";
import { loadFrameworkConfig } from "./lib/config.js";
import { parseHistoricalRunErrors } from "./lib/errors.js";
import { runKnowledgeEvaluation, validateEvaluationSet } from "./lib/evaluation.js";
import { createAgentContext, generateKnowledgeIndex, validateKnowledge } from "./lib/knowledge.js";
import { displayPath, findLabRoot, resolveFromLab } from "./lib/paths.js";
import { normalizeRunId, previewNextRunId } from "./lib/run-id.js";
import { explainRetrieval, queryRetrieval, validateRetrieval } from "./lib/retrieval.js";
import { diffSymbols, extractSymbols, listSymbols, querySymbols, validateSymbols } from "./lib/symbols.js";
import {
  closeTask,
  compareTask,
  createTask,
  handoffTask,
  inspectTask,
  listTasks,
  prepareTask,
  taskStatus,
  validateTask,
  verifyTask,
} from "./lib/task.js";
import { carryForwardKnowledge, coverage, createBundle, createRefreshBundle, createRefreshPlan, handoffLearning, importDraft, listLearning, planLearning, publishDraft, queryPublishedKnowledge, retireKnowledge, reviewDraft, showKnowledge, supersedeKnowledge, validateDraft } from "./lib/learn.js";
import {
  analyzeGaps,
  analyzeKnowledgeEconomics,
  deriveFamilies,
  detectKnowledgeConflicts,
  evaluateKnowledgeQuality,
  prioritizeLearning,
  reviewFamily,
} from "./lib/learning-analysis.js";
import { createVersion, createVersionDiff, freshness, knowledgeImpact, listVersions, validateVersion } from "./lib/version.js";

const HELP = `Framework Lab v0.2.3

用法：
  pnpm framework-lab task create <framework-id> --task <text> [options]
  pnpm framework-lab task validate <framework-id> <task-id>
  pnpm framework-lab task prepare <framework-id> <task-id> [options]
  pnpm framework-lab task handoff <framework-id> <task-id>
  pnpm framework-lab task inspect <framework-id> <task-id>
  pnpm framework-lab task verify <framework-id> <task-id> [options]
  pnpm framework-lab task compare <framework-id> <task-id>
  pnpm framework-lab task status <framework-id> <task-id>
  pnpm framework-lab task close <framework-id> <task-id> [options]
  pnpm framework-lab task list <framework-id>
  pnpm framework-lab learn plan <framework-id>
  pnpm framework-lab learn bundle <framework-id> <topic-id> [--budget <n>]
  pnpm framework-lab learn handoff <framework-id> <bundle-id>
  pnpm framework-lab learn import <framework-id> <bundle-id> --input <file>
  pnpm framework-lab learn validate|review|publish|supersede <framework-id> <knowledge-id>
  pnpm framework-lab learn coverage|list <framework-id>
  pnpm framework-lab learn gaps|prioritize|families|quality|conflicts|economics <framework-id>
  pnpm framework-lab learn evaluate|validate-evaluation <framework-id>
  pnpm framework-lab learn review-family <framework-id> <family-id> --decision approved|rejected --name <name> --reviewer <reviewer>
  pnpm framework-lab learn show <framework-id> <knowledge-id>
  pnpm framework-lab symbols extract <framework-id> [options]
  pnpm framework-lab symbols validate <framework-id>
  pnpm framework-lab symbols list <framework-id>
  pnpm framework-lab symbols query <framework-id> [options]
  pnpm framework-lab symbols diff <framework-id> <from-snapshot> <to-snapshot> [--force]
  pnpm framework-lab catalog scan <framework-id> [options]
  pnpm framework-lab catalog validate <framework-id>
  pnpm framework-lab catalog list <framework-id>
  pnpm framework-lab catalog diff <framework-id> <from-snapshot> <to-snapshot> [--force]
  pnpm framework-lab baseline run <framework-id> [options]
  pnpm framework-lab errors parse <framework-id> <run-id> [--force]
  pnpm framework-lab knowledge validate <framework-id>
  pnpm framework-lab knowledge index <framework-id>
  pnpm framework-lab retrieval query <framework-id> --task <text> [options]
  pnpm framework-lab retrieval validate <framework-id> <retrieval-id>
  pnpm framework-lab retrieval explain <framework-id> <retrieval-id>
  pnpm framework-lab context create <framework-id> --task <text> [options]

baseline run 选项：
  --run-id <id>       指定 run id（例如 run-011 或 011）
  --source-dir <dir>  覆盖配置中的源码目录；相对路径从仓库根目录解析
  --dry-run           只显示步骤，不创建 run 或执行框架命令

errors parse 选项：
  --force             显式覆盖已有 errors.json
  --help              显示帮助
`;

async function handleTask(labRoot: string, args: string[]): Promise<boolean> {
  if (args[0] !== "task") return false;
  const action = args[1], frameworkId = args[2], taskId = args[3];
  if (!action || !frameworkId) throw new Error("请使用 task create|validate|prepare|handoff|inspect|verify|compare|status|close|list <framework-id>。");
  const one = (name: string) => optionValues(args, name).at(-1);
  if (action === "create") {
    const budget = one("--budget");
    const requestedTaskId = one("--task-id"), sourceCommit = one("--source-commit"), runId = one("--run-id");
    const catalogSnapshot = one("--catalog-snapshot"), symbolSnapshot = one("--symbol-snapshot");
    const acceptanceFile = one("--acceptance-file"), policyFile = one("--policy-file"), verificationFile = one("--verification-file");
    const result = await createTask({
      labRoot, frameworkId, task: one("--task") ?? "",
      ...(requestedTaskId ? { taskId: requestedTaskId } : {}),
      ...(sourceCommit ? { sourceCommit } : {}),
      ...(runId ? { runId } : {}),
      ...(catalogSnapshot ? { catalogSnapshot } : {}),
      ...(symbolSnapshot ? { symbolSnapshot } : {}),
      ...(budget ? { budget: Number(budget) } : {}),
      ...(acceptanceFile ? { acceptanceFile: resolveFromLab(labRoot, acceptanceFile) } : {}),
      ...(policyFile ? { policyFile: resolveFromLab(labRoot, policyFile) } : {}),
      ...(verificationFile ? { verificationFile: resolveFromLab(labRoot, verificationFile) } : {}),
      includeCards: optionValues(args, "--include-card"), excludeCards: optionValues(args, "--exclude-card"),
      dryRun: args.includes("--dry-run"), force: args.includes("--force"),
    });
    console.log(`${result.task.taskId}: ${result.task.status}${result.directory ? ` (${displayPath(labRoot, result.directory)})` : " (dry-run)"}`);
    return true;
  }
  if (action === "list") {
    for (const item of await listTasks(labRoot, frameworkId)) console.log(`${String(item.taskId)} ${String(item.status)} ${String(item.sourceCommit)}`);
    return true;
  }
  if (!taskId) throw new Error(`task ${action} 缺少 task id。`);
  if (action === "validate") {
    const result = await validateTask(labRoot, frameworkId, taskId); console.log(`${taskId}: ${result.task.status}`); return true;
  }
  if (action === "prepare") {
    const worktreeDir = one("--worktree-dir");
    const result = await prepareTask({
      labRoot, frameworkId, taskId,
      ...(worktreeDir ? { worktreeDir } : {}),
      skipBeforeVerify: args.includes("--skip-before-verify"), forceCleanup: args.includes("--force-cleanup"), dryRun: args.includes("--dry-run"),
    });
    console.log(`${taskId}: worktree=${result.directory}${args.includes("--dry-run") ? " (dry-run)" : ""}`); return true;
  }
  if (action === "handoff") {
    await handoffTask(labRoot, frameworkId, taskId); console.log(`${taskId}: handed_off`); return true;
  }
  if (action === "inspect") {
    const result = await inspectTask(labRoot, frameworkId, taskId);
    console.log(`${taskId}: changed=${result.inspect.counts.changed}, policy=${result.policy.overallStatus}`); return true;
  }
  if (action === "verify") {
    const result = await verifyTask({
      labRoot, frameworkId, taskId,
      verifyDespitePolicyFailure: args.includes("--verify-despite-policy-failure"),
      skipManual: args.includes("--skip-manual"), steps: optionValues(args, "--step"),
      force: args.includes("--force"), dryRun: args.includes("--dry-run"),
    });
    console.log(`${taskId}: policy=${result.policy.overallStatus}, verification=${result.verification?.status ?? "not-run"}`);
    if (result.policy.overallStatus === "failed" && !args.includes("--verify-despite-policy-failure")) process.exitCode = 1;
    return true;
  }
  if (action === "compare") {
    const result = await compareTask(labRoot, frameworkId, taskId); console.log(`${taskId}: ${String(result.finalConclusion)}`); return true;
  }
  if (action === "status") {
    console.log(JSON.stringify(await taskStatus(labRoot, frameworkId, taskId), null, 2)); return true;
  }
  if (action === "close") {
    const outcome = one("--outcome");
    if (!outcome || !["accepted", "rejected", "archived"].includes(outcome)) throw new Error("--outcome 必须为 accepted|rejected|archived。");
    const result = await closeTask({
      labRoot, frameworkId, taskId, outcome: outcome as "accepted" | "rejected" | "archived",
      reason: one("--reason") ?? "", manualConfirmations: optionValues(args, "--confirm-manual"),
    });
    console.log(`${taskId}: closed (${String(result.outcome)})`); return true;
  }
  throw new Error(`未知 task 操作：${action}`);
}

async function handleLearn(labRoot: string, args: string[]): Promise<boolean> {
  if (args[0] !== "learn") return false;
  const action = args[1], frameworkId = args[2], id = args[3];
  if (!action || !frameworkId) throw new Error("请使用 learn <action> <framework-id>。");
  const one = (name: string) => optionValues(args, name).at(-1);
  if (action === "plan") { const result = await planLearning(labRoot, frameworkId); console.log(`${frameworkId}: ${result.topics.length} topics`); return true; }
  if (action === "bundle") { if (!id) throw new Error("learn bundle 缺少 topic-id。"); const result = await createBundle(labRoot, frameworkId, id, Number(one("--budget") ?? 6000)); console.log(`${result.bundle.bundleId}: ${result.bundle.estimatedTokens} estimated tokens`); return true; }
  if (action === "handoff") { if (!id) throw new Error("learn handoff 缺少 bundle-id。"); await handoffLearning(labRoot, frameworkId, id); console.log(`${id}: handed_off`); return true; }
  if (action === "import") { if (!id || !one("--input")) throw new Error("learn import 需要 bundle-id 和 --input。"); const knowledgeId = await importDraft(labRoot, frameworkId, id, resolveFromLab(labRoot, one("--input")!), args.includes("--dry-run")); console.log(`${knowledgeId}: ${args.includes("--dry-run") ? "preflight_passed" : "draft_imported"}`); return true; }
  if (action === "validate") { if (!id) throw new Error("learn validate 缺少 knowledge-id。"); await validateDraft(labRoot, frameworkId, id); console.log(`${id}: validated`); return true; }
  if (action === "review") { if (!id) throw new Error("learn review 缺少 knowledge-id。"); await reviewDraft(labRoot, frameworkId, id, { approve: optionValues(args, "--approve-claim"), reject: optionValues(args, "--reject-claim"), manual: optionValues(args, "--mark-manual"), limitations: optionValues(args, "--add-limitation"), approveRecipes: optionValues(args, "--approve-recipe"), rejectRecipes: optionValues(args, "--reject-recipe") }); console.log(`${id}: reviewed`); return true; }
  if (action === "publish") { if (!id) throw new Error("learn publish 缺少 knowledge-id。"); await publishDraft(labRoot, frameworkId, id); console.log(`${id}: published`); return true; }
  if (action === "supersede") { if (!id) throw new Error("learn supersede 缺少 knowledge-id。"); await supersedeKnowledge(labRoot, frameworkId, id); console.log(`${id}: superseded`); return true; }
  if (action === "refresh-plan") { if (!id) throw new Error("learn refresh-plan 缺少 impact-id。"); const result = await createRefreshPlan(labRoot, frameworkId, id); console.log(`${result.refreshId}: ${result.topics.length} topics`); return true; }
  if (action === "refresh-bundle") { if (!id || !args[4]) throw new Error("learn refresh-bundle 需要 refresh-id 和 refresh-topic-id。"); const result = await createRefreshBundle(labRoot, frameworkId, id, args[4]); console.log(`${result.bundleId}: ${result.estimatedTokens} estimated tokens`); return true; }
  if (action === "carry-forward") { if (!id) throw new Error("learn carry-forward 缺少 knowledge-id。"); const revision = await carryForwardKnowledge(labRoot, frameworkId, id); console.log(`${revision}: carried_forward`); return true; }
  if (action === "retire") { if (!id) throw new Error("learn retire 缺少 knowledge-id。"); await retireKnowledge(labRoot, frameworkId, id); console.log(`${id}: retired record created`); return true; }
  if (action === "coverage") { console.log(JSON.stringify(await coverage(labRoot, frameworkId), null, 2)); return true; }
  if (action === "gaps") { console.log(JSON.stringify(await analyzeGaps(labRoot, frameworkId), null, 2)); return true; }
  if (action === "prioritize") { console.log(JSON.stringify(await prioritizeLearning(labRoot, frameworkId), null, 2)); return true; }
  if (action === "families") { console.log(JSON.stringify(await deriveFamilies(labRoot, frameworkId), null, 2)); return true; }
  if (action === "review-family") {
    if (!id) throw new Error("learn review-family 缺少 family-id。");
    const decision = one("--decision");
    if (decision !== "approved" && decision !== "rejected") throw new Error("--decision 必须是 approved 或 rejected。");
    const name = one("--name"), reviewer = one("--reviewer");
    if (!name || !reviewer) throw new Error("learn review-family 需要 --name 和 --reviewer。");
    console.log(JSON.stringify(await reviewFamily(labRoot, frameworkId, id, {
      decision,
      name,
      reviewer,
      includeComponents: optionValues(args, "--component"),
      limitations: optionValues(args, "--add-limitation"),
    }), null, 2));
    return true;
  }
  if (action === "quality") { console.log(JSON.stringify(await evaluateKnowledgeQuality(labRoot, frameworkId), null, 2)); return true; }
  if (action === "conflicts") { console.log(JSON.stringify(await detectKnowledgeConflicts(labRoot, frameworkId), null, 2)); return true; }
  if (action === "economics") { console.log(JSON.stringify(await analyzeKnowledgeEconomics(labRoot, frameworkId), null, 2)); return true; }
  if (action === "validate-evaluation") { const result = await validateEvaluationSet(labRoot, frameworkId); console.log(`${frameworkId}: ${result.tasks.length} evaluation tasks validated`); return true; }
  if (action === "evaluate") { const result = await runKnowledgeEvaluation(labRoot, frameworkId); console.log(`${frameworkId}: ${result.aggregate.taskCount} tasks evaluated, ${result.businessHash}`); return true; }
  if (action === "list") { console.log(JSON.stringify(await listLearning(labRoot, frameworkId), null, 2)); return true; }
  if (action === "show") { if (!id) throw new Error("learn show 缺少 knowledge-id。"); console.log(JSON.stringify(await showKnowledge(labRoot, frameworkId, id), null, 2)); return true; }
  if (action === "query") { const text = one("--text"); if (!text) throw new Error("learn query 需要 --text。"); console.log(JSON.stringify(await queryPublishedKnowledge(labRoot, frameworkId, text, one("--source-commit")), null, 2)); return true; }
  throw new Error(`未知 learn 操作：${action}`);
}

async function handleRetrieval(labRoot: string, args: string[]): Promise<boolean> {
  if (args[0] !== "retrieval") return false;
  const action = args[1], frameworkId = args[2];
  if (!action || !frameworkId) throw new Error("请使用 retrieval query|validate|explain <framework-id>。");
  if (action === "validate" || action === "explain") {
    const retrievalId = args[3]; if (!retrievalId) throw new Error(`${action} 缺少 retrieval id。`);
    if (action === "validate") {
      const errors = await validateRetrieval(labRoot, frameworkId, retrievalId);
      if (errors.length) throw new Error(errors.join("; "));
      console.log(`${retrievalId}: retrieval 验证通过。`);
    } else console.log(await explainRetrieval(labRoot, frameworkId, retrievalId));
    return true;
  }
  if (action !== "query") throw new Error(`未知 retrieval 操作：${action}`);
  const one = (name: string) => optionValues(args, name).at(-1);
  const maxDepth = one("--max-depth"), limit = one("--limit");
  const sourceCommit = one("--source-commit"), runId = one("--run-id"), catalogSnapshot = one("--catalog-snapshot");
  const symbolSnapshot = one("--symbol-snapshot"), retrievalId = one("--retrieval-id");
  const result = await queryRetrieval({
    labRoot, frameworkId, task: one("--task") ?? "",
    ...(sourceCommit ? { sourceCommit } : {}), ...(runId ? { runId } : {}),
    ...(catalogSnapshot ? { catalogSnapshot } : {}), ...(symbolSnapshot ? { symbolSnapshot } : {}),
    packages: optionValues(args, "--package"), symbols: optionValues(args, "--symbol"), components: optionValues(args, "--component"),
    includeInternal: args.includes("--include-internal"), ...(maxDepth ? { maxDepth: Number(maxDepth) } : {}),
    ...(limit ? { limit: Number(limit) } : {}), ...(retrievalId ? { retrievalId } : {}),
    dryRun: args.includes("--dry-run"), force: args.includes("--force"),
  });
  if (args.includes("--json")) console.log(JSON.stringify(result.result, null, 2));
  else console.log(`${result.result.retrievalId}: selected=${result.result.counts.selected}/${result.result.candidates.length}, ${result.result.businessHash}${result.outputDir === null ? "（dry-run）" : result.existed ? "（已存在且内容一致）" : ""}`);
  return true;
}

async function handleSymbols(labRoot: string, args: string[]): Promise<boolean> {
  if (args[0] !== "symbols") return false;
  const action = args[1], frameworkId = args[2];
  if (!action || !frameworkId) throw new Error("请使用 symbols extract|validate|list|query|diff <framework-id>。");
  const one = (name: string) => optionValues(args, name).at(-1);
  if (action === "extract") {
    const maxDiagnostics = one("--max-diagnostics");
    const catalogSnapshot = one("--catalog-snapshot"), sourceDir = one("--source-dir"), snapshotId = one("--snapshot-id");
    const result = await extractSymbols({
      labRoot, frameworkId, ...(catalogSnapshot ? { catalogSnapshot } : {}), ...(sourceDir ? { sourceDir } : {}),
      ...(snapshotId ? { snapshotId } : {}), syntaxOnly: args.includes("--syntax-only"),
      includeInternal: args.includes("--include-internal"), dryRun: args.includes("--dry-run"), force: args.includes("--force"),
      ...(maxDiagnostics ? { maxDiagnostics: Number(maxDiagnostics) } : {}),
    });
    const counts = result.data.analysis.counts as Record<string, number>;
    console.log(`${result.snapshotId}: modules=${counts.modules}, symbols=${counts.symbols}, components=${counts.components}, ${result.rootHash}${result.outputDir === null ? "（dry-run）" : result.existed ? "（已存在且内容一致）" : ""}`);
    return true;
  }
  if (action === "validate") {
    const result = await validateSymbols(labRoot, frameworkId); if (result.errors.length) throw new Error(result.errors.join("; "));
    console.log(`${frameworkId}: ${result.snapshots} 个 Symbol snapshot 验证通过。`); return true;
  }
  if (action === "list") {
    for (const row of await listSymbols(labRoot, frameworkId)) console.log(`${String(row.snapshotId)} commit=${String(row.commit)} modules=${String(row.modules)} symbols=${String(row.symbols)} public=${String(row.publicSymbols)} components=${String(row.components)} diagnostics=${String(row.diagnostics)} rootHash=${String(row.rootHash)} valid=${String(row.valid)}`);
    return true;
  }
  if (action === "query") {
    const limit = one("--limit");
    const name = one("--name"), kind = one("--kind"), packageName = one("--package"), moduleName = one("--module");
    const rows = await querySymbols(labRoot, frameworkId, {
      ...(name ? { name } : {}), ...(kind ? { kind } : {}),
      ...(packageName ? { package: packageName } : {}), ...(moduleName ? { module: moduleName } : {}),
      exportedOnly: args.includes("--exported-only"), publicOnly: args.includes("--public-only"),
      componentOnly: args.includes("--component-only"), ...(limit ? { limit: Number(limit) } : {}),
    });
    if (args.includes("--json")) console.log(JSON.stringify(rows, null, 2));
    else for (const row of rows) console.log(`${row.kind} ${row.qualifiedName} ${row.signature} ${row.filePath}:${row.lineStart} public=${row.publicReachable}`);
    return true;
  }
  if (action === "diff") {
    if (!args[3] || !args[4]) throw new Error("请使用 symbols diff <framework-id> <from-snapshot> <to-snapshot>。");
    const result = await diffSymbols(labRoot, frameworkId, args[3], args[4], args.includes("--force"));
    console.log(`${args[3]} → ${args[4]}: symbols +${(result.symbols as { added: unknown[] }).added.length}/-${(result.symbols as { removed: unknown[] }).removed.length}/~${(result.symbols as { modified: unknown[] }).modified.length}`);
    return true;
  }
  throw new Error(`未知 symbols 操作：${action}`);
}

async function handleCatalog(labRoot: string, args: string[]): Promise<boolean> {
  if (args[0] !== "catalog") return false;
  const action = args[1];
  const frameworkId = args[2];
  if (!action || !frameworkId) throw new Error("请使用 catalog scan|validate|list|diff <framework-id>。");
  if (action === "scan") {
    const one = (name: string) => optionValues(args, name).at(-1);
    const maxFileSize = one("--max-file-size");
    const sourceDir = one("--source-dir");
    const snapshotId = one("--snapshot-id");
    if (maxFileSize && (!Number.isSafeInteger(Number(maxFileSize)) || Number(maxFileSize) < 1)) {
      throw new Error("--max-file-size 必须是正整数。");
    }
    const result = await scanCatalog({
      labRoot,
      frameworkId,
      ...(sourceDir ? { sourceDir } : {}),
      ...(snapshotId ? { snapshotId } : {}),
      ...(maxFileSize ? { maxFileSize: Number(maxFileSize) } : {}),
      include: optionValues(args, "--include"),
      exclude: optionValues(args, "--exclude"),
      allowDirty: args.includes("--allow-dirty"),
      dryRun: args.includes("--dry-run"),
      force: args.includes("--force"),
    });
    const counts = result.data.snapshot.counts as Record<string, number>;
    console.log(`${result.snapshotId}: ${counts.files ?? 0} files, ${counts.packages ?? 0} packages, ${result.rootHash}${result.outputDir === null ? "（dry-run）" : result.existed ? "（已存在，内容一致）" : ""}`);
    return true;
  }
  if (action === "validate") {
    const result = await validateCatalog(labRoot, frameworkId);
    if (result.errors.length) throw new Error(result.errors.join("; "));
    console.log(`${frameworkId}: ${result.snapshots} 个 catalog snapshot 验证通过。`);
    return true;
  }
  if (action === "list") {
    const rows = await listCatalog(labRoot, frameworkId);
    for (const row of rows) {
      console.log(`${String(row.snapshotId)} commit=${String(row.commit)} dirty=${String(row.dirty)} files=${String(row.files)} packages=${String(row.packages)} documents=${String(row.documents)} examples=${String(row.examples)} rootHash=${String(row.rootHash)} valid=${String(row.valid)}`);
    }
    return true;
  }
  if (action === "diff") {
    if (!args[3] || !args[4]) throw new Error("请使用 catalog diff <framework-id> <from-snapshot> <to-snapshot>。");
    const result = await diffCatalog(labRoot, frameworkId, args[3], args[4], args.includes("--force"));
    console.log(`${args[3]} → ${args[4]}: added=${(result.added as unknown[]).length}, removed=${(result.removed as unknown[]).length}, modified=${(result.modified as unknown[]).length}, renamed=${(result.renamed as unknown[]).length}`);
    return true;
  }
  throw new Error(`未知 catalog 操作：${action}`);
}

function optionValues(args: string[], name: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < args.length; index += 1) if (args[index] === name) {
    const value = args[index + 1]; if (!value || value.startsWith("--")) throw new Error(`${name} 缺少参数。`);
    values.push(value);
  }
  return values;
}

async function handleKnowledge(labRoot: string, args: string[]): Promise<boolean> {
  if (args[0] !== "knowledge") return false;
  const action = args[1], frameworkId = args[2];
  if (!frameworkId || !["validate", "index", "impact", "freshness"].includes(action ?? "")) throw new Error("请使用 knowledge validate|index|impact|freshness <framework-id>。");
  if (action === "impact") { const diffId = args[3]; if (!diffId) throw new Error("knowledge impact 缺少 version-diff-id。"); const result = await knowledgeImpact(labRoot, frameworkId, diffId); console.log(`${result.impactId}: impacted=${result.summary.affected}`); return true; }
  if (action === "freshness") { const result = await freshness(labRoot, frameworkId, optionValues(args, "--target-version").at(-1)); console.log(JSON.stringify(result, null, 2)); return true; }
  if (action === "validate") {
    const result = await validateKnowledge(labRoot, frameworkId);
    for (const warning of result.warnings) console.warn(`Warning: ${warning}`);
    if (result.errors.length) throw new Error(result.errors.join("; "));
    console.log(`${frameworkId}: ${result.cards.length} 张知识卡验证通过，${result.warnings.length} 个警告。`);
  } else {
    const index = await generateKnowledgeIndex(labRoot, frameworkId);
    console.log(`${frameworkId}: index.json 已生成，${index.cardCount} 张卡片。`);
  }
  return true;
}

async function handleVersion(labRoot: string, args: string[]): Promise<boolean> {
  if (args[0] !== "version") return false;
  const action = args[1], frameworkId = args[2], one = (name: string) => optionValues(args, name).at(-1);
  if (!action || !frameworkId) throw new Error("请使用 version create|validate|list|diff <framework-id>。");
  if (action === "create") { const catalogSnapshotId = one("--catalog-snapshot"), symbolSnapshotId = one("--symbol-snapshot"), versionId = one("--version-id"); const result = await createVersion(labRoot, frameworkId, { ...(catalogSnapshotId ? { catalogSnapshotId } : {}), ...(symbolSnapshotId ? { symbolSnapshotId } : {}), ...(versionId ? { versionId } : {}), sourceTag: one("--tag") ?? null, branch: one("--branch") ?? null }); console.log(`${result.versionId}: ${result.sourceCommit}`); return true; }
  if (action === "validate") { const id = args[3]; if (!id) throw new Error("version validate 缺少 version-id。"); await validateVersion(labRoot, frameworkId, id); console.log(`${id}: validated`); return true; }
  if (action === "list") { for (const row of await listVersions(labRoot, frameworkId)) console.log(`${row.versionId} ${row.sourceCommit} catalog=${row.catalogSnapshotId} symbols=${row.symbolSnapshotId}`); return true; }
  if (action === "diff") { const from = args[3], to = args[4]; if (!from || !to) throw new Error("version diff 需要 from-version 和 to-version。"); const result = await createVersionDiff(labRoot, frameworkId, from, to); console.log(`${result.diffId}: ${result.rootHash}`); return true; }
  throw new Error(`未知 version 操作：${action}`);
}

async function handleContext(labRoot: string, args: string[]): Promise<boolean> {
  if (args[0] !== "context") return false;
  if (args[1] !== "create" || !args[2]) throw new Error("请使用 context create <framework-id> --task <text>。");
  const one = (name: string) => optionValues(args, name).at(-1);
  const sourceCommit = one("--source-commit"), runId = one("--run-id"), os = one("--os");
  const nodeVersion = one("--node-version"), packageManagerVersion = one("--package-manager-version");
  const budget = one("--budget"), contextId = one("--context-id");
  const retrievalId = one("--retrieval-id"), maxSnippetLines = one("--max-snippet-lines");
  const maxSymbols = one("--max-symbols"), maxDocSections = one("--max-doc-sections");
  const maxExamples = one("--max-examples"), maxSourceSnippets = one("--max-source-snippets");
  const result = await createAgentContext({
    labRoot, frameworkId: args[2], task: one("--task") ?? "",
    ...(sourceCommit ? { sourceCommit } : {}), ...(runId ? { runId } : {}),
    ...(os ? { os } : {}), ...(nodeVersion ? { nodeVersion } : {}),
    ...(packageManagerVersion ? { packageManagerVersion } : {}),
    ...(budget ? { budget: Number(budget) } : {}), ...(contextId ? { contextId } : {}),
    ...(retrievalId ? { retrievalId } : {}),
    withFrameworkKnowledge: !args.includes("--without-framework-knowledge"),
    knowledgeFirst: args.includes("--knowledge-first"),
    includeSourceSnippets: args.includes("--include-source-snippets") || Boolean(retrievalId),
    ...(maxSnippetLines ? { maxSnippetLines: Number(maxSnippetLines) } : {}),
    ...(maxSymbols ? { maxSymbols: Number(maxSymbols) } : {}),
    ...(maxDocSections ? { maxDocSections: Number(maxDocSections) } : {}),
    ...(maxExamples ? { maxExamples: Number(maxExamples) } : {}),
    ...(maxSourceSnippets ? { maxSourceSnippets: Number(maxSourceSnippets) } : {}),
    explainSelection: args.includes("--explain-selection"),
    includeCards: optionValues(args, "--include-card"),
    excludeCards: optionValues(args, "--exclude-card"),
    dryRun: args.includes("--dry-run"), force: args.includes("--force"),
  });
  console.log(`${result.context.contextId}: ${result.context.selectedCards.length} 张卡片，约 ${result.context.estimatedTokens} tokens${args.includes("--dry-run") ? "（dry-run）" : ""}。`);
  return true;
}

interface BaselineCliOptions {
  kind: "baseline";
  frameworkId: string;
  runId?: string;
  sourceDir?: string;
  dryRun: boolean;
}

interface ErrorsCliOptions {
  kind: "errors";
  frameworkId: string;
  runId: string;
  force: boolean;
}

type CliOptions = BaselineCliOptions | ErrorsCliOptions;

function valueAfter(args: string[], index: number, option: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${option} 缺少参数。`);
  return value;
}

function parseArguments(args: string[]): CliOptions | null {
  if (args.includes("--help") || args.length === 0) return null;
  if (args[0] === "errors" && args[1] === "parse") {
    if (!args[2] || !args[3]) {
      throw new Error("命令格式错误。请使用：pnpm framework-lab errors parse <framework-id> <run-id>");
    }
    const extras = args.slice(4);
    if (extras.some((argument) => argument !== "--force")) {
      throw new Error(`未知选项：${extras.find((argument) => argument !== "--force")}`);
    }
    return {
      kind: "errors",
      frameworkId: args[2],
      runId: args[3],
      force: extras.includes("--force"),
    };
  }
  if (args[0] !== "baseline" || args[1] !== "run" || !args[2]) {
    throw new Error("命令格式错误。请使用：pnpm framework-lab baseline run <framework-id>");
  }

  const result: BaselineCliOptions = {
    kind: "baseline",
    frameworkId: args[2],
    dryRun: false,
  };
  for (let index = 3; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--dry-run") {
      result.dryRun = true;
    } else if (argument === "--run-id") {
      result.runId = valueAfter(args, index, argument);
      index += 1;
    } else if (argument === "--source-dir") {
      result.sourceDir = valueAfter(args, index, argument);
      index += 1;
    } else {
      throw new Error(`未知选项：${argument}`);
    }
  }
  return result;
}

async function dryRun(labRoot: string, options: BaselineCliOptions): Promise<void> {
  const config = await loadFrameworkConfig(labRoot, options.frameworkId);
  const frameworkDir = path.resolve(labRoot, "frameworks", options.frameworkId);
  const runId = options.runId
    ? normalizeRunId(options.runId)
    : await previewNextRunId(frameworkDir);
  const sourceDir = resolveFromLab(labRoot, options.sourceDir ?? config.framework.source_dir);
  await access(sourceDir);

  console.log(`Dry run: ${config.framework.name} (${config.framework.id})`);
  console.log(`Run ID: ${runId}（不会创建）`);
  console.log(`Source: ${sourceDir}`);
  for (const step of config.baseline_steps) {
    console.log(
      `- ${step.id}: ${step.command} ${step.args.join(" ")} (timeout=${step.timeout_seconds}s, allowFailure=${step.allow_failure})`,
    );
  }
}

async function main(): Promise<void> {
  try {
    const args = process.argv.slice(2);
    const labRoot = findLabRoot();
    if (args.includes("--help") || args.length === 0) {
      console.log(HELP);
      return;
    }
    if (await handleTask(labRoot, args) || await handleLearn(labRoot, args) || await handleVersion(labRoot, args) || await handleSymbols(labRoot, args) || await handleCatalog(labRoot, args) || await handleKnowledge(labRoot, args) || await handleRetrieval(labRoot, args) || await handleContext(labRoot, args)) return;
    const options = parseArguments(args);
    if (!options) {
      console.log(HELP);
      return;
    }
    if (options.kind === "errors") {
      const result = await parseHistoricalRunErrors({ labRoot, ...options });
      console.log(
        `[${options.runId}] errors.json 已生成：${result.errors.summary.total} 个事件，首个阻塞错误 ${result.errors.firstBlockingErrorId ?? "无"}`,
      );
      return;
    }
    if (options.dryRun) {
      await dryRun(labRoot, options);
      return;
    }
    const result = await runBaseline({
      labRoot,
      frameworkId: options.frameworkId,
      ...(options.runId ? { runId: options.runId } : {}),
      ...(options.sourceDir ? { sourceDir: options.sourceDir } : {}),
    });
    console.log(`证据目录：${result.runDir}`);
    if (result.run.status === "failed") process.exitCode = 1;
  } catch (error) {
    console.error(`Framework Lab error: ${(error as Error).message}`);
    process.exitCode = 1;
  }
}

await main();
