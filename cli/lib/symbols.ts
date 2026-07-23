import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { validateCatalog } from "./catalog.js";
import { loadFrameworkConfig } from "./config.js";
import { portablePath, resolveFromLab } from "./paths.js";
import { spawnCollect } from "./process.js";
import { validateWithSchema } from "./schema.js";

const VERSION = "0.1.6";
const SCHEMA_VERSION = "1.0.0";
const OUTPUTS = ["analysis.json", "modules.json", "symbols.json", "exports.json", "components.json", "relationships.json", "diagnostics.json", "statistics.json"] as const;
const KINDS = ["class", "interface", "type_alias", "enum", "function", "variable", "namespace", "constructor", "method", "property", "getter", "setter", "call_signature", "construct_signature", "index_signature", "enum_member"] as const;
type SymbolKind = typeof KINDS[number];

interface CatalogFile { id: string; path: string; category: string; language: string; packageId: string | null; sha256: string; lineCount: number | null; isText: boolean; generated: boolean }
interface CatalogPackage { id: string; name: string; directory: string; manifestPath: string; main: string | null; module: string | null; types: string | null; exports: unknown }
interface ModuleRecord {
  id: string; path: string; packageId: string | null; category: string; fileSha256: string; catalogFileId: string;
  scriptKind: string; isDeclarationFile: boolean; isExternalModule: boolean; hasDefaultExport: boolean;
  importCount: number; exportCount: number; declarationCount: number; publicSymbolCount: number;
  syntaxErrorCount: number; semanticErrorCount: number; sourceLines: number; warnings: string[];
}
interface Evidence { path: string; line: number; fileSha256: string }
interface SymbolRecord {
  id: string; name: string; qualifiedName: string; kind: SymbolKind; moduleId: string; packageId: string | null;
  filePath: string; lineStart: number; columnStart: number; lineEnd: number; columnEnd: number;
  declarationSha256: string; signature: string; exported: boolean; defaultExport: boolean; publicReachable: boolean;
  publicPackages: string[]; publicExportNames: string[]; exportChains: string[][]; shortestExportChain: string[] | null;
  chainComplete: boolean; ambiguity: boolean; visibility: string; visibilityExplicit: boolean; static: boolean;
  abstract: boolean; readonly: boolean; optional: boolean; async: boolean; generator: boolean;
  typeParameters: string[]; parameters: Array<{ name: string; type: string | null; optional: boolean; rest: boolean }>;
  returnType: string | null; declaredType: string | null; heritage: string[]; members: string[];
  jsDoc: { summary: string | null; tags: string[]; deprecated: boolean; examples: string[] };
  tags: string[]; evidence: Evidence[]; warnings: string[];
}
interface ImportRecord {
  id: string; moduleId: string; sourceSpecifier: string; resolvedModuleId: string | null; resolvedPackageId: string | null;
  importedName: string | null; localName: string | null; typeOnly: boolean; line: number; resolutionStatus: string;
}
interface ExportRecord {
  id: string; moduleId: string; exportedName: string; localName: string | null; symbolId: string | null;
  sourceSpecifier: string | null; resolvedModuleId: string | null; typeOnly: boolean; default: boolean;
  reExport: boolean; line: number; resolutionStatus: string;
}
interface DiagnosticRecord { id: string; category: string; severity: string; code: string | null; message: string; file: string | null; line: number | null; column: number | null; related: string[]; source: string; blocking: boolean }
interface Relationship { id: string; type: string; from: string; to: string; evidence: Evidence[]; confidence: string; resolutionStatus: string; warnings: string[] }
interface ComponentRecord {
  id: string; name: string; symbolId: string; packageId: string | null; sourceModuleId: string; filePath: string;
  lineStart: number; lineEnd: number; detectionConfidence: string; detectionReasons: string[]; baseTypes: string[];
  implementedInterfaces: string[]; publicExportNames: string[]; publicPackages: string[];
  props: string[]; events: string[]; slots: string[]; methods: string[]; properties: string[];
  lifecycleMethods: string[]; styles: string[]; examples: string[]; documents: string[];
  status: string; evidence: Evidence[]; limitations: string[];
}
interface SymbolData {
  analysis: Record<string, unknown>;
  modules: { schemaVersion: string; modules: ModuleRecord[] };
  symbols: { schemaVersion: string; symbols: SymbolRecord[] };
  exports: { schemaVersion: string; imports: ImportRecord[]; exports: ExportRecord[] };
  components: { schemaVersion: string; components: ComponentRecord[] };
  relationships: { schemaVersion: string; relationships: Relationship[] };
  diagnostics: { schemaVersion: string; diagnostics: DiagnosticRecord[] };
  statistics: Record<string, unknown>;
}
interface ExtractOptions {
  labRoot: string; frameworkId: string; catalogSnapshot?: string; sourceDir?: string; snapshotId?: string;
  syntaxOnly?: boolean; includeInternal?: boolean; dryRun?: boolean; force?: boolean; maxDiagnostics?: number;
}
export interface ExtractResult { snapshotId: string; rootHash: string; outputDir: string | null; existed: boolean; data: SymbolData }

