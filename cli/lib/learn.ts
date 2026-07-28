import { createHash } from "node:crypto";
import { access, appendFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { extractSourceSnippets, queryRetrieval } from "./retrieval.js";
import { validateWithSchema } from "./schema.js";

const VERSION = "1.0.0";
const sha = (v: string | Buffer) => `sha256:${createHash("sha256").update(v).digest("hex")}`;
const now = () => new Date().toISOString();
const portable = (value: string) => value.replaceAll("\\", "/");
const absolute = (value: string) => path.isAbsolute(value) || /^[A-Za-z]:[\\/]/u.test(value);
const root = (lab: string, id: string) => path.join(lab, "frameworks", id, "learning");
const dir = (lab: string, id: string, ...parts: string[]) => path.join(root(lab, id), ...parts);

export type LearningStatus = "planned" | "bundled" | "handed_off" | "draft_imported" | "validated" | "reviewed" | "published" | "superseded" | "blocked";
export interface LearningTopic { id: string; frameworkId: string; type: string; title: string; description: string; packageIds: string[]; symbolIds: string[]; componentIds: string[]; documentSectionIds: string[]; exampleIds: string[]; prerequisiteTopicIds: string[]; priority: number; learningStatus: LearningStatus; sourceCommit: string; catalogRootHash: string; symbolRootHash: string; coverageTargets: string[]; warnings: string[]; }
export interface Claim { id: string; text: string; status: "observed" | "verified" | "manual" | "inferred"; confidence: "high" | "medium" | "low"; evidenceIds: string[]; appliesTo: string[]; exceptions: string[]; limitations: string[]; tags: string[]; }
export interface KnowledgeUnit { schemaVersion: string; id: string; frameworkId: string; type: string; title: string; summary: string; scope: { sourceCommit: string; catalogRootHash: string; symbolRootHash: string }; relatedPackages: string[]; relatedSymbols: string[]; relatedComponents: string[]; prerequisites: string[]; claims: Claim[]; recipes: Array<Record<string, unknown>>; constraints: string[]; limitations: string[]; evidence: Array<Record<string, unknown>>; sourceBundleId: string; generator: string; reviewStatus: "pending" | "reviewed"; publicationStatus: "draft" | "published" | "superseded"; freshnessStatus?: "current" | "carried_forward" | "partially_stale" | "stale" | "invalid" | "unresolved" | "superseded" | "retired"; supersedes?: string; revision?: number; createdAt: string; updatedAt: string; }

async function json<T>(file: string): Promise<T> { return JSON.parse(await readFile(file, "utf8")) as T; }
async function writeJson(file: string, value: unknown) { await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8"); }
async function exists(file: string) { try { await access(file); return true; } catch { return false; } }
async function current(lab: string, frameworkId: string) {
  const [catalog, symbols] = await Promise.all([
    json<{ snapshotId: string; commit: string; rootHash: string }>(path.join(lab, "frameworks", frameworkId, "catalog", "current.json")),
    json<{ snapshotId: string; rootHash: string }>(path.join(lab, "frameworks", frameworkId, "symbols", "current.json")),
  ]);
  return { catalog, symbols };
}
async function history(lab: string, frameworkId: string, event: Record<string, unknown>) { await mkdir(root(lab, frameworkId), { recursive: true }); await appendFile(dir(lab, frameworkId, "history.jsonl"), `${JSON.stringify({ timestamp: now(), ...event })}\n`, "utf8"); }
function ensurePortable(value: unknown, name: string) { if (JSON.stringify(value).match(/[A-Za-z]:[\\/]|\\\\[^\\]+\\|\/Users\/|\/home\//u)) throw new Error(`${name} 包含机器绝对路径。`); }

interface TopicSeed { id: string; type: string; title: string; description: string; query: string; packageIds?: string[]; symbolNames?: string[]; componentNames?: string[]; prerequisites?: string[]; priority?: number; coverageTargets?: string[]; }
async function seeds(lab: string, frameworkId: string): Promise<TopicSeed[]> {
  const file = path.join(lab, "frameworks", frameworkId, "learning-topics.json");
  if (await exists(file)) return (await json<{ topics: TopicSeed[] }>(file)).topics;
  const snapshot = await current(lab, frameworkId);
  const packages = await json<{ packages: Array<{ id: string; name: string }> }>(path.join(lab, "frameworks", frameworkId, "catalog", "snapshots", snapshot.catalog.snapshotId, "packages.json"));
  return packages.packages.filter((item) => item.id !== "root").sort((a, b) => a.id.localeCompare(b.id)).map((item, index) => ({ id: `package-${item.id.replace(/^package-/u, "")}`, type: "package", title: `${item.name} package`, description: `Learn the ${item.name} package surface.`, query: item.name, packageIds: [item.id], priority: 100 - index, coverageTargets: ["package"] }));
}
async function topicMap(lab: string, frameworkId: string) {
  const scope = await current(lab, frameworkId);
  const symbolFile = path.join(lab, "frameworks", frameworkId, "symbols", "snapshots", scope.symbols.snapshotId, "symbols.json");
  const componentFile = path.join(lab, "frameworks", frameworkId, "symbols", "snapshots", scope.symbols.snapshotId, "components.json");
  const [symbols, components] = await Promise.all([json<{ symbols: Array<{ id: string; name: string }> }>(symbolFile), json<{ components: Array<{ id: string; name: string }> }>(componentFile)]);
  const published = await listPublished(lab, frameworkId);
  const result = new Map<string, LearningTopic>();
  for (const seed of await seeds(lab, frameworkId)) {
    const ids = symbols.symbols.filter((item) => (seed.symbolNames ?? []).includes(item.name)).map((item) => item.id);
    const componentIds = components.components.filter((item) => (seed.componentNames ?? []).includes(item.name)).map((item) => item.id);
    const covered = published.some((unit) => unit.scope.sourceCommit === scope.catalog.commit && unit.title === seed.title && unit.publicationStatus === "published");
    result.set(seed.id, { id: seed.id, frameworkId, type: seed.type, title: seed.title, description: seed.description, packageIds: seed.packageIds ?? [], symbolIds: ids, componentIds, documentSectionIds: [], exampleIds: [], prerequisiteTopicIds: seed.prerequisites ?? [], priority: seed.priority ?? 50, learningStatus: covered ? "published" : "planned", sourceCommit: scope.catalog.commit, catalogRootHash: scope.catalog.rootHash, symbolRootHash: scope.symbols.rootHash, coverageTargets: seed.coverageTargets ?? [], warnings: ids.length < (seed.symbolNames ?? []).length ? ["some configured symbols were not found"] : [] });
  }
  return result;
}

export async function planLearning(lab: string, frameworkId: string) {
  const topics = [...(await topicMap(lab, frameworkId)).values()].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  const plan = { schemaVersion: VERSION, frameworkId, generatedAt: now(), topics, businessHash: sha(JSON.stringify(topics)) };
  await validateWithSchema(lab, "learning-plan.schema.json", plan);
  await writeJson(dir(lab, frameworkId, "plan.json"), plan);
  await Promise.all(topics.map((topic) => writeJson(dir(lab, frameworkId, "topics", `${topic.id}.json`), topic)));
  await history(lab, frameworkId, { action: "plan", topicCount: topics.length, evidenceFile: "plan.json" });
  return plan;
}

export async function listPublished(lab: string, frameworkId: string): Promise<KnowledgeUnit[]> {
  const folder = dir(lab, frameworkId, "published");
  try { return await Promise.all((await readdir(folder)).sort().map((id) => json<KnowledgeUnit>(path.join(folder, id, "knowledge.json")))); } catch { return []; }
}
export async function getTopic(lab: string, frameworkId: string, topicId: string) { const map = await topicMap(lab, frameworkId); const topic = map.get(topicId); if (!topic) throw new Error(`未知 learning topic：${topicId}`); return topic; }

export async function createBundle(lab: string, frameworkId: string, topicId: string, budget = 6000) {
  if (budget < 600) throw new Error("Bundle budget 过小。");
  const topic = await getTopic(lab, frameworkId, topicId); const scope = await current(lab, frameworkId);
  const seed = (await seeds(lab, frameworkId)).find((item) => item.id === topicId)!;
  const retrieval = (await queryRetrieval({ labRoot: lab, frameworkId, task: seed.query, sourceCommit: topic.sourceCommit, limit: 18, dryRun: true })).result;
  const snippets = await extractSourceSnippets({ labRoot: lab, frameworkId, retrieval, maxSnippetLines: 36, maxSnippets: 8, includeImplementation: false });
  const evidence = snippets.map((snippet, index) => ({ id: `E${index + 1}`, type: snippet.type, sourcePath: snippet.path, lineStart: snippet.lineStart, lineEnd: snippet.lineEnd, sha256: snippet.fileSha256, commit: snippet.commit, note: "bounded snippet from existing Retrieval" }));
  if (!evidence.length) for (const ref of retrieval.candidates.filter((candidate) => candidate.selected).flatMap((candidate) => candidate.evidence).filter((ref) => ref.path && ref.sha256).slice(0, 6)) evidence.push({ id: `E${evidence.length + 1}`, type: "catalog_reference", sourcePath: ref.path!, lineStart: ref.lineStart ?? 1, lineEnd: ref.lineEnd ?? ref.lineStart ?? 1, sha256: ref.sha256!, commit: topic.sourceCommit, note: "bounded catalog reference" });
  if (!evidence.length) throw new Error("Bundle 没有可定位 Evidence，拒绝生成。");
  const bundleId = `bundle-${topicId}-${topic.sourceCommit.slice(0, 7)}-${sha(JSON.stringify(evidence)).slice(7, 15)}`;
  const context = `# Learning Context: ${bundleId}\n\n## Topic\n\n${topic.title}\n\n${topic.description}\n\n## Scope\n\n- Commit: ${topic.sourceCommit}\n- Catalog: ${topic.catalogRootHash}\n- Symbols: ${topic.symbolRootHash}\n\n## Evidence Index\n\n${evidence.map((item) => `- ${item.id}: ${item.sourcePath}:${item.lineStart}-${item.lineEnd}; ${item.sha256}`).join("\n")}\n\n## Bounded excerpts\n\n${snippets.map((item, index) => `### E${index + 1}: ${item.path}:${item.lineStart}-${item.lineEnd}\n\n\`\`\`ts\n${item.content}\n\`\`\``).join("\n\n")}`;
  const estimated = Math.ceil(context.length / 4); if (estimated > budget) throw new Error(`Bundle exceeds budget: ${estimated} > ${budget}`);
  const bundle = { schemaVersion: VERSION, bundleId, frameworkId, topicId, sourceCommit: topic.sourceCommit, catalogSnapshotId: scope.catalog.snapshotId, catalogRootHash: topic.catalogRootHash, symbolSnapshotId: scope.symbols.snapshotId, symbolRootHash: topic.symbolRootHash, budget, estimatedTokens: estimated, retrievalId: retrieval.retrievalId, selectedCandidateIds: retrieval.selectedIds, evidenceIds: evidence.map((item) => item.id), createdAt: now(), status: "bundled", warnings: retrieval.warnings };
  await validateWithSchema(lab, "learning-bundle.schema.json", bundle); ensurePortable({ bundle, evidence }, "bundle metadata");
  const output = dir(lab, frameworkId, "bundles", bundleId); if (await exists(output)) throw new Error(`Bundle 已存在：${bundleId}`);
  await mkdir(output, { recursive: true }); await Promise.all([writeJson(path.join(output, "bundle.json"), bundle), writeJson(path.join(output, "evidence.json"), { schemaVersion: VERSION, bundleId, evidence }), writeFile(path.join(output, "learning-context.md"), `${context}\n`, "utf8")]);
  const manifest = { schemaVersion: VERSION, bundleId, files: Object.fromEntries(await Promise.all(["bundle.json", "evidence.json", "learning-context.md"].map(async (name) => [name, sha(await readFile(path.join(output, name)))]))) }; await writeJson(path.join(output, "manifest.json"), manifest);
  await history(lab, frameworkId, { action: "bundle", topicId, bundleId, evidenceFile: portable(path.relative(root(lab, frameworkId), path.join(output, "bundle.json"))) }); return { bundle, evidence, context, output };
}

export async function handoffLearning(lab: string, frameworkId: string, bundleId: string) {
  const output = dir(lab, frameworkId, "bundles", bundleId); const [context, bundle, evidence] = await Promise.all([readFile(path.join(output, "learning-context.md"), "utf8"), json<{ sourceCommit: string; catalogRootHash: string; symbolRootHash: string }>(path.join(output, "bundle.json")), bundleEvidence(lab, frameworkId, bundleId)]);
  const first = evidence.evidence[0]; if (!first) throw new Error("Bundle 无 Evidence，不能生成 handoff。");
  const template: KnowledgeUnit = { schemaVersion: VERSION, id: "replace-with-lowercase-knowledge-id", frameworkId, type: "framework_concept", title: "Replace with an evidence-bounded title", summary: "Replace with a concise evidence-bounded summary.", scope: { sourceCommit: bundle.sourceCommit, catalogRootHash: bundle.catalogRootHash, symbolRootHash: bundle.symbolRootHash }, relatedPackages: [], relatedSymbols: [], relatedComponents: [], prerequisites: [], claims: [{ id: "claim-1", text: "Replace with one fact supported by the selected Evidence.", status: "observed", confidence: "medium", evidenceIds: [first.id], appliesTo: [], exceptions: [], limitations: ["Bounded to the provided evidence and commit."], tags: [] }], recipes: [], constraints: [], limitations: ["Use only Evidence ids from this Bundle."], evidence: [{ evidenceIds: [first.id] }], sourceBundleId: bundleId, generator: "external-learning-agent", reviewStatus: "pending", publicationStatus: "draft", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };
  const instructions = `# Learning Agent Handoff\n\nRead only this Bundle's bounded evidence. Do not read framework source or modify files. Return exactly one UTF-8 JSON object: no Markdown fence, no prose before or after it. Maximum output: 80 KiB.\n\nRequired top-level fields: schemaVersion, id, frameworkId, type, title, summary, scope, relatedPackages, relatedSymbols, relatedComponents, prerequisites, claims, recipes, constraints, limitations, evidence, sourceBundleId, generator, reviewStatus, publicationStatus, createdAt, updatedAt.\n\nEnums: type is framework_concept|package_overview|component_api|usage_recipe|lifecycle|event_pattern|development_convention|build_workflow|troubleshooting|version_note|limitation; Claim status is observed|verified|manual|inferred; confidence is high|medium|low; reviewStatus is pending|reviewed; publicationStatus must be draft. Every Claim requires nonempty evidenceIds, and every evidence id must be one of the Bundle Evidence Index below. Do not claim intent, root cause, or behavior outside the evidence.\n\nPreflight locally before returning: pnpm framework-lab learn import ${frameworkId} ${bundleId} --input <draft.json> --dry-run\n\nCommon machine-readable failures: INVALID_JSON, SCHEMA_INVALID, BUNDLE_MISMATCH, UNKNOWN_EVIDENCE, ABSOLUTE_PATH, OUTPUT_TOO_LARGE.\n\n## Legal minimal template\n\n\`\`\`json\n${JSON.stringify(template, null, 2)}\n\`\`\`\n\nBundle: ${bundleId}\n\n${context}`;
  const handoff = { schemaVersion: VERSION, bundleId, generatedAt: now(), instructionSha256: sha(instructions), status: "handed_off", externalAgent: null, model: null, sessionUsage: null, maxOutputBytes: 81920, preflight: { command: `pnpm framework-lab learn import ${frameworkId} ${bundleId} --input <draft.json> --dry-run`, codes: ["INVALID_JSON", "SCHEMA_INVALID", "BUNDLE_MISMATCH", "UNKNOWN_EVIDENCE", "ABSOLUTE_PATH", "OUTPUT_TOO_LARGE"] } };
  await writeFile(path.join(output, "agent-instructions.md"), `${instructions}\n`, "utf8"); await writeJson(path.join(output, "draft-template.json"), template); await writeJson(path.join(output, "handoff.json"), handoff); await history(lab, frameworkId, { action: "handoff", bundleId, evidenceFile: `bundles/${bundleId}/handoff.json` }); return handoff;
}

async function bundleEvidence(lab: string, frameworkId: string, bundleId: string) { return json<{ evidence: Array<{ id: string; sourcePath: string; sha256: string; commit: string }> }>(dir(lab, frameworkId, "bundles", bundleId, "evidence.json")); }
function claimCheck(unit: KnowledgeUnit, evidenceIds: Set<string>) {
  const errors: string[] = []; const seen = new Set<string>();
  for (const claim of unit.claims) { if (seen.has(claim.id)) errors.push(`重复 Claim：${claim.id}`); seen.add(claim.id); if (!claim.evidenceIds.length) errors.push(`Claim 无 Evidence：${claim.id}`); for (const id of claim.evidenceIds) if (!evidenceIds.has(id)) errors.push(`Claim Evidence 不存在：${claim.id}/${id}`); if (claim.status === "verified" && !claim.evidenceIds.some((id) => /run|task|E/u.test(id))) errors.push(`verified Claim 缺少运行证据：${claim.id}`); }
  return errors;
}
export async function importDraft(lab: string, frameworkId: string, bundleId: string, input: string, dryRun = false) {
  if (absolute(input)) input = path.resolve(input); const raw = await readFile(input, "utf8"); if (Buffer.byteLength(raw, "utf8") > 81920) throw new Error("OUTPUT_TOO_LARGE: Draft 超过 80 KiB。"); let unit: KnowledgeUnit; try { unit = JSON.parse(raw) as KnowledgeUnit; } catch { throw new Error("INVALID_JSON: Draft 不是合法 JSON。"); } ensurePortable(unit, "knowledge draft"); try { await validateWithSchema(lab, "framework-knowledge-unit.schema.json", unit); } catch (error) { throw new Error(`SCHEMA_INVALID: ${error instanceof Error ? error.message : String(error)}`); }
  if (unit.frameworkId !== frameworkId || unit.sourceBundleId !== bundleId) throw new Error("Draft frameworkId 或 sourceBundleId 不匹配。"); const evidence = await bundleEvidence(lab, frameworkId, bundleId); const errors = claimCheck(unit, new Set(evidence.evidence.map((item) => item.id))); if (errors.length) throw new Error(errors.join("; "));
  if (dryRun) return unit.id;
  const output = dir(lab, frameworkId, "drafts", unit.id); if (await exists(output)) throw new Error(`Draft 已存在：${unit.id}`); await mkdir(output, { recursive: true }); await writeJson(path.join(output, "knowledge.json"), { ...unit, publicationStatus: "draft", reviewStatus: "pending", updatedAt: now() }); await writeJson(path.join(output, "review.json"), { schemaVersion: VERSION, knowledgeId: unit.id, events: [] }); await writeJson(path.join(output, "manifest.json"), { schemaVersion: VERSION, knowledgeId: unit.id, knowledgeSha256: sha(await readFile(path.join(output, "knowledge.json"))) }); await history(lab, frameworkId, { action: "import", bundleId, knowledgeId: unit.id, evidenceFile: `drafts/${unit.id}/knowledge.json` }); return unit.id;
}

export async function validateDraft(lab: string, frameworkId: string, knowledgeId: string) {
  const output = dir(lab, frameworkId, "drafts", knowledgeId);
  const unit = await json<KnowledgeUnit>(path.join(output, "knowledge.json"));
  await validateWithSchema(lab, "framework-knowledge-unit.schema.json", unit);
  const evidence = await bundleEvidence(lab, frameworkId, unit.sourceBundleId);
  const errors = claimCheck(unit, new Set(evidence.evidence.map((item) => item.id)));
  const scope = await current(lab, frameworkId);
  if (unit.scope.sourceCommit !== scope.catalog.commit || unit.scope.catalogRootHash !== scope.catalog.rootHash || unit.scope.symbolRootHash !== scope.symbols.rootHash) errors.push("Knowledge Scope 与当前 Snapshot 不一致。");
  const [symbols, components, catalog] = await Promise.all([
    json<{ symbols: Array<{ id: string }> }>(path.join(lab, "frameworks", frameworkId, "symbols", "snapshots", scope.symbols.snapshotId, "symbols.json")),
    json<{ components: Array<{ id: string }> }>(path.join(lab, "frameworks", frameworkId, "symbols", "snapshots", scope.symbols.snapshotId, "components.json")),
    json<{ files: Array<{ path: string; sha256: string }> }>(path.join(lab, "frameworks", frameworkId, "catalog", "snapshots", scope.catalog.snapshotId, "files.json")),
  ]);
  const symbolIds = new Set(symbols.symbols.map((item) => item.id)), componentIds = new Set(components.components.map((item) => item.id)), hashes = new Map(catalog.files.map((item) => [item.path, item.sha256]));
  for (const id of unit.relatedSymbols) if (!symbolIds.has(id)) errors.push(`Symbol 不存在：${id}`);
  for (const id of unit.relatedComponents) if (!componentIds.has(id)) errors.push(`Component 不存在：${id}`);
  for (const item of evidence.evidence) {
    if (item.sourcePath.startsWith("frameworks/")) {
      try { if (sha(await readFile(path.join(lab, ...item.sourcePath.split("/")))).slice(7) !== item.sha256) errors.push(`Evidence SHA256 不匹配：${item.id}`); } catch { errors.push(`Evidence 文件不存在：${item.id}`); }
    } else if (hashes.get(item.sourcePath) !== item.sha256) errors.push(`Evidence SHA256 不匹配：${item.id}`);
  }
  if (unit.claims.some((item) => item.text.length > 1200)) errors.push("Claim 过长，疑似复制大量源码。");
  if (errors.length) throw new Error(errors.join("; "));
  await history(lab, frameworkId, { action: "validate", knowledgeId, evidenceFile: `drafts/${knowledgeId}/knowledge.json` }); return unit;
}
export async function reviewDraft(lab: string, frameworkId: string, knowledgeId: string, options: { approve: string[]; reject: string[]; manual: string[]; limitations: string[]; approveRecipes: string[]; rejectRecipes: string[] }) {
  const output = dir(lab, frameworkId, "drafts", knowledgeId); const unit = await validateDraft(lab, frameworkId, knowledgeId); const review = await json<{ events: Array<Record<string, unknown>> }>(path.join(output, "review.json")); const ids = new Set(unit.claims.map((item) => item.id)); for (const id of [...options.approve, ...options.reject, ...options.manual]) if (!ids.has(id)) throw new Error(`未知 Claim：${id}`); const event = { timestamp: now(), approveClaimIds: options.approve, rejectClaimIds: options.reject, manualClaimIds: options.manual, limitations: options.limitations, approveRecipeIds: options.approveRecipes, rejectRecipeIds: options.rejectRecipes }; review.events.push(event); for (const claim of unit.claims) { if (options.reject.includes(claim.id)) claim.tags = [...new Set([...claim.tags, "rejected"])]; if (options.manual.includes(claim.id)) claim.status = "manual"; } unit.limitations = [...new Set([...unit.limitations, ...options.limitations])]; unit.reviewStatus = "reviewed"; unit.updatedAt = now(); await writeJson(path.join(output, "knowledge.json"), unit); await writeJson(path.join(output, "review.json"), { schemaVersion: VERSION, knowledgeId, events: review.events }); await history(lab, frameworkId, { action: "review", knowledgeId, evidenceFile: `drafts/${knowledgeId}/review.json` }); return unit;
}
export async function publishDraft(lab: string, frameworkId: string, knowledgeId: string) {
  const source = dir(lab, frameworkId, "drafts", knowledgeId); const unit = await validateDraft(lab, frameworkId, knowledgeId); const review = await json<{ events: Array<{ approveClaimIds: string[] }> }>(path.join(source, "review.json")); const approved = new Set(review.events.flatMap((event) => event.approveClaimIds)); const blocking = unit.claims.filter((claim) => claim.status === "inferred" || claim.tags.includes("rejected") || !approved.has(claim.id)); if (blocking.length) throw new Error(`无法发布；未审核或不可发布 Claim：${blocking.map((item) => item.id).join(", ")}`); const output = dir(lab, frameworkId, "published", knowledgeId); if (await exists(output)) throw new Error("Published Knowledge 不可覆盖；请使用 supersede。"); await mkdir(output, { recursive: true }); unit.publicationStatus = "published"; unit.updatedAt = now(); await writeJson(path.join(output, "knowledge.json"), unit); await writeJson(path.join(output, "manifest.json"), { schemaVersion: VERSION, knowledgeId, knowledgeSha256: sha(await readFile(path.join(output, "knowledge.json"))), sourceBundleId: unit.sourceBundleId }); await history(lab, frameworkId, { action: "publish", knowledgeId, evidenceFile: `published/${knowledgeId}/manifest.json` }); return unit;
}
export async function supersedeKnowledge(lab: string, frameworkId: string, knowledgeId: string) { const file = dir(lab, frameworkId, "published", knowledgeId, "knowledge.json"); const unit = await json<KnowledgeUnit>(file); if (unit.publicationStatus !== "published") throw new Error("只有 published Knowledge 可 supersede。"); unit.publicationStatus = "superseded"; unit.updatedAt = now(); await writeJson(file, unit); await history(lab, frameworkId, { action: "supersede", knowledgeId, evidenceFile: `published/${knowledgeId}/knowledge.json` }); return unit; }
export async function coverage(lab: string, frameworkId: string) { const [topics, units] = await Promise.all([topicMap(lab, frameworkId), listPublished(lab, frameworkId)]); const all = [...topics.values()]; const published = units.filter((item) => item.publicationStatus === "published"), packages = new Set(all.flatMap((item) => item.packageIds).filter((id) => id !== "root")), coveredPackages = new Set(published.flatMap((item) => item.relatedPackages).filter((id) => packages.has(id))), coveredSymbols = new Set(published.flatMap((item) => item.relatedSymbols)), coveredComponents = new Set(published.flatMap((item) => item.relatedComponents)); const result = { schemaVersion: VERSION, frameworkId, generatedAt: now(), topicCounts: Object.fromEntries(["planned", "bundled", "handed_off", "draft_imported", "validated", "reviewed", "published", "superseded", "blocked"].map((status) => [status, all.filter((item) => item.learningStatus === status).length])), publishedKnowledgeCount: published.length, packageCoverage: coveredPackages.size, packageCoverageDetail: { numerator: coveredPackages.size, denominator: packages.size, ratio: packages.size ? coveredPackages.size / packages.size : 0, excludes: ["root package", "virtual packages"] }, publicSymbolCoverage: coveredSymbols.size, componentCoverage: coveredComponents.size, componentApiCoverage: published.filter((item) => item.type === "component_api").length, documentCoverage: published.reduce((sum, item) => sum + item.evidence.filter((e) => String(e.type).includes("document")).length, 0), exampleCoverage: published.reduce((sum, item) => sum + item.evidence.filter((e) => String(e.type).includes("example")).length, 0), workflowCoverage: published.filter((item) => ["development_convention", "build_workflow"].includes(item.type)).length, staleKnowledgeCount: published.filter((item) => item.scope.sourceCommit !== all[0]?.sourceCommit || ["stale", "partially_stale", "invalid"].includes(item.freshnessStatus ?? "current")).length, evidenceCompleteness: published.length ? published.reduce((sum, item) => sum + item.claims.filter((claim) => claim.evidenceIds.length > 0).length, 0) / published.reduce((sum, item) => sum + item.claims.length, 0) : 0, lowConfidenceCount: published.reduce((sum, item) => sum + item.claims.filter((claim) => claim.confidence === "low").length, 0), warning: "Coverage means unique structured knowledge references, not complete framework understanding. Package coverage reports numerator, denominator, and excluded root/virtual packages." }; await validateWithSchema(lab, "learning-coverage.schema.json", result); await writeJson(dir(lab, frameworkId, "coverage.json"), result); return result; }
export async function listLearning(lab: string, frameworkId: string) { return { topics: [...(await topicMap(lab, frameworkId)).values()], drafts: await entries(dir(lab, frameworkId, "drafts")), published: await listPublished(lab, frameworkId) }; }
async function entries(folder: string) { try { return (await readdir(folder)).sort(); } catch { return []; } }
export async function showKnowledge(lab: string, frameworkId: string, knowledgeId: string) { for (const kind of ["published", "drafts"]) { const file = dir(lab, frameworkId, kind, knowledgeId, "knowledge.json"); if (await exists(file)) return json<KnowledgeUnit>(file); } throw new Error(`Knowledge 不存在：${knowledgeId}`); }
export async function createRefreshPlan(lab: string, frameworkId: string, impactId: string) {
  const impactDir = dir(lab, frameworkId, "impacts", impactId); const [impact, claims, units] = await Promise.all([json<{ toVersionId: string; rootHash: string }>(path.join(impactDir, "impact.json")), json<{ claims: Array<{ knowledgeId: string; claimId: string; freshnessStatus: string; recommendedAction: string }> }>(path.join(impactDir, "claims.json")), json<{ units: Array<{ knowledgeId: string; freshnessStatus: string; recommendedAction: string }> }>(path.join(impactDir, "units.json"))]);
  const affected = units.units.filter((unit) => unit.freshnessStatus !== "current"); const refreshId = `refresh-${impactId}`;
  const topics = affected.map((unit, index) => ({ id: `${refreshId}-${unit.knowledgeId}`, originalTopicId: unit.knowledgeId, affectedKnowledgeIds: [unit.knowledgeId], affectedClaimIds: claims.claims.filter((claim) => claim.knowledgeId === unit.knowledgeId && claim.freshnessStatus !== "current").map((claim) => claim.claimId), classification: unit.recommendedAction === "carry_forward" ? "carry_forward_candidate" : unit.recommendedAction === "relearn" ? "partial_relearning" : "revalidation", changedSymbols: [], changedDocuments: [], changedExamples: [], changedConfigs: [], requiredRuns: [], requiredManualReview: false, evidenceBudget: 4000, priority: 100 - index, reasons: ["derived only from the structured impact record"] }));
  const plan = { schemaVersion: VERSION, refreshId, frameworkId, impactId, targetVersionId: impact.toVersionId, topics, rootHash: sha(JSON.stringify({ impact: impact.rootHash, topics })) }; await validateWithSchema(lab, "refresh-plan.schema.json", plan); for (const topic of topics) await validateWithSchema(lab, "refresh-topic.schema.json", topic);
  const output = dir(lab, frameworkId, "refresh", refreshId); if (await exists(output)) throw new Error(`Refresh Plan 已存在：${refreshId}`); await writeJson(path.join(output, "plan.json"), plan); await Promise.all(topics.map((topic) => writeJson(path.join(output, "topics", `${topic.id}.json`), topic))); await history(lab, frameworkId, { action: "refresh_plan", impactId, refreshId, topicCount: topics.length, evidenceFile: `refresh/${refreshId}/plan.json` }); return plan;
}
export async function createRefreshBundle(lab: string, frameworkId: string, refreshId: string, topicId: string) {
  const output = dir(lab, frameworkId, "refresh", refreshId); const [plan, topic] = await Promise.all([json<{ impactId: string }>(path.join(output, "plan.json")), json<{ id: string; affectedKnowledgeIds: string[]; affectedClaimIds: string[]; evidenceBudget: number; reasons: string[] }>(path.join(output, "topics", `${topicId}.json`))]); const units = await Promise.all(topic.affectedKnowledgeIds.map((id) => showKnowledge(lab, frameworkId, id))); const bundleId = `refresh-bundle-${topicId}`; const bundle = { schemaVersion: VERSION, bundleId, refreshId, topicId, impactId: plan.impactId, affectedKnowledgeIds: topic.affectedKnowledgeIds, affectedClaimIds: topic.affectedClaimIds, previousSummaries: units.map((unit) => ({ knowledgeId: unit.id, summary: unit.summary, scope: unit.scope })), estimatedTokens: Math.min(4000, Math.ceil(JSON.stringify(units).length / 4)), budget: Math.min(4000, topic.evidenceBudget), instructions: "Only update affected knowledge. Do not rewrite unchanged claims. Use only the bounded old/new evidence and exact diff references.", limitations: ["No fuzzy evidence migration.", "New knowledge still requires review."] }; await validateWithSchema(lab, "refresh-bundle.schema.json", bundle); const bundleDir = path.join(output, "bundles", bundleId); if (await exists(bundleDir)) throw new Error(`Refresh Bundle 已存在：${bundleId}`); await writeJson(path.join(bundleDir, "bundle.json"), bundle); await history(lab, frameworkId, { action: "refresh_bundle", refreshId, topicId, bundleId, evidenceFile: `refresh/${refreshId}/bundles/${bundleId}/bundle.json` }); return bundle;
}
export async function carryForwardKnowledge(lab: string, frameworkId: string, knowledgeId: string) {
  const unit = await showKnowledge(lab, frameworkId, knowledgeId); const scope = await current(lab, frameworkId); if (unit.claims.some((claim) => claim.status === "verified")) throw new Error("verified Claim 需要目标版本验证证据，不能直接 carry forward。"); const revisionId = `${knowledgeId}-${scope.catalog.commit.slice(0, 7)}-r2`; const output = dir(lab, frameworkId, "published", revisionId); if (await exists(output)) throw new Error(`Knowledge revision 已存在：${revisionId}`); const next = { ...unit, id: revisionId, scope: { sourceCommit: scope.catalog.commit, catalogRootHash: scope.catalog.rootHash, symbolRootHash: scope.symbols.rootHash }, freshnessStatus: "carried_forward", supersedes: knowledgeId, revision: 2, createdAt: now(), updatedAt: now() }; await validateWithSchema(lab, "framework-knowledge-unit.schema.json", next); await writeJson(path.join(output, "knowledge.json"), next); await writeJson(path.join(output, "revision.json"), { schemaVersion: VERSION, knowledgeId, revisionId, sourceCommit: scope.catalog.commit, freshnessStatus: "carried_forward", publicationStatus: "published", createdAt: now() }); await history(lab, frameworkId, { action: "carry_forward", knowledgeId, revisionId, evidenceFile: `published/${revisionId}/knowledge.json` }); return revisionId;
}
export async function retireKnowledge(lab: string, frameworkId: string, knowledgeId: string) { await showKnowledge(lab, frameworkId, knowledgeId); const record = { schemaVersion: VERSION, knowledgeId, publicationStatus: "retired", retiredAt: now(), reason: "explicit user action required; original knowledge is retained" }; await writeJson(dir(lab, frameworkId, "retirements", `${knowledgeId}.json`), record); await history(lab, frameworkId, { action: "retire", knowledgeId, evidenceFile: `retirements/${knowledgeId}.json` }); return record; }
export async function queryPublishedKnowledge(lab: string, frameworkId: string, text: string, commit?: string, includeStale = false) {
  const stop = new Set([
    "ncom", "component", "components", "event", "workflow",
    "使用", "实现", "定位", "组件", "示例", "事件", "公共", "结构", "说明", "查找", "一个", "同时", "确认", "现有",
  ]);
  const terms = [...new Set(text.toLowerCase().split(/[^\p{L}\p{N}_-]+/u)
    .filter((item) => item.length > 1 && !stop.has(item)))];
  const requestedIdentifiers = terms.filter((term) => /^nc[a-z0-9]+$/u.test(term));
  const category = (unit: KnowledgeUnit) => {
    const tags = new Set(unit.claims.flatMap((claim) => claim.tags));
    if (unit.type === "component_api") return { name: "exact_component", priority: 60 };
    if (tags.has("family")) return { name: "component_family", priority: 50 };
    if (tags.has("mechanism") || ["framework_concept", "lifecycle", "event_pattern"].includes(unit.type)) return { name: "mechanism", priority: 40 };
    if (["development_convention", "build_workflow", "usage_recipe"].includes(unit.type)) return { name: "workflow", priority: 30 };
    if (unit.claims.some((claim) => claim.status === "verified") || unit.type === "troubleshooting") return { name: "validation", priority: 20 };
    return { name: "other_knowledge", priority: 10 };
  };
  return (await listPublished(lab, frameworkId))
    .filter((unit) =>
      unit.publicationStatus === "published" &&
      (!commit || unit.scope.sourceCommit === commit) &&
      (includeStale || !unit.freshnessStatus || ["current", "carried_forward"].includes(unit.freshnessStatus)))
    .map((unit) => {
      const haystack = `${unit.id} ${unit.title} ${unit.summary} ${unit.claims.map((claim) => `${claim.text} ${claim.tags.join(" ")}`).join(" ")}`.toLowerCase();
      const matchedTerms = terms.filter((term) => haystack.includes(term));
      const exactIdentifiers = terms.filter((term) => /^nc[a-z0-9]+$/u.test(term) && haystack.includes(term));
      const kind = category(unit);
      const score = kind.priority + matchedTerms.length * 20 + exactIdentifiers.length * 200;
      return {
        unit,
        score,
        category: kind.name,
        matchedTerms,
        exactIdentifiers,
        reasons: [
          `${kind.name} priority=${kind.priority}`,
          `matched terms=${matchedTerms.join(",") || "none"}`,
          `exact component identifiers=${exactIdentifiers.join(",") || "none"}`,
        ],
      };
    })
    .filter((item) =>
      item.matchedTerms.length > 0 &&
      (!requestedIdentifiers.length || item.category !== "exact_component" || item.exactIdentifiers.length > 0) &&
      (requestedIdentifiers.length > 0 || item.category !== "exact_component" || item.matchedTerms.length >= 3) &&
      (!requestedIdentifiers.length || item.exactIdentifiers.length > 0 || item.matchedTerms.length >= 2))
    .sort((a, b) => b.score - a.score || a.unit.id.localeCompare(b.unit.id));
}
