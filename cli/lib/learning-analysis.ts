import { createHash } from "node:crypto";
import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { listPublished, type KnowledgeUnit } from "./learn.js";
import { validateWithSchema } from "./schema.js";

const VERSION = "1.0.0";
const sha = (value: string) => `sha256:${createHash("sha256").update(value).digest("hex")}`;
const now = () => new Date().toISOString();
const learningDir = (lab: string, frameworkId: string, ...parts: string[]) =>
  path.join(lab, "frameworks", frameworkId, "learning", ...parts);

async function json<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function exists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

interface CurrentSnapshot {
  snapshotId: string;
  commit: string;
  rootHash: string;
}

interface Component {
  id: string;
  name: string;
  symbolId: string;
  packageId: string;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  baseTypes: string[];
  props: string[];
  events: string[];
  slots: string[];
  lifecycleMethods: string[];
  examples: string[];
  documents: string[];
  publicPackages: string[];
  status: string;
  evidence: Array<{ path: string; line: number; fileSha256: string }>;
}

interface TopicSeed {
  id: string;
  type: string;
  title: string;
  description: string;
  query: string;
  coverageTargets?: string[];
}

interface PublicSymbol {
  id: string;
  name: string;
  packageId: string;
  publicReachable: boolean;
  publicPackages: string[];
  jsDoc?: { summary?: string | null };
  evidence: Array<{ path: string; line: number; fileSha256: string }>;
}

export interface FamilyCandidate {
  id: string;
  structuralSignal: string;
  proposedName: string;
  componentIds: string[];
  componentNames: string[];
  representativeComponents: string[];
  sharedBaseTypes: string[];
  sharedInterfaces: string[];
  sharedEvents: string[];
  sharedMethods: string[];
  sharedProperties: string[];
  sharedStylePatterns: string[];
  publicPackages: string[];
  evidence: Array<{ componentId: string; path: string; line: number; sha256: string }>;
  confidence: "structural-candidate";
  detectionReasons: string[];
  reviewStatus: "pending" | "approved" | "rejected";
  limitations: string[];
}

async function scope(lab: string, frameworkId: string) {
  const [catalog, symbols] = await Promise.all([
    json<CurrentSnapshot>(path.join(lab, "frameworks", frameworkId, "catalog", "current.json")),
    json<CurrentSnapshot>(path.join(lab, "frameworks", frameworkId, "symbols", "current.json")),
  ]);
  return { catalog, symbols };
}