function sha(value: string | Buffer): string { return createHash("sha256").update(value).digest("hex"); }
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(",")}}`;
  return JSON.stringify(value);
}
async function fileHash(file: string): Promise<string> {
  return await new Promise((resolve, reject) => {
    const hash = createHash("sha256"); const stream = createReadStream(file);
    stream.on("data", (chunk) => hash.update(chunk)); stream.once("error", reject); stream.once("end", () => resolve(hash.digest("hex")));
  });
}
function id(prefix: string, value: string): string { return `${prefix}-${sha(value).slice(0, 16)}`; }
function portableRelative(root: string, full: string): string {
  const result = portablePath(path.relative(root, full));
  if (result.startsWith("..") || path.isAbsolute(result) || result.includes("\\")) throw new Error(`路径越过源码根：${result}`);
  return result;
}
function globRegex(glob: string): RegExp {
  const source = glob.replace(/[.+^${}()|[\]\\]/gu, "\\$&")
    .replaceAll("**/", "\u0001").replaceAll("**", "\u0000").replaceAll("*", "[^/]*")
    .replaceAll("\u0001", "(?:.*/)?").replaceAll("\u0000", ".*");
  return new RegExp(`^${source}$`, "u");
}
function position(source: ts.SourceFile, node: ts.Node): [number, number, number, number] {
  const start = source.getLineAndCharacterOfPosition(node.getStart(source));
  const end = source.getLineAndCharacterOfPosition(node.getEnd());
  return [start.line + 1, start.character + 1, end.line + 1, end.character + 1];
}
function modifiers(node: ts.Node): readonly ts.Modifier[] {
  return ts.canHaveModifiers(node) ? ts.getModifiers(node) ?? [] : [];
}
function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean { return modifiers(node).some((item) => item.kind === kind); }
function nodeName(node: ts.NamedDeclaration, fallback: string): string {
  if (!node.name) return fallback;
  return ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) || ts.isNumericLiteral(node.name) ? node.name.text : node.name.getText();
}
function cleanText(value: string, max = 1000): string {
  const normalized = value.replace(/\s+/gu, " ").trim();
  return normalized.length > max ? `${normalized.slice(0, max - 1)}…` : normalized;
}
function typeParams(values: ts.NodeArray<ts.TypeParameterDeclaration> | undefined): string[] {
  return values?.map((item) => cleanText(item.getText(), 200)) ?? [];
}
function params(values: ts.NodeArray<ts.ParameterDeclaration> | undefined): SymbolRecord["parameters"] {
  return values?.map((item) => ({ name: item.name.getText(), type: item.type ? cleanText(item.type.getText(), 300) : null, optional: Boolean(item.questionToken || item.initializer), rest: Boolean(item.dotDotDotToken) })) ?? [];
}
function heritage(node: ts.ClassLikeDeclarationBase | ts.InterfaceDeclaration): string[] {
  return node.heritageClauses?.flatMap((clause) => clause.types.map((item) => cleanText(item.getText(), 300))) ?? [];
}
function signatureFor(node: ts.Node, source: ts.SourceFile, name: string, kind: SymbolKind): string {
  if (ts.isClassDeclaration(node)) return cleanText(`class ${name}${node.typeParameters ? `<${node.typeParameters.map((p) => p.getText()).join(", ")}>` : ""}${node.heritageClauses ? ` ${node.heritageClauses.map((h) => h.getText()).join(" ")}` : ""}`);
  if (ts.isInterfaceDeclaration(node)) return cleanText(`interface ${name}${node.typeParameters ? `<${node.typeParameters.map((p) => p.getText()).join(", ")}>` : ""}${node.heritageClauses ? ` ${node.heritageClauses.map((h) => h.getText()).join(" ")}` : ""}`);
  if (ts.isTypeAliasDeclaration(node)) return cleanText(`type ${name}${node.typeParameters ? `<${node.typeParameters.map((p) => p.getText()).join(", ")}>` : ""} = ${node.type.getText(source)}`);
  if (ts.isEnumDeclaration(node)) return `enum ${name}`;
  if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isMethodSignature(node) || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node) || ts.isConstructorDeclaration(node)) {
    const start = node.getStart(source); const end = "body" in node && node.body ? node.body.getStart(source) : node.getEnd();
    return cleanText(source.text.slice(start, end).replace(/;?\s*$/u, ""));
  }
  if (ts.isPropertyDeclaration(node) || ts.isPropertySignature(node) || ts.isVariableDeclaration(node)) {
    const type = node.type ? `: ${node.type.getText(source)}` : "";
    const optional = "questionToken" in node && node.questionToken ? "?" : "";
    return cleanText(`${kind === "variable" ? "const " : ""}${name}${optional}${type}`);
  }
  return cleanText(node.getText(source), 1000);
}
function jsDoc(node: ts.Node, source: ts.SourceFile): SymbolRecord["jsDoc"] {
  const prefix = source.text.slice(node.getFullStart(), node.getStart(source));
  const match = /\/\*\*([\s\S]*?)\*\/\s*$/u.exec(prefix);
  if (!match?.[1]) return { summary: null, tags: [], deprecated: false, examples: [] };
  const body = match[1].split(/\r?\n/u).map((line) => line.replace(/^\s*\*\s?/u, "")).join("\n");
  const tags = [...body.matchAll(/@([A-Za-z][\w-]*)/gu)].map((item) => item[1] ?? "").filter(Boolean);
  const summary = cleanText(body.split(/^\s*@/mu)[0] ?? "", 500) || null;
  const examples = [...body.matchAll(/@example\s+([^@]+)/gu)].map((item) => cleanText(item[1] ?? "", 500));
  return { summary, tags, deprecated: tags.includes("deprecated"), examples };
}
function visibility(node: ts.Node, member: boolean): [string, boolean] {
  if (hasModifier(node, ts.SyntaxKind.PrivateKeyword)) return ["private", true];
  if (hasModifier(node, ts.SyntaxKind.ProtectedKeyword)) return ["protected", true];
  if (hasModifier(node, ts.SyntaxKind.PublicKeyword)) return ["public", true];
  return member ? ["public", false] : ["package", false];
}
function declarationKind(node: ts.Node): SymbolKind | null {
  if (ts.isClassDeclaration(node)) return "class"; if (ts.isInterfaceDeclaration(node)) return "interface";
  if (ts.isTypeAliasDeclaration(node)) return "type_alias"; if (ts.isEnumDeclaration(node)) return "enum";
  if (ts.isFunctionDeclaration(node)) return "function"; if (ts.isModuleDeclaration(node)) return "namespace";
  if (ts.isConstructorDeclaration(node)) return "constructor"; if (ts.isMethodDeclaration(node) || ts.isMethodSignature(node)) return "method";
  if (ts.isPropertyDeclaration(node) || ts.isPropertySignature(node)) return "property";
  if (ts.isGetAccessorDeclaration(node)) return "getter"; if (ts.isSetAccessorDeclaration(node)) return "setter";
  if (ts.isCallSignatureDeclaration(node)) return "call_signature"; if (ts.isConstructSignatureDeclaration(node)) return "construct_signature";
  if (ts.isIndexSignatureDeclaration(node)) return "index_signature"; if (ts.isEnumMember(node)) return "enum_member";
  return null;
}
function moduleCandidates(from: string, specifier: string): string[] {
  const base = specifier.startsWith(".") ? path.posix.normalize(path.posix.join(path.posix.dirname(from), specifier)) : specifier;
  return [base, `${base}.ts`, `${base}.tsx`, `${base}.d.ts`, `${base}/index.ts`, `${base}/index.tsx`];
}

async function build(options: ExtractOptions): Promise<{ data: SymbolData; snapshotId: string; rootHash: string }> {
  const extractionStartedAt = Date.now();
  const config = await loadFrameworkConfig(options.labRoot, options.frameworkId);
  const catalogRoot = path.resolve(options.labRoot, "frameworks", options.frameworkId, "catalog");
  const current = JSON.parse(await readFile(path.join(catalogRoot, "current.json"), "utf8")) as { snapshotId: string; rootHash: string; commit: string };
  const catalogSnapshot = options.catalogSnapshot ?? current.snapshotId;
  const validation = await validateCatalog(options.labRoot, options.frameworkId);
  if (validation.errors.length) throw new Error(`Catalog 无效：${validation.errors.join("; ")}`);
  const cdir = path.join(catalogRoot, "snapshots", catalogSnapshot);
  const [catalogAnalysis, fileDoc, packageDoc, configDoc, exampleDoc, documentDoc] = await Promise.all([
    readFile(path.join(cdir, "snapshot.json"), "utf8").then((v) => JSON.parse(v) as Record<string, unknown>),
    readFile(path.join(cdir, "files.json"), "utf8").then((v) => JSON.parse(v) as { files: CatalogFile[] }),
    readFile(path.join(cdir, "packages.json"), "utf8").then((v) => JSON.parse(v) as { packages: CatalogPackage[] }),
    readFile(path.join(cdir, "configs.json"), "utf8").then((v) => JSON.parse(v) as { configs: Array<{ id: string; path: string; type: string; sha256: string; references: string[] }> }),
    readFile(path.join(cdir, "examples.json"), "utf8").then((v) => JSON.parse(v) as { examples: Array<{ id: string; rootPath: string; relatedFiles: string[] }> }),
    readFile(path.join(cdir, "documents.json"), "utf8").then((v) => JSON.parse(v) as { documents: Array<{ id: string; path: string; sha256: string; sections: Array<{ id: string; heading: string; lineStart: number }> }> }),
  ]);
  const catalogCommit = String(catalogAnalysis.sourceCommit);
  const catalogRootHash = String(catalogAnalysis.rootHash);
  if (catalogSnapshot === current.snapshotId && (current.rootHash !== catalogRootHash || current.commit !== catalogCommit)) throw new Error("Catalog current 与 snapshot 不一致。");
  const source = resolveFromLab(options.labRoot, options.sourceDir ?? config.framework.source_dir);
  const headResult = await spawnCollect("git", ["-C", source, "rev-parse", "HEAD"], source);
  const dirtyResult = await spawnCollect("git", ["-C", source, "status", "--porcelain=v1", "--untracked-files=no"], source);
  if (headResult.exitCode !== 0 || headResult.stdout.trim() !== catalogCommit) throw new Error(`Catalog commit 与源码 HEAD 不匹配：${catalogCommit} / ${headResult.stdout.trim()}`);
  if (dirtyResult.exitCode !== 0 || dirtyResult.stdout.trim()) throw new Error("源码存在 tracked dirty，拒绝符号提取。");
  const selected = fileDoc.files.filter((file) => file.isText && !file.generated && file.language === "TypeScript" && ["source", "example", "test", "build"].includes(file.category)).sort((a, b) => a.path.localeCompare(b.path));
  const catalogPaths = new Set(fileDoc.files.map((file) => file.path));
  const selectedPaths = new Set(selected.map((file) => file.path));
  const sourceFiles = new Map<string, ts.SourceFile>();
  const contents = new Map<string, string>();
  for (const file of selected) {
    const full = path.resolve(source, ...file.path.split("/"));
    if (portableRelative(source, full) !== file.path) throw new Error(`Catalog 路径无法安全解析：${file.path}`);
    const content = await readFile(full, "utf8");
    if (sha(Buffer.from(content)) !== file.sha256) throw new Error(`Catalog 文件 SHA256 不匹配：${file.path}`);
    contents.set(file.path, content);
    sourceFiles.set(file.path, ts.createSourceFile(file.path, content, ts.ScriptTarget.Latest, true, file.path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS));
  }
  const moduleByPath = new Map<string, ModuleRecord>();
  const symbols: SymbolRecord[] = [];
  const imports: ImportRecord[] = [];
  const exports: ExportRecord[] = [];
  const diagnostics: DiagnosticRecord[] = [];
  const relationships: Relationship[] = [];
  const addDiagnostic = (category: string, message: string, file: string | null, line: number | null, code: string | null, sourceName: string, blocking = false): void => {
    if (diagnostics.length >= (options.maxDiagnostics ?? 1000)) return;
    diagnostics.push({ id: id("diagnostic", `${category}\0${message}\0${file}\0${line}`), category, severity: blocking ? "error" : "warning", code, message: cleanText(message, 800), file, line, column: null, related: [], source: sourceName, blocking });
  };
  const resolveModule = (from: string, specifier: string): { moduleId: string | null; packageId: string | null } => {
    for (const candidate of moduleCandidates(from, specifier)) {
      const module = moduleByPath.get(candidate); if (module) return { moduleId: module.id, packageId: module.packageId };
    }
    const pkg = packageDoc.packages.find((item) => item.name === specifier || specifier.startsWith(`${item.name}/`));
    if (pkg) {
      const sub = specifier === pkg.name ? "index.ts" : specifier.slice(pkg.name.length + 1);
      for (const candidate of [`${pkg.directory}/${sub}`, `${pkg.directory}/${sub}.ts`, `${pkg.directory}/${sub}/index.ts`]) {
        const module = moduleByPath.get(candidate); if (module) return { moduleId: module.id, packageId: pkg.id };
      }
      return { moduleId: moduleByPath.get(`${pkg.directory}/index.ts`)?.id ?? null, packageId: pkg.id };
    }
    return { moduleId: null, packageId: null };
  };
  for (const file of selected) {
    const sf = sourceFiles.get(file.path); if (!sf) continue;
    const syntax = (sf as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics;
    const module: ModuleRecord = {
      id: id("module", file.path), path: file.path, packageId: file.packageId, category: file.category,
      fileSha256: file.sha256, catalogFileId: file.id, scriptKind: file.path.endsWith(".tsx") ? "TSX" : "TS",
      isDeclarationFile: file.path.endsWith(".d.ts"), isExternalModule: ts.isExternalModule(sf),
      hasDefaultExport: false, importCount: 0, exportCount: 0, declarationCount: 0, publicSymbolCount: 0,
      syntaxErrorCount: syntax.length, semanticErrorCount: 0, sourceLines: file.lineCount ?? 0, warnings: [],
    };
    moduleByPath.set(file.path, module);
    for (const diag of syntax) {
      const pos = diag.start === undefined ? null : sf.getLineAndCharacterOfPosition(diag.start).line + 1;
      addDiagnostic("syntactic", ts.flattenDiagnosticMessageText(diag.messageText, " "), file.path, pos, String(diag.code), "typescript");
    }
  }
  const localSymbol = new Map<string, SymbolRecord>();
  const importedLocal = new Map<string, { moduleId: string; importedName: string }>();
  const addRelationship = (type: string, from: string, to: string, evidence: Evidence[], confidence = "high", resolutionStatus = "resolved"): void => {
    relationships.push({ id: id("relationship", `${type}\0${from}\0${to}\0${evidence[0]?.path ?? ""}`), type, from, to, evidence, confidence, resolutionStatus, warnings: [] });
  };
  const addSymbol = (node: ts.NamedDeclaration, kind: SymbolKind, sf: ts.SourceFile, module: ModuleRecord, parent?: SymbolRecord): SymbolRecord => {
    const name = nodeName(node, kind === "constructor" ? "constructor" : "anonymous");
    const [lineStart, columnStart, lineEnd, columnEnd] = position(sf, node);
    const exported = hasModifier(node, ts.SyntaxKind.ExportKeyword);
    const defaultExport = hasModifier(node, ts.SyntaxKind.DefaultKeyword);
    const member = Boolean(parent);
    const [vis, explicit] = visibility(node, member);
    const signature = signatureFor(node, sf, name, kind);
    const supportsTypeParameters = ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)
      || ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isMethodSignature(node);
    const supportsParameters = ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isMethodSignature(node)
      || ts.isConstructorDeclaration(node) || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node);
    const returnTypeNode = (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isMethodSignature(node) || ts.isGetAccessorDeclaration(node)) ? node.type : undefined;
    const declaredTypeNode = (ts.isPropertyDeclaration(node) || ts.isPropertySignature(node) || ts.isVariableDeclaration(node) || ts.isTypeAliasDeclaration(node)) ? node.type : undefined;
    const record: SymbolRecord = {
      id: id("symbol", `${module.path}\0${parent?.qualifiedName ?? ""}\0${kind}\0${name}\0${lineStart}`),
      name, qualifiedName: parent ? `${parent.qualifiedName}.${name}` : name, kind, moduleId: module.id,
      packageId: module.packageId, filePath: module.path, lineStart, columnStart, lineEnd, columnEnd,
      declarationSha256: sha(signature), signature, exported, defaultExport, publicReachable: false,
      publicPackages: [], publicExportNames: [], exportChains: [], shortestExportChain: null, chainComplete: false, ambiguity: false,
      visibility: vis, visibilityExplicit: explicit, static: hasModifier(node, ts.SyntaxKind.StaticKeyword),
      abstract: hasModifier(node, ts.SyntaxKind.AbstractKeyword), readonly: hasModifier(node, ts.SyntaxKind.ReadonlyKeyword),
      optional: "questionToken" in node && Boolean(node.questionToken), async: hasModifier(node, ts.SyntaxKind.AsyncKeyword),
      generator: "asteriskToken" in node && Boolean(node.asteriskToken),
      typeParameters: supportsTypeParameters ? typeParams(node.typeParameters) : [],
      parameters: supportsParameters ? params(node.parameters) : [],
      returnType: returnTypeNode ? cleanText(returnTypeNode.getText(sf), 300) : null,
      declaredType: declaredTypeNode ? cleanText(declaredTypeNode.getText(sf), 500) : null,
      heritage: ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node) ? heritage(node) : [],
      members: [], jsDoc: jsDoc(node, sf), tags: [], evidence: [{ path: module.path, line: lineStart, fileSha256: module.fileSha256 }], warnings: [],
    };
    symbols.push(record); module.declarationCount += 1; localSymbol.set(`${module.id}\0${name}`, record);
    if (parent) { parent.members.push(record.id); addRelationship("symbol_member_of", record.id, parent.id, record.evidence); }
    return record;
  };
  for (const file of selected) {
    const sf = sourceFiles.get(file.path); const module = moduleByPath.get(file.path); if (!sf || !module) continue;
    for (const statement of sf.statements) {
      if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
        const spec = statement.moduleSpecifier.text; const resolved = resolveModule(file.path, spec); const line = position(sf, statement)[0];
        const addImport = (importedName: string | null, localName: string | null, typeOnly: boolean): void => {
          const rec: ImportRecord = { id: id("import", `${module.id}\0${line}\0${importedName}\0${localName}`), moduleId: module.id, sourceSpecifier: spec, resolvedModuleId: resolved.moduleId, resolvedPackageId: resolved.packageId, importedName, localName, typeOnly, line, resolutionStatus: resolved.moduleId ? "resolved" : "unresolved" };
          imports.push(rec); module.importCount += 1;
          if (localName && resolved.moduleId) importedLocal.set(`${module.id}\0${localName}`, { moduleId: resolved.moduleId, importedName: importedName ?? "default" });
          if (resolved.moduleId) addRelationship("module_imports_module", module.id, resolved.moduleId, [{ path: file.path, line, fileSha256: file.sha256 }]);
          else addDiagnostic("module_resolution", `Unresolved import: ${spec}`, file.path, line, null, "resolver");
        };
        const clause = statement.importClause;
        if (!clause) addImport(null, null, false);
        else {
          if (clause.name) addImport("default", clause.name.text, clause.isTypeOnly);
          if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) addImport("*", clause.namedBindings.name.text, clause.isTypeOnly);
          if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) for (const element of clause.namedBindings.elements) addImport(element.propertyName?.text ?? element.name.text, element.name.text, clause.isTypeOnly || element.isTypeOnly);
        }
      }
      if (ts.isImportEqualsDeclaration(statement) && ts.isExternalModuleReference(statement.moduleReference)
        && statement.moduleReference.expression && ts.isStringLiteral(statement.moduleReference.expression)) {
        const spec = statement.moduleReference.expression.text;
        const resolved = resolveModule(file.path, spec);
        const line = position(sf, statement)[0];
        imports.push({
          id: id("import", `${module.id}\0equals\0${line}`), moduleId: module.id, sourceSpecifier: spec,
          resolvedModuleId: resolved.moduleId, resolvedPackageId: resolved.packageId, importedName: "*",
          localName: statement.name.text, typeOnly: statement.isTypeOnly, line,
          resolutionStatus: resolved.moduleId ? "resolved" : "unresolved",
        });
        module.importCount += 1;
        if (resolved.moduleId) addRelationship("module_imports_module", module.id, resolved.moduleId, [{ path: file.path, line, fileSha256: file.sha256 }]);
        else addDiagnostic("module_resolution", `Unresolved import: ${spec}`, file.path, line, null, "resolver");
      }
      let top: SymbolRecord | null = null;
      const kind = declarationKind(statement);
      if (kind && "name" in statement) top = addSymbol(statement as unknown as ts.NamedDeclaration, kind, sf, module);
      if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) {
        const record = addSymbol(declaration, "variable", sf, module); record.exported = hasModifier(statement, ts.SyntaxKind.ExportKeyword);
      }
      if (top && (ts.isClassDeclaration(statement) || ts.isInterfaceDeclaration(statement))) {
        for (const child of statement.members) {
          const childKind = declarationKind(child); if (childKind) addSymbol(child, childKind, sf, module, top);
        }
      }
      if (top?.exported) {
        const exportedName = top.defaultExport ? "default" : top.name;
        exports.push({ id: id("export", `${module.id}\0${exportedName}\0${top.id}`), moduleId: module.id, exportedName, localName: top.name, symbolId: top.id, sourceSpecifier: null, resolvedModuleId: null, typeOnly: false, default: top.defaultExport, reExport: false, line: top.lineStart, resolutionStatus: "resolved" });
        module.exportCount += 1; module.hasDefaultExport ||= top.defaultExport; top.exported = true;
      }
      if (ts.isVariableStatement(statement) && hasModifier(statement, ts.SyntaxKind.ExportKeyword)) for (const declaration of statement.declarationList.declarations) {
        const name = declaration.name.getText(sf); const sym = localSymbol.get(`${module.id}\0${name}`) ?? null;
        exports.push({ id: id("export", `${module.id}\0${name}\0${sym?.id}`), moduleId: module.id, exportedName: name, localName: name, symbolId: sym?.id ?? null, sourceSpecifier: null, resolvedModuleId: null, typeOnly: false, default: false, reExport: false, line: position(sf, statement)[0], resolutionStatus: sym ? "resolved" : "unresolved" }); module.exportCount += 1;
      }
      if (ts.isExportDeclaration(statement)) {
        const spec = statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier) ? statement.moduleSpecifier.text : null;
        const resolved = spec ? resolveModule(file.path, spec) : { moduleId: null, packageId: null };
        const line = position(sf, statement)[0];
        if (!statement.exportClause) {
          exports.push({ id: id("export", `${module.id}\0*\0${spec}`), moduleId: module.id, exportedName: "*", localName: null, symbolId: null, sourceSpecifier: spec, resolvedModuleId: resolved.moduleId, typeOnly: statement.isTypeOnly, default: false, reExport: true, line, resolutionStatus: resolved.moduleId ? "resolved" : "unresolved" });
          if (resolved.moduleId) addRelationship("module_reexports_module", module.id, resolved.moduleId, [{ path: file.path, line, fileSha256: file.sha256 }]);
        } else if (ts.isNamespaceExport(statement.exportClause)) {
          exports.push({
            id: id("export", `${module.id}\0${statement.exportClause.name.text}\0${spec}\0${line}`),
            moduleId: module.id, exportedName: statement.exportClause.name.text, localName: "*", symbolId: null,
            sourceSpecifier: spec, resolvedModuleId: resolved.moduleId, typeOnly: statement.isTypeOnly,
            default: false, reExport: true, line, resolutionStatus: resolved.moduleId ? "resolved" : "unresolved",
          });
          if (resolved.moduleId) addRelationship("module_reexports_module", module.id, resolved.moduleId, [{ path: file.path, line, fileSha256: file.sha256 }]);
        } else if (ts.isNamedExports(statement.exportClause)) for (const element of statement.exportClause.elements) {
          const localName = element.propertyName?.text ?? element.name.text;
          let symbolId = localSymbol.get(`${module.id}\0${localName}`)?.id ?? null;
          if (!symbolId) {
            const imported = importedLocal.get(`${module.id}\0${localName}`);
            if (imported) symbolId = localSymbol.get(`${imported.moduleId}\0${imported.importedName}`)?.id ?? null;
          }
          exports.push({ id: id("export", `${module.id}\0${element.name.text}\0${spec}\0${line}`), moduleId: module.id, exportedName: element.name.text, localName, symbolId, sourceSpecifier: spec, resolvedModuleId: resolved.moduleId, typeOnly: statement.isTypeOnly || element.isTypeOnly, default: false, reExport: Boolean(spec), line, resolutionStatus: symbolId || resolved.moduleId ? "resolved" : "unresolved" });
        }
        module.exportCount += 1;
      }
      if (ts.isExportAssignment(statement)) {
        exports.push({ id: id("export", `${module.id}\0default\0${statement.pos}`), moduleId: module.id, exportedName: "default", localName: cleanText(statement.expression.getText(sf), 300), symbolId: null, sourceSpecifier: null, resolvedModuleId: null, typeOnly: false, default: true, reExport: false, line: position(sf, statement)[0], resolutionStatus: "unresolved" }); module.exportCount += 1; module.hasDefaultExport = true;
      }
      const visitDynamic = (node: ts.Node): void => {
        const argument = ts.isCallExpression(node) ? node.arguments[0] : undefined;
        if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments.length === 1 && argument && ts.isStringLiteral(argument)) {
          const spec = argument.text; const resolved = resolveModule(file.path, spec); const line = position(sf, node)[0];
          imports.push({ id: id("import", `${module.id}\0dynamic\0${line}`), moduleId: module.id, sourceSpecifier: spec, resolvedModuleId: resolved.moduleId, resolvedPackageId: resolved.packageId, importedName: "*", localName: null, typeOnly: false, line, resolutionStatus: resolved.moduleId ? "resolved" : "unresolved" });
        }
        ts.forEachChild(node, visitDynamic);
      };
      ts.forEachChild(statement, visitDynamic);
    }
  }
  const symbolById = new Map(symbols.map((symbol) => [symbol.id, symbol]));
  const symbolsByName = new Map<string, SymbolRecord[]>();
  for (const symbol of symbols) {
    const list = symbolsByName.get(symbol.name) ?? []; list.push(symbol); symbolsByName.set(symbol.name, list);
  }
  for (const symbol of symbols.filter((item) => item.kind === "class" || item.kind === "interface")) {
    for (const clause of symbol.heritage) {
      const name = clause.replace(/^(?:extends|implements)\s+/u, "").replace(/<.*$/u, "").trim();
      const target = symbolsByName.get(name)?.find((item) => item.kind === "class" || item.kind === "interface");
      if (target) addRelationship(clause.startsWith("implements ") ? "symbol_implements_symbol" : "symbol_extends_symbol", symbol.id, target.id, symbol.evidence);
    }
  }
  for (const exp of exports) {
    if (!exp.symbolId && exp.resolvedModuleId && exp.exportedName !== "*") exp.symbolId = localSymbol.get(`${exp.resolvedModuleId}\0${exp.localName ?? exp.exportedName}`)?.id ?? null;
    if (exp.symbolId) addRelationship("module_exports_symbol", exp.moduleId, exp.symbolId, [symbolById.get(exp.symbolId)?.evidence[0] ?? { path: "", line: exp.line, fileSha256: "" }]);
    if (exp.symbolId && exp.localName && exp.exportedName !== exp.localName) {
      addRelationship("symbol_aliases_symbol", exp.id, exp.symbolId, [symbolById.get(exp.symbolId)?.evidence[0] ?? { path: "", line: exp.line, fileSha256: "" }]);
    }
  }
  const exportsByModule = new Map<string, ExportRecord[]>();
  for (const exp of exports) { const list = exportsByModule.get(exp.moduleId) ?? []; list.push(exp); exportsByModule.set(exp.moduleId, list); }
  const resolvePublic = (moduleId: string, exportName: string, visited: Set<string>): Array<{ symbolId: string; chain: string[] }> => {
    const key = `${moduleId}\0${exportName}`; if (visited.has(key)) return []; visited.add(key);
    const results: Array<{ symbolId: string; chain: string[] }> = [];
    for (const exp of exportsByModule.get(moduleId) ?? []) {
      if (exp.exportedName === exportName && exp.symbolId) results.push({ symbolId: exp.symbolId, chain: [moduleId, exp.id, exp.symbolId] });
      if (exp.exportedName === exportName && exp.resolvedModuleId) for (const child of resolvePublic(exp.resolvedModuleId, exp.localName ?? exportName, new Set(visited))) results.push({ symbolId: child.symbolId, chain: [moduleId, exp.id, ...child.chain] });
      if (exp.exportedName === "*" && exp.resolvedModuleId) for (const child of resolvePublic(exp.resolvedModuleId, exportName, new Set(visited))) results.push({ symbolId: child.symbolId, chain: [moduleId, exp.id, ...child.chain] });
      if (exp.exportedName === exportName && !exp.symbolId && exp.localName) {
        const imported = importedLocal.get(`${moduleId}\0${exp.localName}`);
        if (imported) for (const child of resolvePublic(imported.moduleId, imported.importedName, new Set(visited))) results.push({ symbolId: child.symbolId, chain: [moduleId, exp.id, ...child.chain] });
      }
    }
    return results;
  };
  const rules = config.analysis?.typescript?.componentDetection;
  const publicPackages = rules?.publicPackages ?? packageDoc.packages.map((pkg) => pkg.name);
  for (const pkg of packageDoc.packages.filter((item) => publicPackages.includes(item.name))) {
    const entry = moduleByPath.get(`${pkg.directory}/index.ts`); if (!entry) { addDiagnostic("unresolved_package_entry", `No tracked TypeScript public entry for ${pkg.name}`, pkg.manifestPath, 1, null, "public-api"); continue; }
    const names = new Set((exportsByModule.get(entry.id) ?? []).filter((exp) => exp.exportedName !== "*").map((exp) => exp.exportedName));
    for (const star of (exportsByModule.get(entry.id) ?? []).filter((exp) => exp.exportedName === "*" && exp.resolvedModuleId)) {
      if (!star.resolvedModuleId) continue;
      for (const exp of exportsByModule.get(star.resolvedModuleId) ?? []) if (exp.exportedName !== "*") names.add(exp.exportedName);
    }
    for (const name of names) {
      const found = resolvePublic(entry.id, name, new Set());
      if (new Set(found.map((item) => item.symbolId)).size > 1) {
        addDiagnostic("duplicate_public_export", `Multiple public symbols resolve to export name ${name} in ${pkg.name}`, pkg.manifestPath, 1, null, "public-api");
      }
      for (const item of found) {
        const symbol = symbolById.get(item.symbolId); if (!symbol) continue;
        symbol.publicReachable = true; if (!symbol.publicPackages.includes(pkg.name)) symbol.publicPackages.push(pkg.name);
        if (!symbol.publicExportNames.includes(name)) symbol.publicExportNames.push(name);
        symbol.exportChains.push(item.chain); symbol.shortestExportChain = !symbol.shortestExportChain || item.chain.length < symbol.shortestExportChain.length ? item.chain : symbol.shortestExportChain;
        symbol.chainComplete = true; symbol.ambiguity ||= found.length > 1;
        addRelationship("package_publicly_exports_symbol", pkg.id, symbol.id, symbol.evidence);
      }
    }
  }
  for (const symbol of symbols) { symbol.publicPackages.sort(); symbol.publicExportNames.sort(); symbol.exportChains.sort((a, b) => a.join().localeCompare(b.join())); }
  for (const symbol of symbols) {
    const typeText = [symbol.declaredType, symbol.returnType, ...symbol.parameters.map((parameter) => parameter.type)].filter((value): value is string => Boolean(value)).join(" ");
    const names = new Set(typeText.match(/[A-Za-z_$][\w$]*/gu) ?? []);
    for (const name of names) {
      const targets = (symbolsByName.get(name) ?? []).filter((target) => target.id !== symbol.id);
      if (targets.length === 1) addRelationship("symbol_references_type", symbol.id, targets[0]!.id, symbol.evidence);
    }
  }
  for (const imported of imports.filter((item) => moduleByPath.get([...moduleByPath.values()].find((module) => module.id === item.moduleId)?.path ?? "")?.category === "example" && item.resolvedModuleId && item.importedName && item.importedName !== "*")) {
    if (!imported.resolvedModuleId || !imported.importedName) continue;
    for (const target of resolvePublic(imported.resolvedModuleId, imported.importedName, new Set())) {
      const evidenceModule = [...moduleByPath.values()].find((module) => module.id === imported.moduleId);
      if (!evidenceModule) continue;
      const evidence = [{ path: evidenceModule.path, line: imported.line, fileSha256: evidenceModule.fileSha256 }];
      addRelationship("example_imports_symbol", imported.moduleId, target.symbolId, evidence);
      const sourceText = contents.get(evidenceModule.path) ?? "";
      const withoutImports = sourceText.replace(/^\s*import[\s\S]*?;\s*$/gmu, "");
      if (imported.localName && new RegExp(`\\b${imported.localName.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}\\b`, "u").test(withoutImports)) {
        addRelationship("example_uses_symbol", imported.moduleId, target.symbolId, evidence);
      }
    }
  }
  const semanticDiagnostics: readonly ts.Diagnostic[] = [];
  let semanticAvailable = false;
  if (!options.syntaxOnly) {
    try {
      const rootNames = selected.map((file) => path.resolve(source, ...file.path.split("/")));
      let compilerOptions: ts.CompilerOptions = { noEmit: true, noResolve: true, noLib: true, skipLibCheck: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext };
      const tsconfig = configDoc.configs.find((item) => item.type === "TypeScript" && item.path === "tsconfig.json");
      if (tsconfig) {
        const configText = await readFile(path.resolve(source, tsconfig.path), "utf8");
        if (sha(Buffer.from(configText)) !== tsconfig.sha256) throw new Error(`Catalog 配置 SHA256 不匹配：${tsconfig.path}`);
        const parsed = ts.parseConfigFileTextToJson(tsconfig.path, configText);
        if (parsed.error) addDiagnostic("config", ts.flattenDiagnosticMessageText(parsed.error.messageText, " "), tsconfig.path, null, String(parsed.error.code), "typescript");
        else {
          const converted = ts.convertCompilerOptionsFromJson(parsed.config?.compilerOptions ?? {}, source, tsconfig.path);
          for (const error of converted.errors) addDiagnostic("config", ts.flattenDiagnosticMessageText(error.messageText, " "), tsconfig.path, null, String(error.code), "typescript");
          compilerOptions = { ...converted.options, noEmit: true, noResolve: true, noLib: true, skipLibCheck: true };
        }
      }
      const host = ts.createCompilerHost(compilerOptions);
      const originalRead = host.readFile;
      host.readFile = (fileName) => {
        const relative = portablePath(path.relative(source, fileName));
        return selectedPaths.has(relative) ? contents.get(relative) : originalRead(fileName);
      };
      const program = ts.createProgram(rootNames, compilerOptions, host);
      semanticAvailable = true;
      const semantic = program.getSemanticDiagnostics();
      for (const diag of semantic) {
        const relative = diag.file ? portablePath(path.relative(source, diag.file.fileName)) : null;
        const line = diag.file && diag.start !== undefined ? diag.file.getLineAndCharacterOfPosition(diag.start).line + 1 : null;
        if (relative) {
          const module = moduleByPath.get(relative);
          if (module) module.semanticErrorCount += 1;
        }
        addDiagnostic("semantic", ts.flattenDiagnosticMessageText(diag.messageText, " "), relative, line, String(diag.code), "typescript");
      }
      void semanticDiagnostics;
    } catch (error) { addDiagnostic("semantic", `TypeChecker unavailable: ${(error as Error).message}`, null, null, null, "typescript"); }
  }
  const components: ComponentRecord[] = [];
  if (rules) for (const symbol of symbols.filter((item) => item.kind === "class")) {
    const pathMatch = rules.sourceGlobs.some((glob) => globRegex(glob).test(symbol.filePath));
    const bases = symbol.heritage.map((item) => item.replace(/<.*$/u, "").trim());
    const baseMatch = bases.some((base) => rules.baseTypes.includes(base));
    const content = contents.get(symbol.filePath) ?? "";
    const registered = rules.registrationFunctions?.some((fn) => new RegExp(`\\b${fn}\\s*\\([^,]+,\\s*${symbol.name}\\b`, "u").test(content)) ?? false;
    const publicMatch = symbol.publicPackages.some((pkg) => rules.publicPackages.includes(pkg));
    const dir = path.posix.dirname(symbol.filePath); const basename = path.posix.basename(dir);
    const configuredStyles = rules.stylePatterns.map((pattern) => pattern.replaceAll("{dir}", dir).replaceAll("{basename}", basename));
    const importedStyles = imports.filter((item) => item.moduleId === symbol.moduleId && /\.(?:css|scss|sass|less)$/u.test(item.sourceSpecifier))
      .map((item) => path.posix.normalize(path.posix.join(dir, item.sourceSpecifier)));
    const styles = [...new Set([...configuredStyles, ...importedStyles].filter((candidate) => catalogPaths.has(candidate)))].sort();
    const componentName = symbol.name.replace(/^NC/u, "").toLowerCase();
    const exampleMatchers = rules.examplePatterns.map((pattern) => globRegex(pattern.replaceAll("{component}", componentName)));
    const examples = exampleDoc.examples.flatMap((example) => example.relatedFiles.filter((file) => exampleMatchers.some((matcher) => matcher.test(file))));
    const documents = documentDoc.documents.filter((doc) => doc.path === `doc/api/components/${componentName}.md`).map((doc) => doc.path);
    const reasons = [pathMatch && "configured source path", baseMatch && `extends ${bases.find((base) => rules.baseTypes.includes(base))}`, registered && "registered by configured function", publicMatch && "reachable from configured public package", styles.length && "catalog style in component directory", examples.length && "catalog example path"].filter((item): item is string => Boolean(item));
    if (!pathMatch || !baseMatch || reasons.length < 2) continue;
    const members = symbol.members.map((memberId) => symbolById.get(memberId)).filter((item): item is SymbolRecord => Boolean(item));
    const propName = symbol.name.replace(/^NC/u, "") + "Props";
    const propsModel = symbols.find((item) => item.name === propName && path.posix.dirname(item.filePath) === dir);
    const events = [...content.matchAll(/addSelfEvent\s*\(\s*["']([^"']+)["']/gu)].map((match) => match[1] ?? "").filter(Boolean);
    const slots = [...content.matchAll(/<slot(?:\s+name=["']([^"']+)["'])?/gu)].map((match) => match[1] ?? "default");
    const lifecycle = members.filter((item) => rules.lifecycleMethods?.includes(item.name)).map((item) => item.name);
    const confidence = reasons.length >= 4 ? "high" : reasons.length >= 2 ? "medium" : "low";
    components.push({
      id: id("component", symbol.id), name: symbol.name, symbolId: symbol.id, packageId: symbol.packageId,
      sourceModuleId: symbol.moduleId, filePath: symbol.filePath, lineStart: symbol.lineStart, lineEnd: symbol.lineEnd,
      detectionConfidence: confidence, detectionReasons: reasons, baseTypes: bases,
      implementedInterfaces: symbol.heritage.filter((item) => item.startsWith("implements ")),
      publicExportNames: symbol.publicExportNames, publicPackages: symbol.publicPackages,
      props: propsModel ? [propsModel.id] : [], events: [...new Set(events)].sort(), slots: [...new Set(slots)].sort(),
      methods: members.filter((item) => ["method", "getter", "setter"].includes(item.kind) && item.visibility === "public").map((item) => item.id),
      properties: members.filter((item) => item.kind === "property" && item.visibility === "public").map((item) => item.id),
      lifecycleMethods: lifecycle, styles, examples: [...new Set(examples)].sort(), documents,
      status: symbol.publicReachable ? "public" : "internal", evidence: symbol.evidence,
      limitations: propsModel ? [] : ["No explicit props model was detected."],
    });
  }
  const componentBySymbol = new Map(components.map((component) => [component.symbolId, component]));
  for (const component of components) {
    for (const style of component.styles) addRelationship("component_has_style", component.id, fileDoc.files.find((file) => file.path === style)?.id ?? style, component.evidence);
    for (const example of component.examples) addRelationship("component_demonstrated_by", component.id, exampleDoc.examples.find((item) => item.relatedFiles.includes(example))?.id ?? example, component.evidence, "medium");
    for (const document of component.documents) addRelationship("component_documented_by", component.id, documentDoc.documents.find((item) => item.path === document)?.id ?? document, component.evidence);
  }
  for (const document of documentDoc.documents) {
    const full = path.resolve(source, ...document.path.split("/"));
    const content = await readFile(full, "utf8");
    if (sha(Buffer.from(content)) !== document.sha256) throw new Error(`Catalog 文档 SHA256 不匹配：${document.path}`);
    const mentions = new Map<string, number>();
    for (const section of document.sections) {
      const headingName = section.heading.trim().match(/^[A-Za-z_$][\w$]*$/u)?.[0];
      if (headingName) mentions.set(headingName, Math.min(mentions.get(headingName) ?? section.lineStart, section.lineStart));
    }
    for (const match of content.matchAll(/`([A-Za-z_$][\w$]*)`/gu)) {
      const name = match[1];
      if (!name || match.index === undefined) continue;
      const line = content.slice(0, match.index).split(/\r?\n/u).length;
      mentions.set(name, Math.min(mentions.get(name) ?? line, line));
    }
    for (const [name, line] of mentions) {
      for (const symbol of symbolsByName.get(name) ?? []) {
        if (!symbol.publicReachable || symbol.name.length < 3) continue;
        addRelationship("document_mentions_symbol", document.id, symbol.id, [{ path: document.path, line, fileSha256: document.sha256 }], "high");
      }
    }
  }
  void componentBySymbol;
  for (const module of moduleByPath.values()) module.publicSymbolCount = symbols.filter((symbol) => symbol.moduleId === module.id && symbol.publicReachable).length;
  const modules = [...moduleByPath.values()].sort((a, b) => a.path.localeCompare(b.path));
  symbols.sort((a, b) => a.filePath.localeCompare(b.filePath) || a.lineStart - b.lineStart || a.id.localeCompare(b.id));
  imports.sort((a, b) => a.moduleId.localeCompare(b.moduleId) || a.line - b.line || a.id.localeCompare(b.id));
  exports.sort((a, b) => a.moduleId.localeCompare(b.moduleId) || a.line - b.line || a.id.localeCompare(b.id));
  components.sort((a, b) => a.filePath.localeCompare(b.filePath));
  relationships.sort((a, b) => a.id.localeCompare(b.id)); diagnostics.sort((a, b) => (a.file ?? "").localeCompare(b.file ?? "") || (a.line ?? 0) - (b.line ?? 0));
  const rootHashValue = sha(stable({
    catalogRootHash, modules: modules.map((m) => [m.id, m.fileSha256]),
    symbols: symbols.map((s) => [s.id, s.declarationSha256, s.publicReachable, s.publicPackages]),
    exports, components, version: VERSION,
  }));
  const counts = { modules: modules.length, symbols: symbols.length, imports: imports.length, exports: exports.length, components: components.length, diagnostics: diagnostics.length };
  const analysis = {
    schemaVersion: SCHEMA_VERSION, frameworkId: options.frameworkId, symbolSnapshotId: options.snapshotId ?? catalogSnapshot,
    catalogSnapshotId: catalogSnapshot, catalogRootHash, sourceCommit: catalogCommit, sourceClean: true,
    scannerVersion: VERSION, typescriptVersion: ts.version, syntaxOnly: Boolean(options.syntaxOnly),
    semanticAvailable, generatedAt: new Date().toISOString(), rootHash: `sha256:${rootHashValue}`, counts,
    files: selected.map((file) => file.path), warnings: diagnostics.filter((item) => !item.blocking).map((item) => item.id),
    blockingDiagnostics: diagnostics.filter((item) => item.blocking).map((item) => item.id),
  };
  const byKind = Object.fromEntries(KINDS.map((kind) => [kind, symbols.filter((symbol) => symbol.kind === kind).length]).filter(([, count]) => Number(count) > 0));
  const byConfidence = Object.fromEntries(["high", "medium", "low"].map((level) => [level, components.filter((component) => component.detectionConfidence === level).length]));
  const statistics = {
    schemaVersion: SCHEMA_VERSION, modules: modules.length, declarations: symbols.length, symbolsByKind: byKind,
    exportedSymbols: symbols.filter((symbol) => symbol.exported).length, publicReachableSymbols: symbols.filter((symbol) => symbol.publicReachable).length,
    internalSymbols: symbols.filter((symbol) => !symbol.publicReachable).length, imports: imports.length, exports: exports.length,
    reExports: exports.filter((item) => item.reExport).length, unresolvedImports: imports.filter((item) => item.resolutionStatus === "unresolved").length,
    packagesWithPublicApi: new Set(symbols.flatMap((symbol) => symbol.publicPackages)).size, componentsByConfidence: byConfidence,
    componentsWithStyles: components.filter((item) => item.styles.length).length, componentsWithExamples: components.filter((item) => item.examples.length).length,
    componentsWithDocuments: components.filter((item) => item.documents.length).length,
    propsCount: components.reduce((sum, item) => sum + item.props.length, 0), eventsCount: components.reduce((sum, item) => sum + item.events.length, 0),
    slotsCount: components.reduce((sum, item) => sum + item.slots.length, 0),
    diagnosticsByCategory: Object.fromEntries([...new Set(diagnostics.map((item) => item.category))].sort().map((key) => [key, diagnostics.filter((item) => item.category === key).length])),
    diagnosticsBySeverity: Object.fromEntries([...new Set(diagnostics.map((item) => item.severity))].sort().map((key) => [key, diagnostics.filter((item) => item.severity === key).length])),
    largestModules: modules.map((module) => ({ moduleId: module.id, symbols: symbols.filter((symbol) => symbol.moduleId === module.id).length })).sort((a, b) => b.symbols - a.symbols).slice(0, 20),
    mostReExportedSymbols: symbols.map((symbol) => ({ symbolId: symbol.id, chains: symbol.exportChains.length })).sort((a, b) => b.chains - a.chains).slice(0, 20),
    extractionDurationMs: Date.now() - extractionStartedAt,
  };
  return {
    snapshotId: options.snapshotId ?? catalogSnapshot, rootHash: `sha256:${rootHashValue}`,
    data: {
      analysis, modules: { schemaVersion: SCHEMA_VERSION, modules }, symbols: { schemaVersion: SCHEMA_VERSION, symbols },
      exports: { schemaVersion: SCHEMA_VERSION, imports, exports }, components: { schemaVersion: SCHEMA_VERSION, components },
      relationships: { schemaVersion: SCHEMA_VERSION, relationships }, diagnostics: { schemaVersion: SCHEMA_VERSION, diagnostics }, statistics,
    },
  };
}

const SCHEMAS: Record<keyof SymbolData, string> = {
  analysis: "typescript-analysis.schema.json", modules: "modules-catalog.schema.json", symbols: "symbols-catalog.schema.json",
  exports: "exports-catalog.schema.json", components: "components-catalog.schema.json", relationships: "symbol-relationships.schema.json",
  diagnostics: "symbol-diagnostics.schema.json", statistics: "symbol-statistics.schema.json",
};
async function validateData(root: string, data: SymbolData): Promise<void> {
  for (const [key, schema] of Object.entries(SCHEMAS) as Array<[keyof SymbolData, string]>) await validateWithSchema(root, schema, data[key]);
}
async function writeJson(file: string, value: unknown): Promise<void> { await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8"); }

export async function extractSymbols(options: ExtractOptions): Promise<ExtractResult> {
  const built = await build(options); await validateData(options.labRoot, built.data);
  const root = path.resolve(options.labRoot, "frameworks", options.frameworkId, "symbols");
  const output = path.join(root, "snapshots", built.snapshotId);
  if (options.dryRun) return { ...built, outputDir: null, existed: false };
  await mkdir(path.dirname(output), { recursive: true });
  let replace = false;
  try {
    const existing = JSON.parse(await readFile(path.join(output, "analysis.json"), "utf8")) as { rootHash?: string };
    if (existing.rootHash === built.rootHash && !options.force) return { ...built, outputDir: output, existed: true };
    if (!options.force) throw new Error(`Symbol snapshot 已存在且内容不一致：${built.snapshotId}`);
    replace = true;
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  const temp = path.join(path.dirname(output), `.${built.snapshotId}.tmp-${process.pid}-${Date.now()}`); await mkdir(temp);
  try {
    for (const name of OUTPUTS) await writeJson(path.join(temp, name), built.data[name.replace(".json", "") as keyof SymbolData]);
    const hashes = Object.fromEntries(await Promise.all(OUTPUTS.map(async (name) => [name, await fileHash(path.join(temp, name))])));
    const manifest = {
      schemaVersion: SCHEMA_VERSION, symbolSnapshotId: built.snapshotId,
      catalogSnapshotId: built.data.analysis.catalogSnapshotId, catalogRootHash: built.data.analysis.catalogRootHash,
      sourceCommit: built.data.analysis.sourceCommit, extractorVersion: VERSION, typescriptVersion: ts.version,
      files: hashes, options: { syntaxOnly: Boolean(options.syntaxOnly), includeInternal: Boolean(options.includeInternal), maxDiagnostics: options.maxDiagnostics ?? 1000 },
      createdAt: new Date().toISOString(),
    };
    await validateWithSchema(options.labRoot, "symbol-manifest.schema.json", manifest); await writeJson(path.join(temp, "manifest.json"), manifest);
    if (replace) await rm(output, { recursive: true, force: true }); await rename(temp, output);
    const current = { schemaVersion: SCHEMA_VERSION, frameworkId: options.frameworkId, snapshotId: built.snapshotId, catalogSnapshotId: built.data.analysis.catalogSnapshotId, commit: built.data.analysis.sourceCommit, rootHash: built.rootHash, updatedAt: new Date().toISOString() };
    await validateWithSchema(options.labRoot, "symbol-current.schema.json", current);
    const currentTemp = path.join(root, `.current-${process.pid}.tmp`); await writeJson(currentTemp, current);
    await rm(path.join(root, "current.json"), { force: true }); await rename(currentTemp, path.join(root, "current.json"));
    return { ...built, outputDir: output, existed: false };
  } catch (error) { await rm(temp, { recursive: true, force: true }); throw error; }
}

function machinePath(value: unknown): boolean {
  if (typeof value === "string") return /^[A-Za-z]:[\\/]/u.test(value) || /^\/(?:Users|home)\//u.test(value);
  if (Array.isArray(value)) return value.some(machinePath);
  return Boolean(value && typeof value === "object" && Object.values(value as Record<string, unknown>).some(machinePath));
}
export async function validateSymbols(labRoot: string, frameworkId: string): Promise<{ snapshots: number; errors: string[] }> {
  const root = path.resolve(labRoot, "frameworks", frameworkId, "symbols"); const current = JSON.parse(await readFile(path.join(root, "current.json"), "utf8")) as Record<string, unknown>;
  await validateWithSchema(labRoot, "symbol-current.schema.json", current);
  const entries = (await readdir(path.join(root, "snapshots"), { withFileTypes: true })).filter((entry) => entry.isDirectory() && !entry.name.startsWith("."));
  const errors: string[] = [];
  for (const entry of entries) try {
    const dir = path.join(root, "snapshots", entry.name); const data = {} as SymbolData;
    for (const name of OUTPUTS) data[name.replace(".json", "") as keyof SymbolData] = JSON.parse(await readFile(path.join(dir, name), "utf8")) as never;
    await validateData(labRoot, data);
    const manifest = JSON.parse(await readFile(path.join(dir, "manifest.json"), "utf8")) as { files: Record<string, string>; catalogSnapshotId: string; catalogRootHash: string };
    await validateWithSchema(labRoot, "symbol-manifest.schema.json", manifest);
    for (const [name, digest] of Object.entries(manifest.files)) if (await fileHash(path.join(dir, name)) !== digest) throw new Error(`${name} SHA256 mismatch`);
    const recomputed = sha(stable({
      catalogRootHash: data.analysis.catalogRootHash,
      modules: data.modules.modules.map((m) => [m.id, m.fileSha256]),
      symbols: data.symbols.symbols.map((s) => [s.id, s.declarationSha256, s.publicReachable, s.publicPackages]),
      exports: data.exports.exports, components: data.components.components, version: VERSION,
    }));
    if (`sha256:${recomputed}` !== data.analysis.rootHash) throw new Error("Symbol rootHash mismatch");
    const moduleIds = new Set(data.modules.modules.map((m) => m.id)); const symbolIds = new Set(data.symbols.symbols.map((s) => s.id));
    if (data.symbols.symbols.some((s) => !moduleIds.has(s.moduleId))) throw new Error("symbol module reference missing");
    if (data.components.components.some((c) => !symbolIds.has(c.symbolId))) throw new Error("component symbol reference missing");
    if (machinePath(data) || machinePath(manifest)) throw new Error("machine absolute path present");
    const catalog = JSON.parse(await readFile(path.resolve(labRoot, "frameworks", frameworkId, "catalog", "snapshots", manifest.catalogSnapshotId, "snapshot.json"), "utf8")) as { rootHash: string };
    if (catalog.rootHash !== manifest.catalogRootHash) throw new Error("Catalog dependency mismatch");
    if (current.snapshotId === entry.name && current.rootHash !== data.analysis.rootHash) throw new Error("current pointer mismatch");
  } catch (error) { errors.push(`${entry.name}: ${(error as Error).message}`); }
  return { snapshots: entries.length, errors };
}
export async function listSymbols(labRoot: string, frameworkId: string): Promise<Array<Record<string, unknown>>> {
  const root = path.resolve(labRoot, "frameworks", frameworkId, "symbols", "snapshots");
  const entries = (await readdir(root, { withFileTypes: true })).filter((e) => e.isDirectory() && !e.name.startsWith(".")).sort((a, b) => a.name.localeCompare(b.name));
  const validation = await validateSymbols(labRoot, frameworkId);
  return await Promise.all(entries.map(async (entry) => {
    const analysis = JSON.parse(await readFile(path.join(root, entry.name, "analysis.json"), "utf8")) as Record<string, unknown>;
    const stats = JSON.parse(await readFile(path.join(root, entry.name, "statistics.json"), "utf8")) as Record<string, unknown>;
    return { snapshotId: entry.name, commit: analysis.sourceCommit, catalogRootHash: analysis.catalogRootHash, modules: stats.modules, symbols: stats.declarations, publicSymbols: stats.publicReachableSymbols, components: Object.values(stats.componentsByConfidence as Record<string, number>).reduce((a, b) => a + b, 0), diagnostics: (analysis.counts as Record<string, number>).diagnostics, rootHash: analysis.rootHash, valid: validation.errors.every((e) => !e.startsWith(`${entry.name}:`)) };
  }));
}
export async function querySymbols(labRoot: string, frameworkId: string, options: { name?: string; kind?: string; package?: string; module?: string; exportedOnly?: boolean; publicOnly?: boolean; componentOnly?: boolean; limit?: number }): Promise<SymbolRecord[]> {
  const current = JSON.parse(await readFile(path.resolve(labRoot, "frameworks", frameworkId, "symbols", "current.json"), "utf8")) as { snapshotId: string };
  const dir = path.resolve(labRoot, "frameworks", frameworkId, "symbols", "snapshots", current.snapshotId);
  const symbols = (JSON.parse(await readFile(path.join(dir, "symbols.json"), "utf8")) as { symbols: SymbolRecord[] }).symbols;
  const components = (JSON.parse(await readFile(path.join(dir, "components.json"), "utf8")) as { components: ComponentRecord[] }).components;
  const componentIds = new Set(components.map((c) => c.symbolId)); const needle = options.name?.toLowerCase();
  return symbols.filter((s) => !needle || s.name.toLowerCase().includes(needle))
    .filter((s) => !options.kind || s.kind === options.kind)
    .filter((s) => !options.package || s.packageId === options.package || s.publicPackages.includes(options.package))
    .filter((s) => !options.module || s.filePath === options.module || s.moduleId === options.module)
    .filter((s) => !options.exportedOnly || s.exported).filter((s) => !options.publicOnly || s.publicReachable)
    .filter((s) => !options.componentOnly || componentIds.has(s.id)).slice(0, options.limit ?? 50);
}
export async function diffSymbols(labRoot: string, frameworkId: string, fromId: string, toId: string, force = false): Promise<Record<string, unknown>> {
  const root = path.resolve(labRoot, "frameworks", frameworkId, "symbols");
  const load = async (idValue: string) => {
    const dir = path.join(root, "snapshots", idValue);
    return {
      modules: (JSON.parse(await readFile(path.join(dir, "modules.json"), "utf8")) as { modules: ModuleRecord[] }).modules,
      symbols: (JSON.parse(await readFile(path.join(dir, "symbols.json"), "utf8")) as { symbols: SymbolRecord[] }).symbols,
      exports: (JSON.parse(await readFile(path.join(dir, "exports.json"), "utf8")) as { exports: ExportRecord[] }).exports,
      components: (JSON.parse(await readFile(path.join(dir, "components.json"), "utf8")) as { components: ComponentRecord[] }).components,
      relationships: (JSON.parse(await readFile(path.join(dir, "relationships.json"), "utf8")) as { relationships: Relationship[] }).relationships,
    };
  };
  const [from, to] = await Promise.all([load(fromId), load(toId)]);
  const compare = <T extends { id: string }>(a: T[], b: T[], fingerprint: (item: T) => string) => {
    const am = new Map(a.map((item) => [item.id, fingerprint(item)])); const bm = new Map(b.map((item) => [item.id, fingerprint(item)]));
    return { added: [...bm.keys()].filter((idValue) => !am.has(idValue)), removed: [...am.keys()].filter((idValue) => !bm.has(idValue)), modified: [...bm.keys()].filter((idValue) => am.has(idValue) && am.get(idValue) !== bm.get(idValue)) };
  };
  const symbolChanges = compare(from.symbols, to.symbols, (s) => stable([s.declarationSha256, s.publicReachable, s.publicExportNames]));
  const removedSymbols = from.symbols.filter((item) => symbolChanges.removed.includes(item.id));
  const addedSymbols = to.symbols.filter((item) => symbolChanges.added.includes(item.id));
  const moved = removedSymbols.flatMap((oldSymbol) => {
    const matches = addedSymbols.filter((newSymbol) => newSymbol.declarationSha256 === oldSymbol.declarationSha256);
    return matches.length === 1 && removedSymbols.filter((candidate) => candidate.declarationSha256 === oldSymbol.declarationSha256).length === 1
      ? [{ from: oldSymbol.id, to: matches[0]!.id, declarationSha256: oldSymbol.declarationSha256 }]
      : [];
  });
  const fromSymbolById = new Map(from.symbols.map((item) => [item.id, item]));
  const signatureChanged = to.symbols.filter((item) => fromSymbolById.has(item.id) && fromSymbolById.get(item.id)?.signature !== item.signature)
    .map((item) => item.id);
  const result = { schemaVersion: SCHEMA_VERSION, frameworkId, fromSnapshot: fromId, toSnapshot: toId,
    modules: compare(from.modules, to.modules, (m) => m.fileSha256),
    symbols: { ...symbolChanges, moved, signatureChanged },
    exports: compare(from.exports, to.exports, stable), components: compare(from.components, to.components, stable),
    relationships: compare(from.relationships, to.relationships, stable) };
  await validateWithSchema(labRoot, "symbol-diff.schema.json", result); const dir = path.join(root, "diffs"); await mkdir(dir, { recursive: true });
  const target = path.join(dir, `${fromId}--${toId}.json`);
  if (!force) try { await access(target); throw new Error("Symbol diff 已存在，拒绝覆盖。"); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  await writeJson(target, result); return result;
}
