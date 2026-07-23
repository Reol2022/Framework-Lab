import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadFrameworkConfig } from "./config.js";
import { portablePath, resolveFromLab } from "./paths.js";
import { spawnCollect } from "./process.js";
import { validateWithSchema } from "./schema.js";
import { validateCatalog } from "./catalog.js";
import { validateSymbols } from "./symbols.js";

const VERSION = "0.1.7";
const SCHEMA_VERSION = "1.0.0";
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const stable = (value: unknown): string => JSON.stringify(value, (_key, item) => {
  if (item && typeof item === "object" && !Array.isArray(item)) {
    return Object.fromEntries(Object.entries(item as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)));
  }
  return item;
});
const cid = (type: string, value: string) => `${type}-${sha(value).slice(0, 16)}`;
const clean = (value: string, limit = 500) => value.replace(/\s+/gu, " ").trim().slice(0, limit);
const words = (value: string) => value.match(/[A-Za-z_$][\w$-]*|[\p{Script=Han}]{2,}/gu) ?? [];
const splitIdentifier = (value: string) => value.replace(/([A-Z]+)([A-Z][a-z])/gu, "$1 $2").replace(/([a-z0-9])([A-Z])/gu, "$1 $2").replace(/[_-]+/gu, " ").toLowerCase().split(/\s+/u).filter(Boolean);

export interface TaskProfile {
  schemaVersion: "1.0.0"; originalText: string; normalizedText: string; tokens: string[];
  identifiers: string[]; cjkSegments: string[]; paths: string[]; quoted: string[];
  packages: string[]; explicitSymbols: string[]; explicitComponents: string[];
  technicalKeywords: string[]; intents: string[]; constraints: string[]; negativeConstraints: string[];
}
export interface CandidateEvidence { path: string; lineStart: number | null; lineEnd: number | null; sha256: string | null; source: string }
export interface RetrievalCandidate {
  id: string; frameworkId: string; type: string; title: string; summary: string;
  sourceId: string | null; sourcePath: string | null; packageId: string | null;
  symbolId: string | null; componentId: string | null; documentSectionId: string | null;
  exampleId: string | null; knowledgeCardId: string | null; scope: Record<string, unknown> | null;
  evidence: CandidateEvidence[]; score: number; scoreBreakdown: Record<string, number>;
  confidence: "high" | "medium" | "low"; reasons: string[]; relations: Array<{ type: string; from: string; distance: number }>;
  estimatedTokens: number; selected: boolean; excludedReason: string | null;
}
export interface RetrievalResult {
  schemaVersion: "1.0.0"; retrievalId: string; frameworkId: string; generatedAt: string;
  taskProfile: TaskProfile; sourceCommit: string; catalogSnapshotId: string; catalogRootHash: string;
  symbolSnapshotId: string; symbolRootHash: string; semanticAvailable: boolean;
  candidates: RetrievalCandidate[]; selectedIds: string[]; excludedIds: string[];
  counts: { initial: number; expanded: number; selected: number; excluded: number; lowConfidence: number };
  businessHash: string; warnings: string[];
}
export interface SourceSnippet {
  id: string; type: string; candidateId: string; path: string; lineStart: number; lineEnd: number;
  fileSha256: string; commit: string; content: string; estimatedTokens: number;
}
export interface RetrievalOptions {
  labRoot: string; frameworkId: string; task: string; sourceCommit?: string; runId?: string;
  catalogSnapshot?: string; symbolSnapshot?: string; packages?: string[]; symbols?: string[];
  components?: string[]; includeInternal?: boolean; maxDepth?: number; limit?: number;
  retrievalId?: string; dryRun?: boolean; force?: boolean;
}

interface SymbolRow {
  id: string; name: string; qualifiedName: string; kind: string; packageId: string | null; moduleId: string;
  filePath: string; lineStart: number; lineEnd: number; declarationSha256: string; signature: string;
  publicReachable: boolean; publicPackages: string[]; publicExportNames: string[]; chainComplete: boolean;
  ambiguity: boolean; visibility: string; members: string[]; heritage: string[]; returnType: string | null;
  declaredType: string | null; parameters: Array<{ name: string; type: string | null }>; evidence: Array<{ path: string; line: number; fileSha256: string }>;
}
interface ComponentRow {
  id: string; name: string; symbolId: string; packageId: string | null; filePath: string; lineStart: number; lineEnd: number;
  detectionConfidence: "high" | "medium" | "low"; detectionReasons: string[]; baseTypes: string[];
  publicExportNames: string[]; publicPackages: string[]; props: string[]; events: string[]; slots: string[];
  methods: string[]; properties: string[]; styles: string[]; examples: string[]; documents: string[];
  evidence: Array<{ path: string; line: number; fileSha256: string }>; limitations: string[];
}
interface CatalogFile { id: string; path: string; sha256: string; lineCount: number | null; category: string; generated: boolean }
interface KnowledgeRow {
  id: string; type: string; title: string; summary: string; status: string; tags: string[];
  scope: { exactCommits: string[]; scopeUnknown: boolean }; claims: Array<{ id: string; text: string; status: string; evidence: Array<{ path: string | null; lineStart: number | null; lineEnd: number | null; sha256: string | null }> }>;
  limitations: string[];
}

