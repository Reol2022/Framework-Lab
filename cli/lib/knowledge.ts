import { createHash } from "node:crypto";
import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { extractSourceSnippets, loadRetrieval, queryRetrieval, type RetrievalResult, type SourceSnippet } from "./retrieval.js";
import { validateWithSchema } from "./schema.js";

export interface EvidenceRef {
  id: string; type: string; path: string | null; jsonPointer: string | null;
  runId: string | null; stepId: string | null; eventId: string | null;
  commit: string | null; lineStart: number | null; lineEnd: number | null;
  sha256: string | null; note: string | null;
}
export interface KnowledgeCard {
  schemaVersion: "1.0.0"; id: string; frameworkId: string; type: string;
  title: string; summary: string; status: string; scope: {
    exactCommits: string[]; commitRange: string | null; branch: string | null;
    os: string[]; architecture: string[]; nodeVersion: string | null;
    packageManager: { name: string; version: string } | null;
    frameworkVersion: string | null; validFrom: string | null; validUntil: string | null;
    scopeUnknown: boolean;
  };
  claims: Array<{ id: string; text: string; status: string; evidence: EvidenceRef[] }>;
  limitations: string[]; tags: string[]; createdAt: string; updatedAt: string;
  supersedes: string[]; supersededBy: string[];
}
export interface ValidationResult { errors: string[]; warnings: string[]; cards: KnowledgeCard[] }

const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const isAbsolute = (value: string) => path.isAbsolute(value) || /^[A-Za-z]:[\\/]/u.test(value);

async function cardFiles(labRoot: string, frameworkId: string): Promise<string[]> {
  const dir = path.join(labRoot, "frameworks", frameworkId, "knowledge");
  const files = (await readdir(dir)).filter((file) => file.endsWith(".json") && file !== "index.json").sort();
  return files.map((file) => path.join(dir, file));
}

export async function loadKnowledgeCards(labRoot: string, frameworkId: string): Promise<KnowledgeCard[]> {
  const files = await cardFiles(labRoot, frameworkId);
  return await Promise.all(files.map(async (file) => {
    const card = JSON.parse(await readFile(file, "utf8")) as KnowledgeCard;
    await validateWithSchema(labRoot, "knowledge-card.schema.json", card);
    return card;
  }));
}

function pointer(value: unknown, valuePointer: string): unknown {
  if (valuePointer === "") return value;
  return valuePointer.split("/").slice(1).reduce<unknown>((current, part) => {
    const key = part.replaceAll("~1", "/").replaceAll("~0", "~");
    return current && typeof current === "object" ? (current as Record<string, unknown>)[key] : undefined;
  }, value);
}

async function validateEvidence(labRoot: string, evidence: EvidenceRef): Promise<string | null> {
  if (!evidence.path || isAbsolute(evidence.path)) return "证据必须包含仓库相对 path";
  const file = path.resolve(labRoot, evidence.path);
  if (!file.startsWith(path.resolve(labRoot))) return "证据 path 越出仓库";
  let content: Buffer;
  try { content = await readFile(file); } catch { return `证据文件不存在：${evidence.path}`; }
  if (!evidence.sha256 || sha(content) !== evidence.sha256) return `证据 SHA256 不匹配：${evidence.path}`;
  if (evidence.runId && !evidence.path.includes(`/runs/${evidence.runId}/`)) return `runId 无法定位：${evidence.runId}`;
  if (evidence.jsonPointer) {
    try {
      if (pointer(JSON.parse(content.toString("utf8")), evidence.jsonPointer) === undefined) return `JSON pointer 不存在：${evidence.jsonPointer}`;
    } catch { return `JSON pointer 目标不是合法 JSON：${evidence.path}`; }
  }
  if (evidence.eventId) {
    const json = JSON.parse(content.toString("utf8")) as { events?: Array<{ id?: string }> };
    if (!json.events?.some((event) => event.id === evidence.eventId)) return `eventId 不存在：${evidence.eventId}`;
  }
  if (evidence.type === "source_file" && !evidence.commit && !evidence.note?.includes("dirty")) return "source_file 必须记录 commit 或 dirty";
  return null;
}

