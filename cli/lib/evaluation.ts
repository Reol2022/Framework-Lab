import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createAgentContext } from "./knowledge.js";
import { validateWithSchema } from "./schema.js";

const VERSION = "1.0.0";
const sha = (value: string) => `sha256:${createHash("sha256").update(value).digest("hex")}`;

export interface EvaluationTask {
  id: string;
  task: string;
  category: string;
  targetComponents: string[];
  targetFamilies: string[];
  expectedKnowledgeTypes: string[];
  expectedSymbols: string[];
  expectedDocs: string[];
  expectedExamples: string[];
  expectedValidationKnowledge: string[];
  mustRecall: string[];
  mustNotInclude: string[];
  manualReviewItems: string[];
  allowedRawFallback: number;
}

interface EvaluationSet {
  schemaVersion: string;
  frameworkId: string;
  sourceCommit: string;
  generatedAt: string;
  tasks: EvaluationTask[];
}

function countTerms(markdown: string, terms: string[]): number {
  const lower = markdown.toLowerCase();
  return terms.filter((term) => lower.includes(term.toLowerCase())).length;
}

function contextMetrics(
  task: EvaluationTask,
  output: Awaited<ReturnType<typeof createAgentContext>>,
) {
  const source = output.context.knowledgeFirst?.source ?? [];
  const rawFallbackCount = output.context.knowledgeFirst?.rawFallbackCount
    ?? output.context.frameworkKnowledge?.selectedCandidates.length
    ?? 0;
  const recalled = countTerms(output.markdown, task.mustRecall);
  const prohibited = countTerms(output.markdown, task.mustNotInclude);
  return {
    estimatedTokens: output.context.estimatedTokens,
    characterCount: output.markdown.length,
    selectedKnowledgeUnitIds: source.map((item) => item.id),
    selectedKnowledgeCategories: source.map((item) => item.category),
    selectedRawCandidateIds: output.context.frameworkKnowledge?.selectedCandidates ?? [],
    reusedKnowledgeUnitCount: output.context.knowledgeFirst?.reusedKnowledgeUnitCount ?? 0,
    rawFallbackCount,
    recall: {
      recalled,
      expected: task.mustRecall.length,
      ratio: task.mustRecall.length ? recalled / task.mustRecall.length : 1,
      missing: task.mustRecall.filter((term) => !output.markdown.toLowerCase().includes(term.toLowerCase())),
    },
    irrelevant: {
      prohibitedMatches: prohibited,
      checkedTerms: task.mustNotInclude,
    },
    unsupportedClaims: null,
    manualReviewItems: task.manualReviewItems,
  };
}

type ContextMetrics = ReturnType<typeof contextMetrics>;

interface EvaluationResult {
  taskId: string;
  category: string;
  rawEstimatedTokens: number;
  knowledgeFirstEstimatedTokens: number;
  rawCharacterCount: number;
  knowledgeFirstCharacterCount: number;
  deltaEstimatedTokens: number;
  lengthComparison: "shorter" | "longer" | "tie";
  raw: ContextMetrics;
  knowledgeFirst: ContextMetrics;
  reusedKnowledgeUnitCount: number;
  rawFallbackCount: number;
  fallbackWithinAllowance: boolean;
  manualReviewStatus: "pending";
  failure: null;
}

export async function validateEvaluationSet(lab: string, frameworkId: string) {
  const file = path.join(lab, "frameworks", frameworkId, "evaluations", "v0.2.3", "tasks.json");
  const value = JSON.parse(await readFile(file, "utf8")) as EvaluationSet;
  await validateWithSchema(lab, "knowledge-evaluation-set.schema.json", value);
  if (value.frameworkId !== frameworkId) throw new Error("Evaluation Set frameworkId 不匹配。");
  if (new Set(value.tasks.map((item) => item.id)).size !== value.tasks.length) {
    throw new Error("Evaluation task id 必须唯一。");
  }
  return value;
}

