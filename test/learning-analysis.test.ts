import assert from "node:assert/strict";
import test from "node:test";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { runKnowledgeEvaluation, validateEvaluationSet } from "../cli/lib/evaluation.js";
import {
  analyzeGaps,
  analyzeKnowledgeEconomics,
  deriveFamilies,
  detectKnowledgeConflicts,
  evaluateKnowledgeQuality,
  prioritizeLearning,
} from "../cli/lib/learning-analysis.js";
import { listPublished, queryPublishedKnowledge, validateDraft } from "../cli/lib/learn.js";
import { validateWithSchema } from "../cli/lib/schema.js";

const lab = path.resolve(".");
const frameworkId = "ncom";
const commit = "a350b576bbeae6c6254273037a17d2a8730fb80f";
const evaluationDir = path.join(lab, "frameworks", frameworkId, "evaluations", "v0.2.3");

let families: Awaited<ReturnType<typeof deriveFamilies>>;
let gaps: Awaited<ReturnType<typeof analyzeGaps>>;
let priorities: Awaited<ReturnType<typeof prioritizeLearning>>;
let quality: Awaited<ReturnType<typeof evaluateKnowledgeQuality>>;
let conflicts: Awaited<ReturnType<typeof detectKnowledgeConflicts>>;
let evaluation: Awaited<ReturnType<typeof runKnowledgeEvaluation>>;

test("v0.2.3 family candidates validate", async () => { families = await deriveFamilies(lab, frameworkId); assert.ok(families.candidates.length >= 3); });
test("family scope is locked", () => assert.equal(families.sourceCommit, commit));
test("family candidates use structural signals", () => assert.ok(families.candidates.every((item) => /^(base|event|slot):/u.test(item.structuralSignal))));
test("component names are not a family detection signal", () => assert.ok(families.candidates.every((item) => !item.detectionReasons.some((reason) => /名称相似/u.test(reason)))));
test("family records expose shared structure and review status", () => assert.ok(families.candidates.every((item) => Array.isArray(item.sharedBaseTypes) && Array.isArray(item.sharedEvents) && ["pending", "approved", "rejected"].includes(item.reviewStatus))));
test("family candidates have at least two members", () => assert.ok(families.candidates.every((item) => item.componentIds.length >= 2)));
test("family evidence is portable", () => assert.ok(!JSON.stringify(families).match(/[A-Za-z]:[\\/]/u)));
test("family business hash is deterministic", async () => assert.equal((await deriveFamilies(lab, frameworkId)).businessHash, families.businessHash));
test("three family reviews exist", async () => assert.equal((await readdir(path.join(lab, "frameworks", frameworkId, "learning", "families", "reviews"))).filter((item) => item.endsWith(".json")).length, 3));
test("input family reviewed", async () => assert.match(await readFile(path.join(lab, "frameworks", frameworkId, "learning", "families", "reviews", "family-base-ncbaseinput-992f1bdb.json"), "utf8"), /Input controls/u));
test("closable family reviewed", async () => assert.match(await readFile(path.join(lab, "frameworks", frameworkId, "learning", "families", "reviews", "family-event-close-f995da3e.json"), "utf8"), /close/u));
test("popup family reviewed", async () => assert.match(await readFile(path.join(lab, "frameworks", frameworkId, "learning", "families", "reviews", "family-slot-reference-b8102051.json"), "utf8"), /reference/u));