export async function validateKnowledge(labRoot: string, frameworkId: string): Promise<ValidationResult> {
  const errors: string[] = [], warnings: string[] = [];
  let cards: KnowledgeCard[] = [];
  try { cards = await loadKnowledgeCards(labRoot, frameworkId); } catch (error) {
    return { errors: [(error as Error).message], warnings, cards };
  }
  if (cards.length === 0) errors.push("知识库为空。");
  const ids = new Set<string>();
  for (const card of cards) {
    if (ids.has(card.id)) errors.push(`重复 card id：${card.id}`); ids.add(card.id);
    if (card.frameworkId !== frameworkId) errors.push(`frameworkId 不匹配：${card.id}`);
    const claimIds = new Set<string>();
    for (const claim of card.claims) {
      if (claimIds.has(claim.id)) errors.push(`重复 claim id：${card.id}/${claim.id}`); claimIds.add(claim.id);
      if (claim.status === "inferred") warnings.push(`inferred claim：${card.id}/${claim.id}`);
      for (const evidence of claim.evidence) {
        const error = await validateEvidence(labRoot, evidence);
        if (error) errors.push(`${card.id}/${claim.id}/${evidence.id}: ${error}`);
      }
    }
    if (card.scope.scopeUnknown) warnings.push(`scopeUnknown：${card.id}`);
    for (const relation of [...card.supersedes, ...card.supersededBy]) if (!cards.some((item) => item.id === relation)) errors.push(`无效卡片引用：${card.id} -> ${relation}`);
  }
  return { errors, warnings, cards };
}