export async function runKnowledgeEvaluation(lab: string, frameworkId: string) {
  const set = await validateEvaluationSet(lab, frameworkId);
  const outputDir = path.join(lab, "frameworks", frameworkId, "evaluations", "v0.2.3");
  const contextDir = path.join(outputDir, "contexts");
  await mkdir(contextDir, { recursive: true });
  const results: EvaluationResult[] = [];
  for (const task of set.tasks) {
    const base = {
      labRoot: lab,
      frameworkId,
      task: task.task,
      sourceCommit: set.sourceCommit,
      budget: 6000,
      includeSourceSnippets: false,
      dryRun: true,
      explainSelection: true,
    };
    const [raw, knowledgeFirst] = await Promise.all([
      createAgentContext({ ...base, contextId: `eval-v023-${task.id}-raw`, knowledgeFirst: false }),
      createAgentContext({ ...base, contextId: `eval-v023-${task.id}-knowledge-first`, knowledgeFirst: true }),
    ]);
    await Promise.all([
      writeFile(path.join(contextDir, `${task.id}.raw.md`), raw.markdown, "utf8"),
      writeFile(path.join(contextDir, `${task.id}.knowledge-first.md`), knowledgeFirst.markdown, "utf8"),
    ]);
    const rawMetrics = contextMetrics(task, raw);
    const knowledgeMetrics = contextMetrics(task, knowledgeFirst);
    results.push({
      taskId: task.id,
      category: task.category,
      rawEstimatedTokens: rawMetrics.estimatedTokens,
      knowledgeFirstEstimatedTokens: knowledgeMetrics.estimatedTokens,
      rawCharacterCount: rawMetrics.characterCount,
      knowledgeFirstCharacterCount: knowledgeMetrics.characterCount,
      deltaEstimatedTokens: knowledgeMetrics.estimatedTokens - rawMetrics.estimatedTokens,
      lengthComparison:
        knowledgeMetrics.estimatedTokens < rawMetrics.estimatedTokens ? "shorter"
          : knowledgeMetrics.estimatedTokens > rawMetrics.estimatedTokens ? "longer"
            : "tie",
      raw: rawMetrics,
      knowledgeFirst: knowledgeMetrics,
      reusedKnowledgeUnitCount: knowledgeMetrics.reusedKnowledgeUnitCount,
      rawFallbackCount: knowledgeMetrics.rawFallbackCount,
      fallbackWithinAllowance: knowledgeMetrics.rawFallbackCount <= task.allowedRawFallback,
      manualReviewStatus: "pending",
      failure: null,
    });
  }
  const values = (key: "rawEstimatedTokens" | "knowledgeFirstEstimatedTokens") =>
    results.map((item) => item[key]).sort((a, b) => a - b);
  const stats = (items: number[]) => ({
    mean: items.reduce((sum, item) => sum + item, 0) / items.length,
    median: items.length % 2 ? items[Math.floor(items.length / 2)] : (items[items.length / 2 - 1]! + items[items.length / 2]!) / 2,
    min: items[0],
    max: items.at(-1),
  });
  const business = {
    sourceCommit: set.sourceCommit,
    taskIds: results.map((item) => item.taskId),
    results: results.map((item) => ({
      taskId: item.taskId,
      rawEstimatedTokens: item.rawEstimatedTokens,
      knowledgeFirstEstimatedTokens: item.knowledgeFirstEstimatedTokens,
      selectedKnowledgeUnitIds: item.knowledgeFirst.selectedKnowledgeUnitIds,
      recall: item.knowledgeFirst.recall,
      rawFallbackCount: item.rawFallbackCount,
    })),
  };
  const evaluation = {
    schemaVersion: VERSION,
    frameworkId,
    sourceCommit: set.sourceCommit,
    generatedAt: new Date().toISOString(),
    estimator: "ceil(characterCount / 4)",
    results,
    aggregate: {
      taskCount: results.length,
      rawEstimatedTokens: stats(values("rawEstimatedTokens")),
      knowledgeFirstEstimatedTokens: stats(values("knowledgeFirstEstimatedTokens")),
      shorter: results.filter((item) => item.lengthComparison === "shorter").length,
      longer: results.filter((item) => item.lengthComparison === "longer").length,
      ties: results.filter((item) => item.lengthComparison === "tie").length,
      meanKnowledgeFirstRecall: results.reduce((sum, item) => sum + item.knowledgeFirst.recall.ratio, 0) / results.length,
      totalReusedKnowledgeUnits: results.reduce((sum, item) => sum + item.reusedKnowledgeUnitCount, 0),
      totalRawFallbacks: results.reduce((sum, item) => sum + item.rawFallbackCount, 0),
      failures: results.filter((item) => item.failure !== null).length,
      pendingManualReviews: results.filter((item) => item.manualReviewStatus === "pending").length,
    },
    businessHash: sha(JSON.stringify(business)),
    limitations: [
      "estimatedTokens 是字符启发式，不是模型 API 的真实 token usage。",
      "unsupportedClaims 与任务质量仍需人工复核；pending 不计为通过。",
      "Context 长短不单独代表开发质量。",
    ],
  };
  await validateWithSchema(lab, "knowledge-evaluation-result.schema.json", evaluation);
  await writeFile(path.join(outputDir, "results.json"), `${JSON.stringify(evaluation, null, 2)}\n`, "utf8");
  return evaluation;
}