test("gap analysis validates", async () => { gaps = await analyzeGaps(lab, frameworkId); assert.ok(gaps.gaps.length > 0); });
test("component API gap is detected", () => assert.ok(gaps.gaps.some((item) => item.type === "uncovered_component_api")));
test("public Symbol gap is detected", () => assert.ok(gaps.gaps.some((item) => item.type === "uncovered_public_symbol")));
test("gap rows expose transparent demand and priority fields", () => assert.ok(gaps.gaps.every((item) => typeof item.priorityScore === "number" && typeof item.rawFallbackCount === "number" && Array.isArray(item.currentKnowledgeIds))));
test("gap business hash is deterministic", async () => assert.equal((await analyzeGaps(lab, frameworkId)).businessHash, gaps.businessHash));
test("priority analysis validates", async () => { priorities = await prioritizeLearning(lab, frameworkId); assert.equal(priorities.priorities.length, gaps.gaps.length); });
test("priority formula is transparent", () => assert.match(priorities.formula, /riskPenalty/u));
test("priority rows expose factors", () => assert.ok(priorities.priorities.every((item) => Object.keys(item.factors).length === 8)));
test("priority sorting deterministic", () => assert.ok(priorities.priorities.every((item, index, rows) => index === 0 || rows[index - 1]!.score >= item.score)));
test("priority score applies risk penalty", () => assert.ok(priorities.priorities.every((item) => item.factors.riskPenalty >= 0)));

test("published knowledge reaches 22", async () => assert.ok((await listPublished(lab, frameworkId)).filter((item) => item.publicationStatus === "published").length >= 22));
test("six new component units published", async () => assert.equal((await listPublished(lab, frameworkId)).filter((item) => ["ncom-ncselect-structure", "ncom-nccheckbox-structure", "ncom-ncalert-structure", "ncom-ncdrawer-structure", "ncom-nccard-structure", "ncom-nctable-structure"].includes(item.id)).length, 6));
test("three family units published", async () => assert.equal((await listPublished(lab, frameworkId)).filter((item) => item.claims.some((claim) => claim.tags.includes("family"))).length, 3));
test("four mechanism units published", async () => assert.ok((await listPublished(lab, frameworkId)).filter((item) => item.claims.some((claim) => claim.tags.includes("mechanism"))).length >= 4));
test("three workflow units published", async () => assert.ok((await listPublished(lab, frameworkId)).filter((item) => item.claims.some((claim) => claim.tags.includes("workflow"))).length >= 3));
test("all published units are current commit", async () => assert.ok((await listPublished(lab, frameworkId)).every((item) => item.scope.sourceCommit === commit)));
test("external Codex draft imported and validates", async () => assert.equal((await validateDraft(lab, frameworkId, "ncom-component-styles-themes-organization")).generator, "external-learning-agent"));

test("quality analysis validates", async () => { quality = await evaluateKnowledgeQuality(lab, frameworkId); assert.ok(quality.records.length >= 22); });
test("quality does not emit aggregate score", () => assert.equal("score" in quality.summary, false));
test("quality reports independent dimensions", () => assert.ok(quality.dimensions.length >= 8));
test("quality exposes required evidence dimensions", () => assert.ok(quality.records.every((item) => "evidenceCompleteness" in item && "runtimeValidation" in item && "overallQuality" in item)));
test("runtime-unverified recipes cannot be high", () => assert.ok(quality.records.filter((item) => item.recipeValidation === "low").every((item) => item.overallQuality !== "high")));
test("conflict analysis validates", async () => { conflicts = await detectKnowledgeConflicts(lab, frameworkId); assert.equal(conflicts.summary.autoResolved, 0); });
test("conflict detector does not infer text conflicts", () => assert.ok(conflicts.limitations.some((item) => item.includes("文本相似度"))));
test("conflict records require review and never auto-resolve", () => assert.ok(conflicts.conflicts.every((item) => item.reviewStatus === "requires_review")));