export function normalizeTask(task: string, prefixes: string[] = [], aliases: Record<string, string[]> = {}): TaskProfile {
  const normalizedText = task.normalize("NFKC").replace(/\s+/gu, " ").trim();
  const identifiers = [...new Set(normalizedText.match(/\b[A-Za-z_$][\w$]*(?:[./\\-][\w$.-]+)*\b/gu) ?? [])].sort();
  const paths = [...new Set((normalizedText.match(/(?:[\w.-]+[\\/])+[\w.-]+/gu) ?? []).map(portablePath))].sort();
  const quoted = [...normalizedText.matchAll(/[`"'“”‘’]([^`"'“”‘’]+)[`"'“”‘’]/gu)].map((match) => match[1]!).sort();
  const cjkSegments = [...new Set(normalizedText.match(/[\p{Script=Han}]{2,}/gu) ?? [])].sort();
  const packages = identifiers.filter((item) => item.startsWith("@") || item.includes("/")).sort();
  const explicitSymbols = [...new Set([...identifiers, ...quoted].filter((item) => /^[A-Za-z_$][\w$]*$/u.test(item)))].sort();
  const explicitComponents = explicitSymbols.filter((item) => /^[A-Z][A-Za-z0-9_$]+$/u.test(item)).sort();
  const lower = normalizedText.toLowerCase();
  const intentSource = lower.replace(/(?:不要|不得|禁止|不允许|do not|don't|must not)\s*([^。；;\n]+)/giu, " ");
  const intentRules: Array<[string, RegExp]> = [
    ["understand", /了解|理解|分析|understand|explain/u], ["use", /使用|引用|接入|\buse\b|import/u],
    ["add", /新增|添加|创建|\badd\b|create/u], ["modify", /修改|调整|change|modify/u],
    ["fix", /修复|解决|\bfix\b/u], ["validate", /验证|校验|validate|verify/u],
    ["migrate", /迁移|migrate/u], ["debug", /定位|调试|排查|debug/u],
    ["document", /文档|说明|document/u], ["test", /测试|test/u],
  ];
  const intents = intentRules.filter(([, pattern]) => pattern.test(intentSource)).map(([name]) => name);
  const negativeConstraints = [...normalizedText.matchAll(/(?:不要|不得|禁止|不允许|do not|don't|must not)\s*([^。；;\n]+)/giu)].map((match) => clean(match[0]));
  const constraints = [...new Set([...negativeConstraints, ...[...normalizedText.matchAll(/(?:只|仅)\s*([^。；;\n]+)/gu)].map((match) => clean(match[0]))])];
  const prefixTerms = new Set(prefixes.map((prefix) => prefix.toLowerCase()));
  const technicalKeywords = [...new Set(words(normalizedText).flatMap((token) => {
    const lowerToken = token.toLowerCase();
    const expanded = splitIdentifier(token);
    for (const prefix of prefixes) if (token.startsWith(prefix) && token.length > prefix.length) expanded.push(token.slice(prefix.length).toLowerCase());
    for (const [key, values] of Object.entries(aliases)) if (lowerToken === key || values.some((value) => normalizedText.includes(value))) expanded.push(key, ...values);
    return [lowerToken, ...expanded];
  }).filter((token) => token.length > 1 && !prefixTerms.has(token)))].sort();
  return {
    schemaVersion: SCHEMA_VERSION, originalText: task, normalizedText, tokens: technicalKeywords,
    identifiers, cjkSegments, paths, quoted, packages, explicitSymbols, explicitComponents,
    technicalKeywords, intents, constraints, negativeConstraints,
  };
}

function addScore(candidate: RetrievalCandidate, key: string, value: number, reason: string): void {
  if (!value) return;
  candidate.scoreBreakdown[key] = (candidate.scoreBreakdown[key] ?? 0) + value;
  candidate.score += value;
  if (!candidate.reasons.includes(reason)) candidate.reasons.push(reason);
}
function baseCandidate(frameworkId: string, type: string, title: string, sourceId: string | null, summary: string): RetrievalCandidate {
  return {
    id: cid("candidate", `${type}\0${sourceId ?? title}`), frameworkId, type, title, summary: clean(summary),
    sourceId, sourcePath: null, packageId: null, symbolId: null, componentId: null,
    documentSectionId: null, exampleId: null, knowledgeCardId: null, scope: null, evidence: [],
    score: 0, scoreBreakdown: {}, confidence: "medium", reasons: [], relations: [],
    estimatedTokens: Math.ceil((title.length + summary.length) / 4), selected: false, excludedReason: null,
  };
}
function scopeMatches(card: KnowledgeRow, commit: string): boolean {
  return !card.scope.exactCommits.length || card.scope.exactCommits.includes(commit);
}
function termHits(profile: TaskProfile, values: string[]): number {
  const haystack = values.join(" ").toLowerCase();
  return profile.technicalKeywords.filter((term) => term.length > 1 && haystack.includes(term.toLowerCase())).length;
}

async function loadJson<T>(file: string): Promise<T> { return JSON.parse(await readFile(file, "utf8")) as T; }
async function loadCards(root: string): Promise<KnowledgeRow[]> {
  try {
    const files = (await readdir(root)).filter((file) => file.endsWith(".json") && file !== "index.json").sort();
    return await Promise.all(files.map((file) => loadJson<KnowledgeRow>(path.join(root, file))));
  } catch { return []; }
}

export async function queryRetrieval(options: RetrievalOptions): Promise<{ result: RetrievalResult; manifest: Record<string, unknown>; report: string; outputDir: string | null; existed: boolean }> {
  if (!options.task.trim()) throw new Error("--task 必须提供非空文本。");
  const catalogValidation = await validateCatalog(options.labRoot, options.frameworkId);
  if (catalogValidation.errors.length) throw new Error(`Catalog 无效：${catalogValidation.errors.join("; ")}`);
  const symbolValidation = await validateSymbols(options.labRoot, options.frameworkId);
  if (symbolValidation.errors.length) throw new Error(`Symbol Snapshot 无效：${symbolValidation.errors.join("; ")}`);
  const config = await loadFrameworkConfig(options.labRoot, options.frameworkId);
  const catalogRoot = path.join(options.labRoot, "frameworks", options.frameworkId, "catalog");
  const symbolRoot = path.join(options.labRoot, "frameworks", options.frameworkId, "symbols");
  const catalogCurrent = await loadJson<{ snapshotId: string; rootHash: string; commit: string }>(path.join(catalogRoot, "current.json"));
  const symbolCurrent = await loadJson<{ snapshotId: string; rootHash: string }>(path.join(symbolRoot, "current.json"));
  const catalogSnapshotId = options.catalogSnapshot ?? catalogCurrent.snapshotId;
  const symbolSnapshotId = options.symbolSnapshot ?? symbolCurrent.snapshotId;
  const cdir = path.join(catalogRoot, "snapshots", catalogSnapshotId);
  const sdir = path.join(symbolRoot, "snapshots", symbolSnapshotId);
  const [catalogSnapshot, filesDoc, packagesDoc, docsDoc, examplesDoc, catalogRelationships, analysis, symbolsDoc, componentsDoc, symbolRelationships, diagnosticsDoc] = await Promise.all([
    loadJson<{ sourceCommit: string; rootHash: string }>(path.join(cdir, "snapshot.json")),
    loadJson<{ files: CatalogFile[] }>(path.join(cdir, "files.json")),
    loadJson<{ packages: Array<{ id: string; name: string; directory: string; manifestPath: string }> }>(path.join(cdir, "packages.json")),
    loadJson<{ documents: Array<{ id: string; path: string; sha256: string; sections: Array<{ id: string; heading: string; lineStart: number; lineEnd: number; contentSha256: string }> }> }>(path.join(cdir, "documents.json")),
    loadJson<{ examples: Array<{ id: string; name?: string; rootPath: string; entryPoints?: string[]; relatedFiles: string[]; evidence?: unknown[] }> }>(path.join(cdir, "examples.json")),
    loadJson<{ relationships: unknown[] }>(path.join(cdir, "relationships.json")),
    loadJson<{ rootHash: string; sourceCommit: string; semanticAvailable: boolean; files: string[] }>(path.join(sdir, "analysis.json")),
    loadJson<{ symbols: SymbolRow[] }>(path.join(sdir, "symbols.json")),
    loadJson<{ components: ComponentRow[] }>(path.join(sdir, "components.json")),
    loadJson<{ relationships: Array<{ id: string; type: string; from: string; to: string; confidence: string; resolutionStatus: string; evidence: Array<{ path: string; line: number; fileSha256: string }> }> }>(path.join(sdir, "relationships.json")),
    loadJson<{ diagnostics: Array<{ category: string; file: string | null }> }>(path.join(sdir, "diagnostics.json")),
  ]);
  void catalogRelationships;
  let runCommit: string | undefined;
  if (options.runId) {
    const runSource = await loadJson<{ commit?: string | null }>(path.join(options.labRoot, "frameworks", options.frameworkId, "runs", options.runId, "source.json"));
    runCommit = runSource.commit ?? undefined;
  }
  const commit = options.sourceCommit ?? runCommit ?? catalogSnapshot.sourceCommit;
  if (!/^[a-f0-9]{40}$/u.test(commit)) throw new Error("非法 source commit。");
  if (catalogSnapshot.sourceCommit !== commit || analysis.sourceCommit !== commit) throw new Error("检索 commit 与 Catalog/Symbol Snapshot 不一致。");
  if (catalogSnapshot.rootHash !== catalogCurrent.rootHash || analysis.rootHash !== symbolCurrent.rootHash) throw new Error("current 与 Snapshot rootHash 不一致。");
  const retrievalConfig = config.analysis?.retrieval;
  const profile = normalizeTask(options.task, retrievalConfig?.identifierPrefixes ?? [], retrievalConfig?.aliases ?? {});
  const candidates = new Map<string, RetrievalCandidate>();
  const fileByPath = new Map(filesDoc.files.map((file) => [file.path, file]));
  const symbolById = new Map(symbolsDoc.symbols.map((symbol) => [symbol.id, symbol]));
  const explicitSymbols = new Set([...(options.symbols ?? []), ...profile.explicitSymbols]);
  const explicitComponents = new Set([...(options.components ?? []), ...profile.explicitComponents]);
  const packageFilters = new Set(options.packages ?? []);
  const normalizedTerms = new Set(profile.technicalKeywords);
  const unresolvedFiles = new Set(diagnosticsDoc.diagnostics.filter((item) => item.category === "module_resolution" && item.file).map((item) => item.file!));
  const add = (candidate: RetrievalCandidate) => { candidates.set(candidate.id, candidate); return candidate; };

  for (const symbol of symbolsDoc.symbols) {
    const exact = explicitSymbols.has(symbol.name) || explicitSymbols.has(symbol.qualifiedName) || symbol.publicExportNames.some((name) => explicitSymbols.has(name));
    const normalized = [...normalizedTerms].some((term) => splitIdentifier(symbol.name).includes(term) || symbol.name.toLowerCase() === term);
    const packageMatch = packageFilters.has(symbol.packageId ?? "") || symbol.publicPackages.some((pkg) => packageFilters.has(pkg));
    if (!exact && !normalized && !packageMatch) continue;
    if (!options.includeInternal && !symbol.publicReachable && !exact) continue;
    const candidate = add(baseCandidate(options.frameworkId, "symbol", symbol.qualifiedName, symbol.id, symbol.signature));
    candidate.symbolId = symbol.id; candidate.packageId = symbol.packageId; candidate.sourcePath = symbol.filePath;
    candidate.evidence = symbol.evidence.map((evidence) => ({ path: evidence.path, lineStart: evidence.line, lineEnd: symbol.lineEnd, sha256: evidence.fileSha256, source: "symbol_snapshot" }));
    candidate.confidence = symbol.publicReachable && symbol.chainComplete ? "high" : unresolvedFiles.has(symbol.filePath) ? "low" : "medium";
    if (exact) addScore(candidate, "exactIdentifierMatch", 120, "exact symbol or public export name");
    if (normalized) addScore(candidate, "normalizedIdentifierMatch", 50, "normalized identifier match");
    if ((options.symbols ?? []).includes(symbol.name)) addScore(candidate, "explicitUserInclude", 100, "explicit --symbol include");
    if (symbol.publicReachable && symbol.chainComplete) addScore(candidate, "publicApiReachability", 35, "complete public export chain");
    if (!symbol.publicReachable) addScore(candidate, "internalSymbolPenalty", -25, "internal symbol penalty");
    if (candidate.confidence === "low") addScore(candidate, "semanticCompleteness", -20, "unresolved dependency lowers confidence");
  }
  for (const component of componentsDoc.components) {
    const exact = explicitComponents.has(component.name) || (options.components ?? []).includes(component.name);
    const pieces = splitIdentifier(component.name);
    const normalized = [...normalizedTerms].some((term) => pieces.includes(term) || component.name.toLowerCase() === term);
    if (!exact && !normalized) continue;
    const candidate = add(baseCandidate(options.frameworkId, "component", component.name, component.id, `${component.name} component; ${component.baseTypes.join(", ")}`));
    candidate.componentId = component.id; candidate.symbolId = component.symbolId; candidate.packageId = component.packageId; candidate.sourcePath = component.filePath;
    candidate.evidence = component.evidence.map((evidence) => ({ path: evidence.path, lineStart: evidence.line, lineEnd: component.lineEnd, sha256: evidence.fileSha256, source: "component_snapshot" }));
    candidate.confidence = component.detectionConfidence;
    if (exact) addScore(candidate, "exactIdentifierMatch", 140, "exact component name");
    if (normalized) addScore(candidate, "normalizedIdentifierMatch", 55, "normalized component name");
    addScore(candidate, "componentMatch", 45, "component candidate");
    if (component.publicPackages.length) addScore(candidate, "publicApiReachability", 30, "component is publicly reachable");
    if (component.detectionConfidence === "low") addScore(candidate, "lowConfidencePenalty", -25, "low component detection confidence");
  }

  const seeds = [...candidates.values()].filter((candidate) => candidate.score > 0);
  const seedEntityIds = new Map<string, string>();
  for (const candidate of seeds) {
    if (candidate.symbolId) seedEntityIds.set(candidate.symbolId, candidate.id);
    if (candidate.componentId) seedEntityIds.set(candidate.componentId, candidate.id);
  }
  const maxDepth = Math.max(0, Math.min(options.maxDepth ?? 2, 5));
  const queue = [...seedEntityIds.entries()].map(([entity, candidateId]) => ({ entity, candidateId, distance: 0 }));
  const visited = new Set<string>();
  const allowedRelations = new Set(["symbol_extends_symbol", "symbol_implements_symbol", "symbol_references_type"]);
  const addSymbolExpansion = (symbol: SymbolRow, relation: { type: string; from: string; distance: number }, score: number) => {
    let candidate = [...candidates.values()].find((item) => item.symbolId === symbol.id);
    if (!candidate) {
      candidate = add(baseCandidate(options.frameworkId, "symbol", symbol.qualifiedName, symbol.id, symbol.signature));
      candidate.symbolId = symbol.id; candidate.packageId = symbol.packageId; candidate.sourcePath = symbol.filePath;
      candidate.evidence = symbol.evidence.map((evidence) => ({ path: evidence.path, lineStart: evidence.line, lineEnd: symbol.lineEnd, sha256: evidence.fileSha256, source: "symbol_snapshot" }));
      candidate.confidence = symbol.publicReachable && symbol.chainComplete ? "high" : "medium";
    }
    addScore(candidate, "graphDistance", score, `related by ${relation.type}`);
    candidate.relations.push(relation);
    return candidate;
  };
  while (queue.length) {
    const item = queue.shift()!;
    const visitKey = `${item.entity}\0${item.distance}`; if (visited.has(visitKey) || item.distance >= maxDepth) continue; visited.add(visitKey);
    for (const relation of symbolRelationships.relationships.filter((row) => allowedRelations.has(row.type) && row.from === item.entity)) {
      const target = relation.to;
      const distance = item.distance + 1;
      const rel = { type: relation.type, from: item.candidateId, distance };
      const targetSymbol = symbolById.get(target);
      if (targetSymbol) {
        const candidate = addSymbolExpansion(targetSymbol, rel, Math.max(8, 30 - distance * 8));
        queue.push({ entity: target, candidateId: candidate.id, distance });
      }
    }
  }
  for (const component of componentsDoc.components) {
    const parent = [...candidates.values()].find((candidate) => candidate.componentId === component.id);
    if (!parent) continue;
    const relatedSymbols = [...component.props, ...component.methods, ...component.properties, component.symbolId];
    for (const symbolId of relatedSymbols) {
      const symbol = symbolById.get(symbolId); if (!symbol) continue;
      const candidate = addSymbolExpansion(symbol, { type: component.props.includes(symbolId) ? "component_props" : "component_member", from: parent.id, distance: 1 }, component.props.includes(symbolId) ? 38 : 22);
      if (component.props.includes(symbolId)) addScore(candidate, "componentMatch", 20, "component Props model");
      if (splitIdentifier(symbol.name).some((term) => normalizedTerms.has(term))) addScore(candidate, "taskIntentMatch", 32, "component member matches task term");
    }
    if (component.events.length) {
      const candidate = add(baseCandidate(options.frameworkId, "public_export", `${component.name} events`, `${component.id}:events`, component.events.join(", ")));
      candidate.componentId = component.id; candidate.packageId = component.packageId; candidate.evidence = parent.evidence;
      candidate.confidence = "high"; candidate.relations.push({ type: "component_events", from: parent.id, distance: 1 });
      addScore(candidate, "componentMatch", 55, "events extracted from component source");
    }
    for (const style of component.styles) {
      const file = fileByPath.get(style); if (!file) continue;
      const candidate = add(baseCandidate(options.frameworkId, "style", style, file.id, style));
      candidate.sourcePath = style; candidate.packageId = component.packageId; candidate.componentId = component.id;
      candidate.evidence = [{ path: style, lineStart: 1, lineEnd: file.lineCount, sha256: file.sha256, source: "catalog" }];
      candidate.relations.push({ type: "component_has_style", from: parent.id, distance: 1 }); candidate.confidence = "high";
      addScore(candidate, "graphDistance", 24, "configured component style");
    }
    for (const examplePath of component.examples) {
      const example = examplesDoc.examples.find((row) => row.relatedFiles.includes(examplePath)); const file = fileByPath.get(examplePath);
      if (!example || !file) continue;
      const candidate = add(baseCandidate(options.frameworkId, "example", example.rootPath, `${example.id}:${examplePath}`, examplePath));
      candidate.exampleId = example.id; candidate.sourcePath = examplePath; candidate.componentId = component.id;
      candidate.evidence = [{ path: examplePath, lineStart: 1, lineEnd: file.lineCount, sha256: file.sha256, source: "catalog" }];
      candidate.relations.push({ type: "component_demonstrated_by", from: parent.id, distance: 1 }); candidate.confidence = "high";
      addScore(candidate, "exampleImportUseMatch", profile.intents.includes("add") || profile.normalizedText.includes("example") ? 48 : 28, "component example relation");
    }
    for (const documentPath of component.documents) {
      const document = docsDoc.documents.find((row) => row.path === documentPath); if (!document) continue;
      for (const section of document.sections.filter((section) => termHits(profile, [section.heading, component.name]) > 0).slice(0, 3)) {
        const candidate = add(baseCandidate(options.frameworkId, "document_section", `${document.path}#${section.heading}`, section.id, section.heading));
        candidate.documentSectionId = section.id; candidate.sourcePath = document.path; candidate.componentId = component.id;
        candidate.evidence = [{ path: document.path, lineStart: section.lineStart, lineEnd: section.lineEnd, sha256: document.sha256, source: "catalog_document" }];
        candidate.relations.push({ type: "component_documented_by", from: parent.id, distance: 1 }); candidate.confidence = "high";
        addScore(candidate, "documentHeadingMatch", 42, "component documentation section");
      }
    }
    if (component.publicPackages.length) {
      const candidate = add(baseCandidate(options.frameworkId, "public_export", `${component.name} public export`, `${component.symbolId}:public`, `${component.publicPackages.join(", ")} exports ${component.publicExportNames.join(", ")}`));
      candidate.symbolId = component.symbolId; candidate.componentId = component.id; candidate.packageId = component.packageId; candidate.evidence = parent.evidence;
      candidate.confidence = "high"; candidate.relations.push({ type: "package_publicly_exports_symbol", from: parent.id, distance: 1 });
      addScore(candidate, "publicApiReachability", 70, "complete component public export");
    }
  }

  for (const pkg of packagesDoc.packages) {
    const exact = packageFilters.has(pkg.id) || packageFilters.has(pkg.name) || profile.packages.includes(pkg.name);
    if (!exact && ![...candidates.values()].some((candidate) => candidate.packageId === pkg.id)) continue;
    const candidate = add(baseCandidate(options.frameworkId, "package", pkg.name, pkg.id, pkg.directory));
    candidate.packageId = pkg.id; candidate.sourcePath = pkg.manifestPath;
    const manifestFile = fileByPath.get(pkg.manifestPath);
    if (manifestFile) candidate.evidence = [{ path: pkg.manifestPath, lineStart: 1, lineEnd: manifestFile.lineCount, sha256: manifestFile.sha256, source: "catalog" }];
    candidate.confidence = "high"; addScore(candidate, exact ? "exactIdentifierMatch" : "graphDistance", exact ? 100 : 18, exact ? "exact package include" : "package of selected symbol");
  }

  const cards = await loadCards(path.join(options.labRoot, "frameworks", options.frameworkId, "knowledge"));
  for (const card of cards) {
    if (card.status !== "active") continue;
    if (!scopeMatches(card, commit)) continue;
    const hits = termHits(profile, [card.title, card.summary, ...card.tags, ...card.claims.map((claim) => claim.text)]);
    const specificTerms = profile.technicalKeywords.filter((term) => !["ncom", "run", "package", "packages", "component", "components", "source", "example", "commit", "yaml", "json"].includes(term));
    const specificHaystack = [card.title, ...card.tags].join(" ").toLowerCase();
    const specificHits = specificTerms.filter((term) => specificHaystack.includes(term)).length;
    const always = ["workflow_constraint", "validated_command", "environment_requirement"].includes(card.type);
    if (!hits && !always) continue;
    if (["known_issue", "verified_patch"].includes(card.type) && !specificHits) continue;
    const candidate = add(baseCandidate(options.frameworkId, card.type, card.title, card.id, card.summary));
    candidate.knowledgeCardId = card.id; candidate.scope = card.scope;
    candidate.evidence = card.claims.flatMap((claim) => claim.evidence.filter((evidence) => evidence.path).map((evidence) => ({
      path: evidence.path!, lineStart: evidence.lineStart, lineEnd: evidence.lineEnd, sha256: evidence.sha256, source: "knowledge_card",
    })));
    candidate.confidence = card.scope.scopeUnknown ? "low" : "high";
    addScore(candidate, "claimStatus", card.claims.some((claim) => claim.status === "verified") ? 28 : 18, "evidence-constrained knowledge claim");
    addScore(candidate, "scopeMatch", 25, "knowledge scope matches commit");
    addScore(candidate, "taskIntentMatch", hits * 18, `${hits} task terms match`);
    if (always) addScore(candidate, "evidenceCompleteness", 12, "baseline workflow or environment knowledge");
  }
  for (const card of cards.filter((row) => !scopeMatches(row, commit))) {
    const candidate = baseCandidate(options.frameworkId, card.type, card.title, card.id, card.summary);
    candidate.knowledgeCardId = card.id; candidate.scope = card.scope; candidate.excludedReason = "scope mismatch"; candidates.set(candidate.id, candidate);
  }

  const ranked = [...candidates.values()].sort((a, b) => b.score - a.score || a.type.localeCompare(b.type) || a.id.localeCompare(b.id));
  const limit = Math.max(1, Math.min(options.limit ?? 30, 500));
  const typeCaps: Record<string, number> = { symbol: 12, component: 4, example: 3, document_section: 3, style: 2, package: 3, public_export: 5, validated_command: 3, environment_requirement: 2, known_issue: 3, verified_patch: 3, workflow_constraint: 3, framework_overview: 1 };
  const selectedTypeCounts = new Map<string, number>();
  const selectedSemanticKeys = new Set<string>();
  const selected: RetrievalCandidate[] = [];
  for (const candidate of ranked) {
    if (selected.length >= limit) break;
    if (candidate.score <= 0 || candidate.excludedReason || (!options.includeInternal && candidate.scoreBreakdown.internalSymbolPenalty !== undefined)) continue;
    const semanticKey = `${candidate.type}\0${candidate.title}\0${candidate.sourcePath ?? ""}`;
    if (selectedSemanticKeys.has(semanticKey)) continue;
    const count = selectedTypeCounts.get(candidate.type) ?? 0;
    if (count >= (typeCaps[candidate.type] ?? limit)) continue;
    selectedTypeCounts.set(candidate.type, count + 1); selectedSemanticKeys.add(semanticKey); selected.push(candidate);
  }
  const selectedSet = new Set(selected.map((candidate) => candidate.id));
  for (const candidate of ranked) {
    candidate.selected = selectedSet.has(candidate.id);
    if (!candidate.selected && !candidate.excludedReason) candidate.excludedReason = candidate.score <= 0 ? "non-positive relevance" : "limit or lower relevance";
  }
  const retrievalId = options.retrievalId ?? `retrieval-${sha(`${options.frameworkId}\0${profile.normalizedText}\0${commit}\0${catalogSnapshotId}\0${symbolSnapshotId}`).slice(0, 12)}`;
  const business = {
    frameworkId: options.frameworkId, taskProfile: profile, sourceCommit: commit,
    catalogSnapshotId, catalogRootHash: catalogSnapshot.rootHash, symbolSnapshotId, symbolRootHash: analysis.rootHash,
    candidates: ranked.map((candidate) => {
      const stableCandidate = { ...candidate } as Partial<RetrievalCandidate>;
      delete stableCandidate.selected; delete stableCandidate.excludedReason;
      return stableCandidate;
    }),
    selectedIds: selected.map((candidate) => candidate.id),
  };
  const result: RetrievalResult = {
    schemaVersion: SCHEMA_VERSION, retrievalId, frameworkId: options.frameworkId, generatedAt: new Date().toISOString(),
    taskProfile: profile, sourceCommit: commit, catalogSnapshotId, catalogRootHash: catalogSnapshot.rootHash,
    symbolSnapshotId, symbolRootHash: analysis.rootHash, semanticAvailable: analysis.semanticAvailable,
    candidates: ranked, selectedIds: selected.map((candidate) => candidate.id),
    excludedIds: ranked.filter((candidate) => !candidate.selected).map((candidate) => candidate.id),
    counts: { initial: seeds.length, expanded: ranked.length - seeds.length, selected: selected.length, excluded: ranked.length - selected.length, lowConfidence: selected.filter((candidate) => candidate.confidence === "low").length },
    businessHash: `sha256:${sha(stable(business))}`,
    warnings: analysis.semanticAvailable ? ["TypeScript semantic analysis is limited by unresolved modules and diagnostics."] : ["Only syntax-level symbol information is available."],
  };
  await validateWithSchema(options.labRoot, "task-profile.schema.json", profile);
  await validateWithSchema(options.labRoot, "retrieval-result.schema.json", result);
  const report = renderRetrievalReport(result);
  const manifestBase = {
    schemaVersion: SCHEMA_VERSION, retrievalId, generatorVersion: VERSION, taskProfile: profile,
    sourceCommit: commit, sourceRun: options.runId ?? null, sourceDirty: false, catalogSnapshotId, catalogRootHash: catalogSnapshot.rootHash,
    symbolSnapshotId, symbolRootHash: analysis.rootHash,
    knowledgeIndexSha256: await fileHashOrNull(path.join(options.labRoot, "frameworks", options.frameworkId, "knowledge", "index.json")),
    inputHashes: {
      catalogManifest: await fileHashOrNull(path.join(cdir, "manifest.json")),
      symbolManifest: await fileHashOrNull(path.join(sdir, "manifest.json")),
    },
    initialCandidates: seeds.map((candidate) => candidate.id), expandedCandidates: ranked.filter((candidate) => candidate.relations.length).map((candidate) => candidate.id),
    selectedCandidates: result.selectedIds, excludedCandidates: ranked.filter((candidate) => !candidate.selected).map((candidate) => ({ id: candidate.id, reason: candidate.excludedReason })),
    scoreBreakdown: Object.fromEntries(ranked.map((candidate) => [candidate.id, candidate.scoreBreakdown])),
    graphPaths: ranked.flatMap((candidate) => candidate.relations.map((relation) => ({ candidateId: candidate.id, ...relation }))),
    scopeDecisions: ranked.filter((candidate) => candidate.knowledgeCardId).map((candidate) => ({ id: candidate.id, selected: candidate.selected, reason: candidate.excludedReason ?? "scope matched" })),
    confidenceAdjustments: ranked.filter((candidate) => candidate.confidence !== "high").map((candidate) => ({ id: candidate.id, confidence: candidate.confidence, reasons: candidate.reasons })),
    diagnosticImpacts: { semanticAvailable: analysis.semanticAvailable, unresolvedFiles: unresolvedFiles.size },
    snippetSelections: [], budgetDecisions: [], businessHash: result.businessHash,
    outputSha256: { "retrieval.json": sha(`${JSON.stringify(result, null, 2)}\n`), "report.md": sha(report) },
  };
  const manifest = manifestBase;
  await validateWithSchema(options.labRoot, "retrieval-manifest.schema.json", manifest);
  const root = path.join(options.labRoot, "frameworks", options.frameworkId, "retrievals");
  const output = path.join(root, retrievalId);
  if (options.dryRun) return { result, manifest, report, outputDir: null, existed: false };
  try {
    const existing = await loadJson<{ businessHash: string }>(path.join(output, "retrieval.json"));
    if (existing.businessHash === result.businessHash && !options.force) return { result: existing as RetrievalResult, manifest, report, outputDir: output, existed: true };
    if (!options.force) throw new Error(`${retrievalId} 已存在且业务结果不一致；使用 --force 覆盖。`);
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  await mkdir(root, { recursive: true });
  const temp = path.join(root, `.${retrievalId}.tmp-${process.pid}-${Date.now()}`);
  await mkdir(temp);
  try {
    await Promise.all([
      writeFile(path.join(temp, "retrieval.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8"),
      writeFile(path.join(temp, "report.md"), report, "utf8"),
      writeFile(path.join(temp, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
    ]);
    if (options.force) await rm(output, { recursive: true, force: true });
    await rename(temp, output);
  } catch (error) { await rm(temp, { recursive: true, force: true }); throw error; }
  return { result, manifest, report, outputDir: output, existed: false };
}

async function fileHashOrNull(file: string): Promise<string | null> {
  try { return sha(await readFile(file)); } catch { return null; }
}
export function renderRetrievalReport(result: RetrievalResult): string {
  const selected = result.candidates.filter((candidate) => candidate.selected);
  return `# Retrieval ${result.retrievalId}\n\n## Task\n\n${result.taskProfile.originalText}\n\n## Scope\n\n- Commit: ${result.sourceCommit}\n- Catalog: ${result.catalogSnapshotId} / ${result.catalogRootHash}\n- Symbols: ${result.symbolSnapshotId} / ${result.symbolRootHash}\n\n## Selected candidates\n\n| Score | Confidence | Type | Title | Reasons |\n|---:|---|---|---|---|\n${selected.map((candidate) => `| ${candidate.score} | ${candidate.confidence} | ${candidate.type} | ${candidate.title.replaceAll("|", "\\|")} | ${candidate.reasons.join("; ").replaceAll("|", "\\|")} |`).join("\n")}\n\n## Exclusions\n\n- Excluded: ${result.counts.excluded}\n- Low confidence selected: ${result.counts.lowConfidence}\n\n## Limitations\n\n${result.warnings.map((warning) => `- ${warning}`).join("\n")}\n`;
}

export async function loadRetrieval(labRoot: string, frameworkId: string, retrievalId: string): Promise<RetrievalResult> {
  const file = path.join(labRoot, "frameworks", frameworkId, "retrievals", retrievalId, "retrieval.json");
  const result = await loadJson<RetrievalResult>(file);
  await validateWithSchema(labRoot, "retrieval-result.schema.json", result);
  return result;
}
export async function validateRetrieval(labRoot: string, frameworkId: string, retrievalId: string): Promise<string[]> {
  const errors: string[] = [];
  try {
    const dir = path.join(labRoot, "frameworks", frameworkId, "retrievals", retrievalId);
    const [result, manifest] = await Promise.all([loadJson<RetrievalResult>(path.join(dir, "retrieval.json")), loadJson<Record<string, unknown>>(path.join(dir, "manifest.json"))]);
    await validateWithSchema(labRoot, "retrieval-result.schema.json", result);
    await validateWithSchema(labRoot, "retrieval-manifest.schema.json", manifest);
    if (result.frameworkId !== frameworkId || result.retrievalId !== retrievalId) errors.push("retrieval id/framework 不匹配");
    if (new Set(result.selectedIds).size !== result.selectedIds.length) errors.push("selected id 重复");
    for (const idValue of result.selectedIds) if (!result.candidates.some((candidate) => candidate.id === idValue && candidate.selected)) errors.push(`selected candidate 不存在：${idValue}`);
    const absolute = JSON.stringify(result).match(/[A-Za-z]:[\\/]|\/Users\/|\/home\//u);
    if (absolute) errors.push("retrieval 包含机器绝对路径");
    const hashes = manifest.outputSha256 as Record<string, string>;
    for (const name of ["retrieval.json", "report.md"]) {
      if (hashes[name] !== sha(await readFile(path.join(dir, name)))) errors.push(`${name} SHA256 不匹配`);
    }
  } catch (error) { errors.push((error as Error).message); }
  return errors;
}
export async function explainRetrieval(labRoot: string, frameworkId: string, retrievalId: string): Promise<string> {
  const result = await loadRetrieval(labRoot, frameworkId, retrievalId);
  return result.candidates.map((candidate) => `${candidate.selected ? "SELECT" : "EXCLUDE"} ${candidate.title} [${candidate.type}] score=${candidate.score} confidence=${candidate.confidence}: ${candidate.selected ? candidate.reasons.join("; ") : candidate.excludedReason}`).join("\n");
}

export async function extractSourceSnippets(options: {
  labRoot: string; frameworkId: string; retrieval: RetrievalResult; sourceDir?: string;
  maxSnippetLines?: number; maxSnippets?: number; includeImplementation?: boolean;
}): Promise<SourceSnippet[]> {
  const config = await loadFrameworkConfig(options.labRoot, options.frameworkId);
  const source = resolveFromLab(options.labRoot, options.sourceDir ?? config.framework.source_dir);
  const [head, dirty] = await Promise.all([
    spawnCollect("git", ["-C", source, "rev-parse", "HEAD"], source),
    spawnCollect("git", ["-C", source, "status", "--porcelain=v1", "--untracked-files=no"], source),
  ]);
  if (head.exitCode !== 0 || head.stdout.trim() !== options.retrieval.sourceCommit) throw new Error("源码 HEAD 与检索 commit 不一致。");
  if (dirty.exitCode !== 0 || dirty.stdout.trim()) throw new Error("源码存在 tracked dirty，拒绝片段提取。");
  const cdir = path.join(options.labRoot, "frameworks", options.frameworkId, "catalog", "snapshots", options.retrieval.catalogSnapshotId);
  const files = (await loadJson<{ files: CatalogFile[] }>(path.join(cdir, "files.json"))).files;
  const fileByPath = new Map(files.map((file) => [file.path, file]));
  const selected = options.retrieval.candidates.filter((candidate) => candidate.selected && candidate.sourcePath);
  const priority: Record<string, number> = { symbol: 100, public_export: 95, example: 90, document_section: 80, config: 60, module: 50 };
  const maxLines = Math.max(1, Math.min(options.maxSnippetLines ?? 40, 200));
  const maxSnippets = Math.max(0, Math.min(options.maxSnippets ?? 8, 100));
  const snippets: SourceSnippet[] = [];
  const seenRanges = new Set<string>();
  const snippetTypeCounts = new Map<string, number>();
  const snippetTypeCaps: Record<string, number> = { symbol: 3, public_export: 1, example: 2, document_section: 2, component: 1, config: 1, module: 1 };
  for (const candidate of selected.sort((a, b) => (priority[b.type] ?? 0) - (priority[a.type] ?? 0) || b.score - a.score || a.id.localeCompare(b.id))) {
    if (snippets.length >= maxSnippets || !candidate.sourcePath) break;
    const typeCount = snippetTypeCounts.get(candidate.type) ?? 0;
    if (typeCount >= (snippetTypeCaps[candidate.type] ?? maxSnippets)) continue;
    if (!options.includeImplementation && candidate.type === "module") continue;
    const file = fileByPath.get(candidate.sourcePath);
    if (!file || file.generated || /(^|\/)(?:node_modules|dist)(?:\/|$)/u.test(file.path)) continue;
    const full = path.resolve(source, ...file.path.split("/"));
    if (portablePath(path.relative(source, full)) !== file.path) throw new Error(`Catalog 文件越界：${file.path}`);
    const buffer = await readFile(full);
    if (sha(buffer) !== file.sha256) throw new Error(`Catalog 文件 SHA256 不匹配：${file.path}`);
    const lines = buffer.toString("utf8").split(/\r?\n/u);
    const evidence = candidate.evidence.find((item) => item.path === file.path);
    const requestedStart = Math.max(1, evidence?.lineStart ?? 1);
    const requestedEnd = Math.max(requestedStart, evidence?.lineEnd ?? requestedStart);
    const lineStart = requestedStart;
    let lineEnd = Math.min(lines.length, requestedEnd, lineStart + maxLines - 1);
    if (lineEnd - lineStart + 1 >= lines.length && lines.length > maxLines) lineEnd = lineStart + maxLines - 1;
    if (lineEnd > lines.length) lineEnd = lines.length;
    const rangeKey = `${file.path}\0${lineStart}\0${lineEnd}`;
    if (seenRanges.has(rangeKey)) continue;
    seenRanges.add(rangeKey);
    const content = lines.slice(lineStart - 1, lineEnd).join("\n");
    const type = candidate.type === "example" ? "example_excerpt" : candidate.type === "document_section" ? "document_excerpt"
      : candidate.type === "config" ? "config_excerpt" : candidate.type === "public_export" ? "export_chain_excerpt"
        : options.includeImplementation ? "implementation_excerpt" : "declaration";
    const snippet: SourceSnippet = {
      id: cid("snippet", `${candidate.id}\0${file.path}\0${lineStart}\0${lineEnd}`), type, candidateId: candidate.id,
      path: file.path, lineStart, lineEnd, fileSha256: file.sha256, commit: options.retrieval.sourceCommit,
      content, estimatedTokens: Math.ceil(content.length / 4),
    };
    await validateWithSchema(options.labRoot, "source-snippet.schema.json", snippet);
    snippetTypeCounts.set(candidate.type, typeCount + 1);
    snippets.push(snippet);
  }
  return snippets;
}