export async function generateKnowledgeIndex(labRoot: string, frameworkId: string) {
  const validation = await validateKnowledge(labRoot, frameworkId);
  if (validation.errors.length) throw new Error(validation.errors.join("; "));
  const dir = path.join(labRoot, "frameworks", frameworkId, "knowledge");
  const files = await cardFiles(labRoot, frameworkId);
  const cards = (await Promise.all(validation.cards.map(async (card, index) => ({
    id: card.id, title: card.title, type: card.type, status: card.status,
    tags: [...card.tags].sort(), scope: card.scope, claimCount: card.claims.length,
    evidenceCount: card.claims.reduce((count, claim) => count + claim.evidence.length, 0),
    sha256: sha(await readFile(files[index]!)),
  })))).sort((a, b) => a.id.localeCompare(b.id));
  const business = { frameworkId, cards, tags: [...new Set(cards.flatMap((card) => card.tags))].sort(), types: [...new Set(cards.map((card) => card.type))].sort() };
  const result = { schemaVersion: "1.0.0", generatedAt: new Date().toISOString(), frameworkId,
    cardCount: cards.length, activeCardCount: cards.filter((card) => card.status === "active").length,
    cards, tags: business.tags, types: business.types, indexSha256: sha(JSON.stringify(business)) };
  await validateWithSchema(labRoot, "knowledge-index.schema.json", result);
  await writeFile(path.join(dir, "index.json"), `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

const typeWeight: Record<string, number> = { workflow_constraint: 60, environment_requirement: 50, known_issue: 40, verified_patch: 35, validated_command: 30, framework_overview: 20 };
function scopeMatch(card: KnowledgeCard, query: { commit: string | null; os: string | null; node: string | null; pm: string | null }) {
  const reasons: string[] = [];
  if (query.commit && card.scope.exactCommits.length && !card.scope.exactCommits.includes(query.commit)) reasons.push("commit mismatch");
  if (query.os && card.scope.os.length && !card.scope.os.includes(query.os)) reasons.push("os mismatch");
  if (query.node && card.scope.nodeVersion && card.scope.nodeVersion !== query.node) reasons.push("node mismatch");
  if (query.pm && card.scope.packageManager && card.scope.packageManager.version !== query.pm) reasons.push("package manager mismatch");
  return { matches: reasons.length === 0, reasons };
}

export async function createAgentContext(options: {
  labRoot: string; frameworkId: string; task: string; sourceCommit?: string; runId?: string;
  os?: string; nodeVersion?: string; packageManagerVersion?: string; budget?: number;
  contextId?: string; includeCards?: string[]; excludeCards?: string[]; dryRun?: boolean; force?: boolean;
  retrievalId?: string; withFrameworkKnowledge?: boolean; includeSourceSnippets?: boolean;
  maxSnippetLines?: number; maxSymbols?: number; maxDocSections?: number; maxExamples?: number;
  maxSourceSnippets?: number; explainSelection?: boolean;
}) {
  if (!options.task.trim()) throw new Error("--task 必须提供非空文本。");
  const budget = options.budget ?? 4000;
  if (budget < 400) throw new Error("预算过小；最小安全预算为 400。");
  const validation = await validateKnowledge(options.labRoot, options.frameworkId);
  if (validation.errors.length) throw new Error(validation.errors.join("; "));
  let commit = options.sourceCommit ?? null, os = options.os ?? null, node = options.nodeVersion ?? null, pm = options.packageManagerVersion ?? null;
  if (commit && !/^[a-f0-9]{40}$/u.test(commit)) throw new Error("非法 source commit。");
  if (options.runId) {
    const base = path.join(options.labRoot, "frameworks", options.frameworkId, "runs", options.runId);
    const [source, environment] = await Promise.all([readFile(path.join(base, "source.json"), "utf8").then(JSON.parse), readFile(path.join(base, "environment.json"), "utf8").then(JSON.parse)]);
    commit ??= source.commit; os ??= environment.os.platform; node ??= environment.nodeVersion; pm ??= environment.packageManager.resolvedVersion;
  }
  const query = { commit, os, node, pm };
  const includes = new Set(options.includeCards ?? []), excludes = new Set(options.excludeCards ?? []);
  const excludedCards: Array<{ id: string; reason: string }> = [], scopeResults: Array<{ id: string; matches: boolean; reasons: string[] }> = [];
  const taskWords = options.task.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 1);
  const taskTerms = [...new Set(taskWords.flatMap((word) => {
    const chars = [...word];
    return [word, ...chars.slice(0, -1).map((char, index) => `${char}${chars[index + 1]}`)];
  }))];
  const ranked = validation.cards.map((card) => {
    const scope = scopeMatch(card, query); scopeResults.push({ id: card.id, ...scope });
    const haystack = [card.title, card.summary, ...card.tags, ...card.claims.map((claim) => claim.text)].join(" ").toLowerCase();
    const keywordHits = taskTerms.filter((word) => haystack.includes(word)).length;
    const score = (typeWeight[card.type] ?? 0) + keywordHits * 20;
    return { card, scope, score, keywordHits };
  }).filter(({ card, scope }) => {
    if (excludes.has(card.id)) { excludedCards.push({ id: card.id, reason: "explicit exclude" }); return false; }
    if (card.status !== "active") { excludedCards.push({ id: card.id, reason: `status ${card.status}` }); return false; }
    if (!scope.matches && !includes.has(card.id)) { excludedCards.push({ id: card.id, reason: scope.reasons.join(", ") }); return false; }
    return true;
  }).filter(({ card, keywordHits }) => {
    if (includes.has(card.id) || ["workflow_constraint", "environment_requirement"].includes(card.type) || keywordHits > 0) return true;
    excludedCards.push({ id: card.id, reason: "low task relevance" }); return false;
  }).sort((a, b) => b.score - a.score || a.card.id.localeCompare(b.card.id));
  for (const id of includes) if (!ranked.some(({ card }) => card.id === id)) {
    const card = validation.cards.find((item) => item.id === id);
    if (!card) throw new Error(`未知 include card：${id}`);
    ranked.unshift({ card, scope: scopeMatch(card, query), score: 10000, keywordHits: 100 });
  }
  const evidence = new Map<string, { id: string; ref: EvidenceRef }>(), claims: Array<{ cardId: string; claimId: string; text: string; status: string; evidenceIds: string[] }> = [];
  const filteredClaims: Array<{ cardId: string; claimId: string; reason: string }> = [];
  for (const { card } of ranked) for (const claim of card.claims) {
    if (claim.status === "inferred") { filteredClaims.push({ cardId: card.id, claimId: claim.id, reason: "inferred filtered" }); continue; }
    const evidenceIds = claim.evidence.map((ref) => {
      const key = JSON.stringify(ref); let item = evidence.get(key);
      if (!item) { item = { id: `E${evidence.size + 1}`, ref }; evidence.set(key, item); }
      return item.id;
    });
    claims.push({ cardId: card.id, claimId: claim.id, text: claim.text, status: claim.status, evidenceIds });
  }
  const constraints = ranked.filter(({ card }) => card.type === "workflow_constraint").flatMap(({ card }) => card.claims.filter((claim) => claim.status !== "inferred").map((claim) => claim.text));
  const warnings = ranked.filter(({ scope }) => !scope.matches).map(({ card }) => `显式包含 scope 不匹配卡片：${card.id}`);
  let retrieval: RetrievalResult | null = null;
  let snippets: SourceSnippet[] = [];
  const frameworkKnowledgeEnabled = options.withFrameworkKnowledge !== false;
  if (frameworkKnowledgeEnabled) {
    try {
      if (options.retrievalId) retrieval = await loadRetrieval(options.labRoot, options.frameworkId, options.retrievalId);
      else {
        await access(path.join(options.labRoot, "frameworks", options.frameworkId, "catalog", "current.json"));
        await access(path.join(options.labRoot, "frameworks", options.frameworkId, "symbols", "current.json"));
        retrieval = (await queryRetrieval({
          labRoot: options.labRoot, frameworkId: options.frameworkId, task: options.task,
          ...(commit ? { sourceCommit: commit } : {}), ...(options.runId ? { runId: options.runId } : {}),
          limit: Math.max(10, (options.maxSymbols ?? 8) + (options.maxDocSections ?? 4) + (options.maxExamples ?? 3) + 8),
          dryRun: true,
        })).result;
      }
      if (retrieval.sourceCommit !== commit && commit) throw new Error("retrieval 与 Context source commit 不一致。");
      const shouldReadSnippets = options.includeSourceSnippets ?? Boolean(options.retrievalId);
      if (shouldReadSnippets) snippets = await extractSourceSnippets({
        labRoot: options.labRoot, frameworkId: options.frameworkId, retrieval,
        maxSnippetLines: options.maxSnippetLines ?? 40, maxSnippets: options.maxSourceSnippets ?? 8,
        includeImplementation: retrieval.taskProfile.intents.some((intent) => ["modify", "fix", "debug"].includes(intent)),
      });
      constraints.push(...retrieval.taskProfile.negativeConstraints);
      warnings.push(...retrieval.warnings);
    } catch (error) {
      if (options.retrievalId) throw error;
      warnings.push(`Framework knowledge unavailable; v0.1.4 fallback used: ${(error as Error).message}`);
      retrieval = null; snippets = [];
    }
  }
  const retrievalCardIds = retrieval ? new Set(retrieval.candidates.filter((candidate) => candidate.selected && candidate.knowledgeCardId).map((candidate) => candidate.knowledgeCardId!)) : null;
  if (retrievalCardIds) for (const cardId of includes) retrievalCardIds.add(cardId);
  if (retrievalCardIds) {
    for (let index = claims.length - 1; index >= 0; index -= 1) {
      if (!retrievalCardIds.has(claims[index]!.cardId)) {
        const removed = claims.splice(index, 1)[0]!;
        filteredClaims.push({ cardId: removed.cardId, claimId: removed.claimId, reason: "not selected by task retrieval" });
      }
    }
  }
  const usedEvidenceIds = new Set(claims.flatMap((claim) => claim.evidenceIds));
  const contextEvidence = [...evidence.values()].filter((item) => usedEvidenceIds.has(item.id));
  const contextRanked = retrievalCardIds ? ranked.filter(({ card }) => retrievalCardIds.has(card.id)) : ranked;
  const contextId = options.contextId ?? `context-${sha(`${options.frameworkId}\0${options.task}\0${options.runId ?? ""}`).slice(0, 12)}`;
  const sourceScope = { commit, os, nodeVersion: node, packageManagerVersion: pm, runId: options.runId ?? null };
  const selectedCards = [...new Set(claims.map((claim) => claim.cardId))];
  const candidatePriority = (candidate: RetrievalResult["candidates"][number]) => candidate.type === "component" ? 100 : candidate.type === "symbol" ? 90 : candidate.type === "public_export" ? 85 : candidate.type === "example" ? 75 : candidate.type === "document_section" ? 65 : 40;
  const frameworkCandidates = retrieval ? retrieval.candidates.filter((candidate) => candidate.selected).sort((a, b) => candidatePriority(b) - candidatePriority(a) || b.score - a.score || a.id.localeCompare(b.id)) : [];
  const candidateLimits = { symbol: options.maxSymbols ?? 7, document_section: options.maxDocSections ?? 4, example: options.maxExamples ?? 3 };
  const usedByType = new Map<string, number>();
  const selectedFrameworkCandidates = frameworkCandidates.filter((candidate) => {
    const limit = candidateLimits[candidate.type as keyof typeof candidateLimits];
    if (limit === undefined) return true;
    const count = usedByType.get(candidate.type) ?? 0;
    if (count >= limit) return false;
    usedByType.set(candidate.type, count + 1); return true;
  });
  const candidateBlock = (candidate: RetrievalResult["candidates"][number]) => `- **${candidate.type}: ${candidate.title}** — ${candidate.summary} (score=${candidate.score}, confidence=${candidate.confidence}, evidence=${candidate.evidence.map((item) => `${item.path}:${item.lineStart ?? "?"}`).join(", ") || "snapshot"})`;
  const snippetBlock = (snippet: SourceSnippet) => `### ${snippet.type}: ${snippet.path}:${snippet.lineStart}-${snippet.lineEnd}\n\n\`\`\`ts\n${snippet.content}\n\`\`\`\n\nEvidence: commit=${snippet.commit}; sha256=${snippet.fileSha256}`;
  const render = (items: typeof claims, candidates = selectedFrameworkCandidates, sourceSnippets = snippets) => `# Agent Context: ${contextId}\n\n## Task\n\n${options.task}\n\n## Framework and Version Scope\n\n- Commit: ${commit ?? "unknown"}\n- OS: ${os ?? "unknown"}\n- Node: ${node ?? "unknown"}\n- Package manager: ${pm ?? "unknown"}\n${retrieval ? `- Catalog: ${retrieval.catalogSnapshotId} / ${retrieval.catalogRootHash}\n- Symbols: ${retrieval.symbolSnapshotId} / ${retrieval.symbolRootHash}\n` : ""}\n## Development Constraints\n\n${constraints.map((item) => `- ${item}`).join("\n") || "- None recorded."}\n\n${candidates.length ? `## Public API and Components\n\n${candidates.map(candidateBlock).join("\n")}\n\n` : ""}${sourceSnippets.length ? `## Relevant Evidence Excerpts\n\n${sourceSnippets.map(snippetBlock).join("\n\n")}\n\n` : ""}## Validated Knowledge Claims\n\n${items.map((claim) => `- ${claim.text} ${claim.evidenceIds.map((id) => `[${id}]`).join(" ")}`).join("\n")}\n\n## Limitations and Confidence\n\n${[...contextRanked.flatMap(({ card }) => card.limitations), ...warnings].map((item) => `- ${item}`).join("\n") || "- None recorded."}\n\n## Evidence Index\n\n${contextEvidence.map(({ id, ref }) => `- [${id}] ${ref.type}: ${ref.path ?? "no-path"}${ref.runId ? `; run=${ref.runId}` : ""}${ref.stepId ? `; step=${ref.stepId}` : ""}${ref.eventId ? `; event=${ref.eventId}` : ""}${ref.commit ? `; commit=${ref.commit}` : ""}; sha256=${ref.sha256 ?? "none"}`).join("\n")}\n${retrieval ? selectedFrameworkCandidates.flatMap((candidate) => candidate.evidence).map((ref, index) => `- [R${index + 1}] retrieval: ${ref.path}:${ref.lineStart ?? "?"}-${ref.lineEnd ?? "?"}; sha256=${ref.sha256 ?? "none"}`).join("\n") : ""}\n`;
  const selectedClaims = [...claims];
  const budgetCandidates = [...selectedFrameworkCandidates], budgetSnippets = [...snippets];
  let markdown = render(selectedClaims, budgetCandidates, budgetSnippets), estimatedTokens = Math.ceil(markdown.length / 4);
  const budgetDecisions: string[] = ["estimatedTokens = ceil(characterCount / 4)"];
  while (estimatedTokens > budget && (budgetCandidates.length > 1 || budgetSnippets.length > 1 || selectedClaims.length > 1)) {
    if (budgetCandidates.length > 1) {
      const removed = budgetCandidates.pop()!; budgetDecisions.push(`removed candidate ${removed.id}`);
    } else if (budgetSnippets.length > 1) {
      const removed = budgetSnippets.pop()!; budgetDecisions.push(`removed snippet ${removed.id}`);
    } else {
      const removed = selectedClaims.pop()!; filteredClaims.push({ cardId: removed.cardId, claimId: removed.claimId, reason: "budget trimming" });
      budgetDecisions.push(`removed ${removed.cardId}/${removed.claimId}`);
    }
    markdown = render(selectedClaims, budgetCandidates, budgetSnippets); estimatedTokens = Math.ceil(markdown.length / 4);
  }
  if (estimatedTokens > budget) throw new Error(`预算不足；最小安全上下文需要 ${estimatedTokens} tokens。`);
  const frameworkKnowledge = retrieval ? {
    retrievalId: retrieval.retrievalId, businessHash: retrieval.businessHash,
    selectedCandidates: budgetCandidates.map((candidate) => candidate.id), snippets: budgetSnippets,
    semanticAvailable: retrieval.semanticAvailable, catalogRootHash: retrieval.catalogRootHash, symbolRootHash: retrieval.symbolRootHash,
  } : null;
  const context = { schemaVersion: "1.0.0", contextId, frameworkId: options.frameworkId, task: options.task, generatedAt: new Date().toISOString(), sourceScope, budget, estimatedTokens, selectedCards, claims: selectedClaims, constraints: [...new Set(constraints)], evidenceIndex: contextEvidence, warnings, frameworkKnowledge };
  const index = options.dryRun
    ? await readFile(path.join(options.labRoot, "frameworks", options.frameworkId, "knowledge", "index.json"), "utf8")
      .then((value) => JSON.parse(value))
      .catch(() => generateKnowledgeIndex(options.labRoot, options.frameworkId))
    : await generateKnowledgeIndex(options.labRoot, options.frameworkId);
  const cardHashes = new Map(index.cards.map((card: { id: string; sha256: string }) => [card.id, card.sha256]));
  const manifestBase = { schemaVersion: "1.0.0", contextId, knowledgeIndexSha256: index.indexSha256,
    selectedCards: selectedCards.map((id) => ({ id, sha256: cardHashes.get(id), reason: includes.has(id) ? "explicit include" : "scope and relevance" })),
    excludedCards, filteredClaims, scopeResults, budgetDecisions, generatorVersion: retrieval ? "0.1.7" : "0.1.4", sourceRun: options.runId ?? null, sourceCommit: commit,
    retrievalId: retrieval?.retrievalId ?? null, retrievalBusinessHash: retrieval?.businessHash ?? null,
    selectedFrameworkCandidates: budgetCandidates.map((candidate) => candidate.id), snippetSelections: budgetSnippets.map((snippet) => snippet.id),
    frameworkKnowledgeEnabled, explainSelection: options.explainSelection ?? false,
    outputSha256: { "context.json": sha(`${JSON.stringify(context, null, 2)}\n`), "context.md": sha(markdown) } };
  await validateWithSchema(options.labRoot, "agent-context.schema.json", context);
  await validateWithSchema(options.labRoot, "context-manifest.schema.json", manifestBase);
  if (!options.dryRun) {
    const dir = path.join(options.labRoot, "frameworks", options.frameworkId, "contexts", contextId);
    try { await access(dir); if (!options.force) throw new Error(`${contextId} 已存在；使用 --force 覆盖。`); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    await mkdir(dir, { recursive: true });
    await Promise.all([writeFile(path.join(dir, "context.json"), `${JSON.stringify(context, null, 2)}\n`), writeFile(path.join(dir, "context.md"), markdown), writeFile(path.join(dir, "manifest.json"), `${JSON.stringify(manifestBase, null, 2)}\n`)]);
  }
  return { context, markdown, manifest: manifestBase };
}