async function components(lab: string, frameworkId: string): Promise<Component[]> {
  const current = await scope(lab, frameworkId);
  const value = await json<{ components: Component[] }>(
    path.join(
      lab,
      "frameworks",
      frameworkId,
      "symbols",
      "snapshots",
      current.symbols.snapshotId,
      "components.json",
    ),
  );
  return value.components
    .filter((item) => item.status === "public")
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function publicSymbols(lab: string, frameworkId: string): Promise<PublicSymbol[]> {
  const current = await scope(lab, frameworkId);
  const value = await json<{ symbols: PublicSymbol[] }>(
    path.join(
      lab,
      "frameworks",
      frameworkId,
      "symbols",
      "snapshots",
      current.symbols.snapshotId,
      "symbols.json",
    ),
  );
  return value.symbols
    .filter((item) => item.publicReachable)
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

async function topics(lab: string, frameworkId: string): Promise<TopicSeed[]> {
  const value = await json<{ topics: TopicSeed[] }>(
    path.join(lab, "frameworks", frameworkId, "learning-topics.json"),
  );
  return value.topics;
}

function familySignals(component: Component): string[] {
  return [
    ...component.baseTypes.map((item) => `base:${item}`),
    ...component.events.map((item) => `event:${item}`),
    ...component.slots.map((item) => `slot:${item}`),
  ];
}

export async function deriveFamilies(lab: string, frameworkId: string) {
  const current = await scope(lab, frameworkId);
  const rows = await components(lab, frameworkId);
  const reviews = await reviewedFamilies(lab, frameworkId);
  const reviewByFamily = new Map(
    reviews.map((item) => [String(item.familyId), String(item.decision)]),
  );
  const groups = new Map<string, Component[]>();
  for (const component of rows) {
    for (const signal of familySignals(component)) {
      const group = groups.get(signal) ?? [];
      group.push(component);
      groups.set(signal, group);
    }
  }
  const candidates: FamilyCandidate[] = [...groups]
    .filter(([, members]) => members.length >= 2)
    .map(([signal, members]) => {
      const id = `family-${signal.replace(/[^a-z0-9]+/giu, "-").toLowerCase()}-${createHash("sha256").update(members.map((item) => item.id).sort().join("\0")).digest("hex").slice(0, 8)}`;
      const [kind, value] = signal.split(":", 2) as [string, string];
      const decision = reviewByFamily.get(id);
      return {
        id,
        structuralSignal: signal,
        proposedName: `${value} structural family`,
        componentIds: members.map((item) => item.id).sort(),
        componentNames: members.map((item) => item.name).sort(),
        representativeComponents: members.map((item) => item.name).sort().slice(0, 3),
        sharedBaseTypes: kind === "base" ? [value] : [],
        sharedInterfaces: [],
        sharedEvents: kind === "event" ? [value] : [],
        sharedMethods: [],
        sharedProperties: [],
        sharedStylePatterns: [],
        publicPackages: [...new Set(members.flatMap((item) => item.publicPackages))].sort(),
        evidence: members.map((item) => ({
          componentId: item.id,
          path: item.evidence[0]?.path ?? item.filePath,
          line: item.evidence[0]?.line ?? item.lineStart,
          sha256: item.evidence[0]?.fileSha256 ?? "unknown",
        })),
        confidence: "structural-candidate" as const,
        detectionReasons: [`${members.length} 个 public component 共享结构化信号 ${signal}`],
        reviewStatus: decision === "approved" ? "approved" as const : decision === "rejected" ? "rejected" as const : "pending" as const,
        limitations: [
          "候选只表示共享结构信号，不自动证明组件具有相同语义或行为。",
          "未登记的共享 API 或样式字段保持为空，不从名称推断。",
          "发布家族知识前必须显式复核成员范围。",
        ],
      };
    })
    .sort((a, b) => b.componentIds.length - a.componentIds.length || a.id.localeCompare(b.id));
  const result = {
    schemaVersion: VERSION,
    frameworkId,
    sourceCommit: current.catalog.commit,
    catalogRootHash: current.catalog.rootHash,
    symbolRootHash: current.symbols.rootHash,
    generatedAt: now(),
    candidates,
    businessHash: sha(JSON.stringify(candidates)),
  };
  await validateWithSchema(lab, "component-families.schema.json", result);
  await writeJson(learningDir(lab, frameworkId, "families.json"), result);
  return result;
}

export async function reviewFamily(
  lab: string,
  frameworkId: string,
  familyId: string,
  options: {
    decision: "approved" | "rejected";
    name: string;
    reviewer: string;
    includeComponents?: string[];
    limitations?: string[];
  },
) {
  const families = await deriveFamilies(lab, frameworkId);
  const family = families.candidates.find((item) => item.id === familyId);
  if (!family) throw new Error(`未知 family candidate：${familyId}`);
  const include = options.includeComponents?.length
    ? [...new Set(options.includeComponents)].sort()
    : family.componentIds;
  const unknown = include.filter((id) => !family.componentIds.includes(id));
  if (unknown.length) throw new Error(`复核成员不属于候选：${unknown.join(", ")}`);
  if (!options.name.trim() || !options.reviewer.trim()) {
    throw new Error("review-family 需要非空 --name 和 --reviewer。");
  }
  const record = {
    schemaVersion: VERSION,
    frameworkId,
    familyId,
    familyName: options.name,
    decision: options.decision,
    reviewer: options.reviewer,
    reviewMethod: "explicit-cli-review",
    sourceCommit: families.sourceCommit,
    structuralSignal: family.structuralSignal,
    candidateComponentIds: family.componentIds,
    approvedComponentIds: options.decision === "approved" ? include : [],
    excludedComponentIds: family.componentIds.filter((id) => !include.includes(id)),
    evidence: family.evidence.filter((item) => include.includes(item.componentId)),
    limitations: [
      ...family.limitations,
      ...(options.limitations ?? []),
    ],
    reviewedAt: now(),
  };
  await validateWithSchema(lab, "component-family-review.schema.json", record);
  await writeJson(learningDir(lab, frameworkId, "families", "reviews", `${familyId}.json`), record);
  return record;
}

async function reviewedFamilies(lab: string, frameworkId: string) {
  const folder = learningDir(lab, frameworkId, "families", "reviews");
  if (!(await exists(folder))) return [];
  const files = (await readdir(folder)).filter((item) => item.endsWith(".json")).sort();
  return Promise.all(files.map((file) => json<Record<string, unknown>>(path.join(folder, file))));
}

export async function analyzeGaps(lab: string, frameworkId: string) {
  const [current, allComponents, allPublicSymbols, units, seeds, families, reviews] = await Promise.all([
    scope(lab, frameworkId),
    components(lab, frameworkId),
    publicSymbols(lab, frameworkId),
    listPublished(lab, frameworkId),
    topics(lab, frameworkId),
    deriveFamilies(lab, frameworkId),
    reviewedFamilies(lab, frameworkId),
  ]);
  const active = units.filter(
    (unit) =>
      unit.publicationStatus === "published" &&
      unit.scope.sourceCommit === current.catalog.commit &&
      !["stale", "invalid", "superseded", "retired"].includes(unit.freshnessStatus ?? "current"),
  );
  const coveredComponents = new Set(active.flatMap((item) => item.relatedComponents));
  const coveredSymbols = new Set(active.flatMap((item) => item.relatedSymbols));
  const knowledgeByComponent = new Map<string, string[]>();
  const knowledgeBySymbol = new Map<string, string[]>();
  for (const unit of active) {
    for (const id of unit.relatedComponents) knowledgeByComponent.set(id, [...(knowledgeByComponent.get(id) ?? []), unit.id]);
    for (const id of unit.relatedSymbols) knowledgeBySymbol.set(id, [...(knowledgeBySymbol.get(id) ?? []), unit.id]);
  }
  const coveredTitles = new Set(active.map((item) => item.title));
  const reviewedIds = new Set(
    reviews
      .filter((item) => item.decision === "approved")
      .map((item) => String(item.familyId)),
  );
  const buildGap = (input: {
    id: string;
    type: string;
    targetId: string;
    targetName: string;
    packageId: string | null;
    currentKnowledgeIds?: string[];
    reason: string;
    publicReachable: boolean;
    documentationAvailable: boolean;
    exampleAvailable: boolean;
    structuralImportance: number;
    evidenceAvailability: number;
    estimatedLearningCost: number;
    reusePotential: number;
    recommendedTopicType: string;
    warnings?: string[];
  }) => {
    const scoreBreakdown = {
      taskHitFrequency: 0,
      rawFallbackCount: 0,
      publicApiImportance: input.publicReachable ? 5 : 0,
      reusableComponentCount: input.reusePotential,
      evidenceCompleteness: input.evidenceAvailability,
      learningCostPenalty: input.estimatedLearningCost,
      unresolvedPenalty: 0,
      lowConfidencePenalty: 0,
    };
    const priorityScore =
      scoreBreakdown.taskHitFrequency * 3 +
      scoreBreakdown.rawFallbackCount * 2 +
      scoreBreakdown.publicApiImportance * 4 +
      scoreBreakdown.reusableComponentCount * 2 +
      scoreBreakdown.evidenceCompleteness * 2 -
      scoreBreakdown.learningCostPenalty * 2;
    return {
      ...input,
      title: input.targetName,
      currentKnowledgeIds: [...new Set(input.currentKnowledgeIds ?? [])].sort(),
      reasons: [input.reason],
      retrievalCount: 0,
      rawFallbackCount: 0,
      snippetCount: 0,
      taskCount: 0,
      priorityScore,
      scoreBreakdown,
      warnings: input.warnings ?? ["尚无任务级 demand 证据时，频率字段保持 0。"],
      dependencyCount: input.structuralImportance,
      risk: 1,
    };
  };
  const componentGaps = allComponents
    .filter((item) => !coveredComponents.has(item.id))
    .map((item) => buildGap({
      id: `gap-component-${item.id}`,
      type: "uncovered_component_api",
      targetId: item.id,
      targetName: `${item.name} component API`,
      packageId: item.packageId,
      currentKnowledgeIds: knowledgeByComponent.get(item.id) ?? [],
      reason: "public component has no current published component knowledge unit",
      publicReachable: true,
      documentationAvailable: item.documents.length > 0,
      exampleAvailable: item.examples.length > 0,
      structuralImportance: Math.min(5, 1 + item.baseTypes.length + item.events.length),
      evidenceAvailability: Math.min(5, 1 + Number(item.documents.length > 0) + Number(item.examples.length > 0) + Number(item.evidence.length > 0) + Number(item.publicPackages.length > 0)),
      estimatedLearningCost: item.documents.length + item.examples.length > 0 ? 2 : 4,
      reusePotential: Math.min(5, item.events.length + item.slots.length + item.baseTypes.length),
      recommendedTopicType: "component_api",
    }));
  const componentSymbolIds = new Set(allComponents.map((item) => item.symbolId));
  const symbolGaps = allPublicSymbols
    .filter((item) => !coveredSymbols.has(item.id) && !componentSymbolIds.has(item.id))
    .map((item) => buildGap({
      id: `gap-symbol-${item.id}`,
      type: "uncovered_public_symbol",
      targetId: item.id,
      targetName: `${item.name} public symbol`,
      packageId: item.packageId,
      currentKnowledgeIds: knowledgeBySymbol.get(item.id) ?? [],
      reason: "public reachable symbol has no current published knowledge unit",
      publicReachable: true,
      documentationAvailable: Boolean(item.jsDoc?.summary),
      exampleAvailable: false,
      structuralImportance: Math.min(5, item.publicPackages.length + 1),
      evidenceAvailability: Math.min(5, item.evidence.length + Number(Boolean(item.jsDoc?.summary))),
      estimatedLearningCost: item.jsDoc?.summary ? 2 : 3,
      reusePotential: Math.min(5, item.publicPackages.length),
      recommendedTopicType: "public_symbol",
    }));
  const gaps = [
    ...componentGaps,
    ...symbolGaps,
    ...seeds
      .filter((item) => !coveredTitles.has(item.title))
      .map((item) => buildGap({
        id: `gap-topic-${item.id}`,
        type: item.coverageTargets?.includes("workflow")
          ? "missing_workflow"
          : /lifecycle/iu.test(`${item.id} ${item.title}`)
            ? "missing_lifecycle"
            : /style|theme/iu.test(`${item.id} ${item.title}`)
              ? "missing_style_knowledge"
              : "uncovered_framework_concept",
        targetId: item.id,
        targetName: item.title,
        packageId: null,
        reason: "configured learning topic has no current published unit with the same title",
        publicReachable: false,
        documentationAvailable: false,
        exampleAvailable: false,
        structuralImportance: Math.min(5, item.coverageTargets?.length ?? 1),
        evidenceAvailability: 3,
        reusePotential: item.coverageTargets?.length ?? 1,
        estimatedLearningCost: 3,
        recommendedTopicType: item.type,
      })),
    ...families.candidates
      .filter((item) => !reviewedIds.has(item.id))
      .map((item) => buildGap({
        id: `gap-family-${item.id}`,
        type: "uncovered_component_family",
        targetId: item.id,
        targetName: `Review ${item.structuralSignal} family candidate`,
        packageId: item.publicPackages[0] ?? null,
        reason: "structural family candidate has not been explicitly approved",
        publicReachable: true,
        documentationAvailable: false,
        exampleAvailable: false,
        structuralImportance: Math.min(5, item.componentIds.length),
        evidenceAvailability: Math.min(5, item.evidence.length),
        reusePotential: Math.min(5, item.componentIds.length),
        estimatedLearningCost: 3,
        recommendedTopicType: "component_family",
        warnings: ["组件族必须显式 review；结构相同不等同于语义相同。"],
      })),
  ].sort((a, b) => a.id.localeCompare(b.id));
  const result = {
    schemaVersion: VERSION,
    frameworkId,
    sourceCommit: current.catalog.commit,
    generatedAt: now(),
    coverage: {
      publicComponents: allComponents.length,
      coveredPublicComponents: coveredComponents.size,
      publicSymbols: allPublicSymbols.length,
      coveredPublicSymbols: coveredSymbols.size,
      currentPublishedUnits: active.length,
      reviewedFamilies: reviewedIds.size,
    },
    gaps,
    businessHash: sha(JSON.stringify(gaps)),
  };
  await validateWithSchema(lab, "learning-gaps.schema.json", result);
  await writeJson(learningDir(lab, frameworkId, "gaps.json"), result);
  return result;
}

function words(value: string): string[] {
  return value.toLowerCase().match(/[\p{L}\p{N}_-]+/gu) ?? [];
}

export async function prioritizeLearning(lab: string, frameworkId: string) {
  const gaps = await analyzeGaps(lab, frameworkId);
  const taskFile = path.join(lab, "frameworks", frameworkId, "evaluations", "v0.2.3", "tasks.json");
  const taskText = (await exists(taskFile)) ? await readFile(taskFile, "utf8") : "";
  const rows = gaps.gaps.map((gap) => {
    const demand = Math.min(5, words(gap.title).filter((word) => taskText.toLowerCase().includes(word)).length);
    const factors = {
      businessValue: gap.type === "uncovered_component_api" || gap.type === "uncovered_public_symbol"
        ? 4
        : gap.type === "missing_workflow"
          ? 5
          : 3,
      frameworkCentrality: Math.min(5, 2 + gap.dependencyCount),
      dependencyWeight: Math.min(5, gap.dependencyCount),
      evidenceAvailability: gap.evidenceAvailability,
      evaluationDemand: demand,
      familyReuse: Math.min(5, gap.reusePotential),
      validationFeasibility: gap.evidenceAvailability >= 3 ? 4 : 2,
      riskPenalty: gap.risk,
    };
    const score =
      factors.businessValue * 4 +
      factors.frameworkCentrality * 3 +
      factors.dependencyWeight * 2 +
      factors.evidenceAvailability * 2 +
      factors.evaluationDemand * 3 +
      factors.familyReuse * 2 +
      factors.validationFeasibility -
      factors.riskPenalty * 2;
    return { ...gap, factors, score };
  }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const result = {
    schemaVersion: VERSION,
    frameworkId,
    sourceCommit: gaps.sourceCommit,
    generatedAt: now(),
    formula: "4*businessValue + 3*frameworkCentrality + 2*dependencyWeight + 2*evidenceAvailability + 3*evaluationDemand + 2*familyReuse + validationFeasibility - 2*riskPenalty",
    priorities: rows,
    businessHash: sha(JSON.stringify(rows)),
  };
  await validateWithSchema(lab, "learning-priorities.schema.json", result);
  await writeJson(learningDir(lab, frameworkId, "priorities.json"), result);
  return result;
}

function completeness(unit: KnowledgeUnit): "high" | "medium" | "low" {
  const claimsValid = unit.claims.length > 0 && unit.claims.every((claim) => claim.evidenceIds.length > 0);
  const relations = unit.relatedComponents.length + unit.relatedSymbols.length + unit.relatedPackages.length;
  if (claimsValid && relations > 0 && unit.limitations.length > 0) return "high";
  if (claimsValid) return "medium";
  return "low";
}

export async function evaluateKnowledgeQuality(lab: string, frameworkId: string) {
  const current = await scope(lab, frameworkId);
  const units = (await listPublished(lab, frameworkId)).sort((a, b) => a.id.localeCompare(b.id));
  const records = units.map((unit) => {
    const evidenceComplete = unit.claims.length > 0 && unit.claims.every((claim) => claim.evidenceIds.length > 0);
    const inferred = unit.claims.some((claim) => claim.status === "inferred");
    const hasScope = Boolean(unit.scope.sourceCommit && unit.scope.catalogRootHash && unit.scope.symbolRootHash);
    const hasPublicLinks = unit.relatedComponents.length + unit.relatedSymbols.length + unit.relatedPackages.length > 0;
    const hasRecipes = unit.recipes.length > 0;
    const recipeVerified = hasRecipes && unit.claims.some((claim) => claim.status === "verified");
    const qualityWarnings = [
      ...(!evidenceComplete ? ["存在无 Evidence 的 Claim。"] : []),
      ...(inferred ? ["包含 inferred Claim，不能评为 high。"] : []),
      ...(!hasScope ? ["Scope 不完整。"] : []),
      ...(hasRecipes && !recipeVerified ? ["Recipe 未绑定运行验证，不能评为 high。"] : []),
      ...(!unit.limitations.length ? ["未记录限制。"] : []),
    ];
    const overallQuality = !evidenceComplete || !hasScope
      ? "blocked"
      : inferred || (hasRecipes && !recipeVerified) || !unit.limitations.length
        ? "medium"
        : "high";
    return {
      knowledgeId: unit.id,
      evidenceCompleteness: evidenceComplete ? "high" : "blocked",
      scopeSpecificity: hasScope ? "high" : "low",
      publicInternalSeparation: hasPublicLinks ? "high" : "not_applicable",
      claimAtomicity: unit.claims.every((claim) => claim.text.split(/[。.!?]/u).filter(Boolean).length <= 2) ? "high" : "medium",
      documentationSupport: "not_evidenced",
      exampleSupport: "not_evidenced",
      recipeValidation: hasRecipes ? recipeVerified ? "high" : "low" : "not_applicable",
      runtimeValidation: unit.claims.some((claim) => claim.status === "verified") ? "high" : "not_evidenced",
      limitationCompleteness: unit.limitations.length > 0 ? "high" : "low",
      freshness: unit.scope.sourceCommit === current.catalog.commit ? "high" : "low",
      duplication: "not_detected",
      overallQuality,
      qualityWarnings,
      publicationStatus: unit.publicationStatus,
      evidenceValidity: evidenceComplete ? "high" : "low",
      typeCompleteness: completeness(unit),
      symbolReachability: unit.relatedSymbols.length > 0 ? "high" : "not_applicable",
      publicApiSupport: hasPublicLinks ? "high" : "not_applicable",
      workflowVerification: ["build_workflow", "development_convention"].includes(unit.type)
        ? unit.claims.some((claim) => claim.status === "verified") ? "high" : "medium"
        : "not_applicable",
      ambiguity: unit.claims.some((claim) => claim.confidence === "low") ? "low" : "high",
      conflictStatus: "not_detected",
      limitationsRecorded: unit.limitations.length > 0,
    };
  });
  const result = {
    schemaVersion: VERSION,
    frameworkId,
    sourceCommit: current.catalog.commit,
    generatedAt: now(),
    dimensions: [
      "evidenceValidity",
      "freshness",
      "typeCompleteness",
      "symbolReachability",
      "publicApiSupport",
      "workflowVerification",
      "ambiguity",
      "conflictStatus",
      "overallQuality",
    ],
    records,
    summary: {
      total: records.length,
      highEvidence: records.filter((item) => item.evidenceValidity === "high").length,
      current: records.filter((item) => item.freshness === "high").length,
      lowCompleteness: records.filter((item) => item.typeCompleteness === "low").length,
      overallQuality: {
        high: records.filter((item) => item.overallQuality === "high").length,
        medium: records.filter((item) => item.overallQuality === "medium").length,
        low: records.filter((item) => item.overallQuality === "low").length,
        blocked: records.filter((item) => item.overallQuality === "blocked").length,
      },
    },
    warning: "各维度独立呈现；本报告不把启发式维度合成为伪精确总分。",
  };
  await validateWithSchema(lab, "knowledge-quality.schema.json", result);
  await writeJson(learningDir(lab, frameworkId, "quality.json"), result);
  return result;
}

export async function detectKnowledgeConflicts(lab: string, frameworkId: string) {
  const units = (await listPublished(lab, frameworkId)).sort((a, b) => a.id.localeCompare(b.id));
  const normalizedClaims = new Map<string, Array<{ knowledgeId: string; claimId: string; text: string; scope: string }>>();
  const structured = new Map<string, Array<{ knowledgeId: string; claimId: string; text: string }>>();
  for (const unit of units) {
    for (const claim of unit.claims) {
      const normalized = claim.text.normalize("NFKC").trim().replace(/\s+/gu, " ").toLowerCase();
      const exact = normalizedClaims.get(normalized) ?? [];
      exact.push({ knowledgeId: unit.id, claimId: claim.id, text: claim.text, scope: unit.scope.sourceCommit });
      normalizedClaims.set(normalized, exact);
      for (const tag of claim.tags.filter((item) => item.startsWith("value:"))) {
        const targets = [...unit.relatedComponents, ...unit.relatedSymbols, ...unit.relatedPackages];
        for (const target of targets) {
          const key = `${target}\0${claim.id.replace(/-v\d+$/u, "")}`;
          const rows = structured.get(key) ?? [];
          rows.push({ knowledgeId: unit.id, claimId: claim.id, text: tag });
          structured.set(key, rows);
        }
      }
    }
  }
  const duplicateRecords = [...normalizedClaims]
    .filter(([, rows]) => new Set(rows.map((item) => item.knowledgeId)).size > 1)
    .map(([, rows], index) => ({
      id: `duplicate-claim-${index + 1}`,
      type: "exact_duplicate_claim",
      involvedKnowledge: [...new Set(rows.map((item) => item.knowledgeId))].sort(),
      involvedClaims: rows.map((item) => ({ knowledgeId: item.knowledgeId, claimId: item.claimId, text: item.text })),
      scopes: [...new Set(rows.map((item) => item.scope))].sort(),
      evidence: [],
      severity: "info",
      recommendedAction: "manual-review-for-deduplication",
      reviewStatus: "requires_review",
    }));
  const structuredRecords = [...structured]
    .filter(([, rows]) => new Set(rows.map((item) => item.text)).size > 1)
    .map(([key, rows], index) => ({
      id: `conflict-${index + 1}`,
      type: "structured_value_conflict",
      involvedKnowledge: [...new Set(rows.map((item) => item.knowledgeId))].sort(),
      involvedClaims: rows,
      scopes: [],
      evidence: [],
      severity: "warning",
      recommendedAction: "manual-review",
      reviewStatus: "requires_review",
      structuredTarget: key.split("\0")[0],
      classification: "exact_structured_value_conflict",
      claims: rows,
    }));
  const conflicts = [...duplicateRecords, ...structuredRecords];
  const result = {
    schemaVersion: VERSION,
    frameworkId,
    generatedAt: now(),
    scannedKnowledgeUnits: units.length,
    conflicts,
    summary: {
      total: conflicts.length,
      exactDuplicates: duplicateRecords.length,
      structuredValueConflicts: structuredRecords.length,
      autoResolved: 0,
    },
    limitations: [
      "只报告相同结构化 target/claim key 的不同 value 标签。",
      "不使用文本相似度推断语义冲突，不自动删除或覆盖知识。",
    ],
  };
  await validateWithSchema(lab, "knowledge-conflicts.schema.json", result);
  await writeJson(learningDir(lab, frameworkId, "conflicts.json"), result);
  return result;
}

function stats(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return { mean: null, median: null, min: null, max: null };
  const middle = Math.floor(sorted.length / 2);
  return {
    mean: sorted.reduce((sum, item) => sum + item, 0) / sorted.length,
    median: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1]! + sorted[middle]!) / 2,
    min: sorted[0],
    max: sorted.at(-1),
  };
}

export async function analyzeKnowledgeEconomics(lab: string, frameworkId: string) {
  const units = await listPublished(lab, frameworkId);
  const evalFile = path.join(lab, "frameworks", frameworkId, "evaluations", "v0.2.3", "results.json");
  const evaluation = (await exists(evalFile))
    ? await json<{ results: Array<{ rawEstimatedTokens: number; knowledgeFirstEstimatedTokens: number; reusedKnowledgeUnitCount: number; rawFallbackCount: number; rawCharacterCount: number; knowledgeFirstCharacterCount: number; knowledgeFirst: { selectedKnowledgeUnitIds: string[] } }> }>(evalFile)
    : { results: [] };
  const historyFile = learningDir(lab, frameworkId, "history.jsonl");
  const history = (await exists(historyFile))
    ? (await readFile(historyFile, "utf8")).split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line) as { knowledgeId?: string; action?: string })
    : [];
  const estimatedTokensForFile = async (file: string) =>
    await exists(file) ? Math.ceil((await readFile(file, "utf8")).length / 4) : null;
  const records = await Promise.all(units.sort((a, b) => a.id.localeCompare(b.id)).map(async (unit) => {
    const hits = evaluation.results.filter((item) => item.knowledgeFirst.selectedKnowledgeUnitIds.includes(unit.id));
    const replacedRawSnippetCharacters = Math.max(0, Math.round(hits.reduce(
      (sum, item) => sum + (item.rawCharacterCount - item.knowledgeFirstCharacterCount) / Math.max(1, item.knowledgeFirst.selectedKnowledgeUnitIds.length),
      0,
    )));
    const bundleDir = learningDir(lab, frameworkId, "bundles", unit.sourceBundleId);
    const learningBundleEstimatedTokens = await estimatedTokensForFile(path.join(bundleDir, "evidence.json"));
    const draftEstimatedTokens = await estimatedTokensForFile(learningDir(lab, frameworkId, "drafts", unit.id, "knowledge.json"));
    const publishedKnowledgeEstimatedTokens = await estimatedTokensForFile(learningDir(lab, frameworkId, "published", unit.id, "knowledge.json"));
    const reviewCount = history.filter((item) => item.knowledgeId === unit.id && item.action === "review").length;
    const estimatedContextDifference = hits.reduce(
      (sum, item) => sum + item.knowledgeFirstEstimatedTokens - item.rawEstimatedTokens,
      0,
    );
    const averageSaved = hits.length ? Math.max(0, -estimatedContextDifference / hits.length) : 0;
    const investment = (learningBundleEstimatedTokens ?? 0) + (draftEstimatedTokens ?? 0);
    return {
      knowledgeId: unit.id,
      learningBundleEstimatedTokens,
      draftEstimatedTokens,
      publishedKnowledgeEstimatedTokens,
      reviewCount,
      reuseCount: hits.length,
      taskHitCount: hits.length,
      replacedRawSnippetCharacters,
      estimatedContextDifference,
      breakEvenEstimate: averageSaved > 0 ? Math.ceil(investment / averageSaved) : null,
      confidence: hits.length >= 3 ? "medium" : "low",
      limitations: [
        "字符数按 ceil(characters / 4) 估算，不是账单 Token。",
        "不包含模型内部推理、缓存和人工时间。",
      ],
    };
  }));
  const raw = evaluation.results.map((item) => item.rawEstimatedTokens);
  const knowledgeFirst = evaluation.results.map((item) => item.knowledgeFirstEstimatedTokens);
  const result = {
    schemaVersion: VERSION,
    frameworkId,
    generatedAt: now(),
    records,
    knownFacts: {
      publishedKnowledgeUnits: units.length,
      evaluatedTasks: evaluation.results.length,
      reusedKnowledgeSelections: evaluation.results.reduce((sum, item) => sum + item.reusedKnowledgeUnitCount, 0),
      rawFallbackSelections: evaluation.results.reduce((sum, item) => sum + item.rawFallbackCount, 0),
    },
    estimates: {
      rawEstimatedTokens: stats(raw),
      knowledgeFirstEstimatedTokens: stats(knowledgeFirst),
      shorterTasks: evaluation.results.filter((item) => item.knowledgeFirstEstimatedTokens < item.rawEstimatedTokens).length,
      longerTasks: evaluation.results.filter((item) => item.knowledgeFirstEstimatedTokens > item.rawEstimatedTokens).length,
      ties: evaluation.results.filter((item) => item.knowledgeFirstEstimatedTokens === item.rawEstimatedTokens).length,
    },
    formulas: {
      estimatedTokens: "ceil(characterCount / 4)",
      reuseCount: "sum(reusedKnowledgeUnitCount)",
      fallbackCount: "sum(rawFallbackCount)",
    },
    limitations: [
      "estimatedTokens 是字符启发式估计，不是模型 API 的真实 token usage。",
      "未记录人工分钟数时，不估算学习、复核或维护成本。",
      "不根据单次实验推断生产 ROI。",
    ],
  };
  await validateWithSchema(lab, "knowledge-economics.schema.json", result);
  await writeJson(learningDir(lab, frameworkId, "economics.json"), result);
  return result;
}