test("evaluation set validates", async () => assert.ok((await validateEvaluationSet(lab, frameworkId)).tasks.length >= 10));
test("evaluation task ids unique", async () => { const set = await validateEvaluationSet(lab, frameworkId); assert.equal(new Set(set.tasks.map((item) => item.id)).size, set.tasks.length); });
test("evaluation has input task", async () => assert.ok((await validateEvaluationSet(lab, frameworkId)).tasks.some((item) => item.category === "component-input")));
test("evaluation has feedback task", async () => assert.ok((await validateEvaluationSet(lab, frameworkId)).tasks.some((item) => item.category === "component-feedback")));
test("evaluation has container task", async () => assert.ok((await validateEvaluationSet(lab, frameworkId)).tasks.some((item) => item.category === "component-container")));
test("evaluation has complex task", async () => assert.ok((await validateEvaluationSet(lab, frameworkId)).tasks.some((item) => item.category === "component-complex")));
test("evaluation has family task", async () => assert.ok((await validateEvaluationSet(lab, frameworkId)).tasks.some((item) => item.category === "component-family")));
test("evaluation results validate", async () => { evaluation = await runKnowledgeEvaluation(lab, frameworkId); assert.equal(evaluation.results.length, 12); });
test("evaluation keeps manual review pending", () => assert.equal(evaluation.aggregate.pendingManualReviews, evaluation.results.length));
test("evaluation labels estimated tokens", () => assert.equal(evaluation.estimator, "ceil(characterCount / 4)"));
test("evaluation records knowledge reuse", () => assert.ok(evaluation.aggregate.totalReusedKnowledgeUnits > 0));
test("evaluation records raw fallback", () => assert.ok(evaluation.aggregate.totalRawFallbacks > 0));
test("evaluation has no execution failures", () => assert.equal(evaluation.aggregate.failures, 0));
test("required-item recall is aggregated", () => assert.equal(evaluation.aggregate.meanKnowledgeFirstRecall, 1));
test("unsupported statements remain manual instead of fabricated", () => assert.ok(evaluation.results.every((item) => item.knowledgeFirst.unsupportedClaims === null)));
test("median calculation is deterministic", () => assert.equal(evaluation.aggregate.knowledgeFirstEstimatedTokens.median, 1384));
test("shorter and longer counts cover the full set", () => assert.equal(evaluation.aggregate.shorter + evaluation.aggregate.longer + evaluation.aggregate.ties, evaluation.aggregate.taskCount));
test("evaluation contexts exist", async () => await access(path.join(evaluationDir, "contexts", "ncselect-change.knowledge-first.md")));
test("evaluation raw context exists", async () => await access(path.join(evaluationDir, "contexts", "ncselect-change.raw.md")));
test("exact NCSelect knowledge ranks first", async () => assert.equal((await queryPublishedKnowledge(lab, frameworkId, "NCSelect change", commit))[0]!.unit.id, "ncom-ncselect-structure"));
test("stale scope excluded", async () => assert.equal((await queryPublishedKnowledge(lab, frameworkId, "NCSelect", "0000000000000000000000000000000000000000")).length, 0));
test("economics validates", async () => assert.equal((await analyzeKnowledgeEconomics(lab, frameworkId)).knownFacts.evaluatedTasks, 12));
test("economics has one auditable row per published unit", async () => {
  const economics = await analyzeKnowledgeEconomics(lab, frameworkId);
  assert.equal(economics.records.length, economics.knownFacts.publishedKnowledgeUnits);
  assert.ok(economics.records.every((item) => typeof item.reviewCount === "number" && "breakEvenEstimate" in item));
});
test("economics states estimate limitation", async () => assert.ok((await analyzeKnowledgeEconomics(lab, frameworkId)).limitations.some((item) => item.includes("不是模型 API"))));
test("agent demo comparison validates", async () => validateWithSchema(lab, "agent-demo-comparison.schema.json", JSON.parse(await readFile(path.join(evaluationDir, "agent-demos", "comparison.json"), "utf8"))));
test("agent demo A metrics validate", async () => validateWithSchema(lab, "agent-demo-metrics.schema.json", JSON.parse(await readFile(path.join(evaluationDir, "agent-demos", "demo-a", "metrics.json"), "utf8"))));
test("agent demo raw metrics validate", async () => validateWithSchema(lab, "agent-demo-metrics.schema.json", JSON.parse(await readFile(path.join(evaluationDir, "agent-demos", "demo-b-raw", "metrics.json"), "utf8"))));
test("agent demo knowledge-first metrics validate", async () => validateWithSchema(lab, "agent-demo-metrics.schema.json", JSON.parse(await readFile(path.join(evaluationDir, "agent-demos", "demo-b-knowledge-first", "metrics.json"), "utf8"))));
