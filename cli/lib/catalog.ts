import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  access,
  lstat,
  mkdir,
  readFile,
  readlink,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { loadFrameworkConfig } from "./config.js";
import { portablePath, resolveFromLab } from "./paths.js";
import { spawnCollect } from "./process.js";
import { validateWithSchema } from "./schema.js";

const VERSION = "0.1.5";
const SCHEMA_VERSION = "1.0.0";
const DEFAULT_MAX_FILE_SIZE = 2 * 1024 * 1024;
const COMMIT_PATTERN = /^[a-f0-9]{40}$/u;
const GENERATED_SEGMENTS = new Set(["node_modules", "dist", "coverage", ".cache"]);
const GENERATED_OUTPUT_SEGMENTS = new Set([...GENERATED_SEGMENTS, "build"]);
const CATALOG_FILES = [
  "repository.json", "files.json", "packages.json", "documents.json", "examples.json",
  "configs.json", "relationships.json", "statistics.json", "snapshot.json",
] as const;

export type FileCategory =
  | "source" | "documentation" | "example" | "test" | "config" | "manifest"
  | "build" | "style" | "asset" | "generated" | "other";

export interface CatalogFile {
  id: string;
  path: string;
  basename: string;
  extension: string;
  category: FileCategory;
  language: string;
  packageId: string | null;
  sizeBytes: number;
  lineCount: number | null;
  sha256: string;
  isText: boolean;
  encoding: string;
  generated: boolean;
  executable: boolean;
  symlink: boolean;
  symlinkTarget: string | null;
  gitObjectId: string | null;
  warnings: string[];
}

interface PackageRecord {
  id: string;
  name: string;
  version: string | null;
  private: boolean;
  directory: string;
  manifestPath: string;
  manifestSha256: string;
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  peerDependencies: Record<string, string>;
  optionalDependencies: Record<string, string>;
  exports: unknown;
  main: string | null;
  module: string | null;
  types: string | null;
  files: string[];
  engines: Record<string, string>;
  packageManager: string | null;
  sourceFileCount: number;
  documentCount: number;
  exampleCount: number;
  testCount: number;
}

interface DocumentRecord {
  id: string;
  path: string;
  packageId: string | null;
  title: string;
  sha256: string;
  lineCount: number;
  sections: Array<{
    id: string; heading: string; level: number; lineStart: number; lineEnd: number;
    parentSectionId: string | null; anchor: string; contentSha256: string;
  }>;
  links: Array<{
    text: string; target: string; line: number; external: boolean;
    resolvedPath: string | null; broken: boolean;
  }>;
  codeFences: Array<{ language: string | null; lineStart: number; lineEnd: number }>;
  warnings: string[];
}

interface ExampleRecord {
  id: string;
  name: string;
  rootPath: string;
  packageId: string | null;
  entryFiles: string[];
  relatedFiles: string[];
  detectedBy: string[];
  confidence: "high" | "medium";
  scripts: string[];
  referencedPackages: string[];
  sha256: string;
  warnings: string[];
}

interface ConfigRecord {
  id: string;
  path: string;
  type: string;
  packageId: string | null;
  sha256: string;
  detectedTool: string;
  references: string[];
  warnings: string[];
}

interface Relationship {
  id: string;
  type: string;
  from: string;
  to: string;
  evidencePath: string;
  confidence: "high" | "medium";
}

interface ScanOptions {
  labRoot: string;
  frameworkId: string;
  sourceDir?: string;
  snapshotId?: string;
  allowDirty?: boolean;
  dryRun?: boolean;
  force?: boolean;
  maxFileSize?: number;
  include?: string[];
  exclude?: string[];
}

interface CatalogData {
  repository: Record<string, unknown>;
  files: { schemaVersion: string; files: CatalogFile[] };
  packages: { schemaVersion: string; packages: PackageRecord[] };
  documents: { schemaVersion: string; documents: DocumentRecord[] };
  examples: { schemaVersion: string; examples: ExampleRecord[] };
  configs: { schemaVersion: string; configs: ConfigRecord[] };
  relationships: { schemaVersion: string; relationships: Relationship[] };
  statistics: Record<string, unknown>;
  snapshot: Record<string, unknown>;
}

export interface ScanResult {
  snapshotId: string;
  rootHash: string;
  outputDir: string | null;
  existed: boolean;
  data: CatalogData;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

async function hashFile(file: string): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(file);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.once("error", reject);
    stream.once("end", () => resolve(hash.digest("hex")));
  });
}

function normalizeRelative(value: string): string {
  const normalized = portablePath(value).replace(/^\.\//u, "");
  if (path.posix.isAbsolute(normalized) || /^[A-Za-z]:/u.test(normalized)
    || normalized.split("/").includes("..")) throw new Error(`不安全的仓库相对路径：${value}`);
  return normalized;
}

function slug(value: string): string {
  const result = value.toLowerCase().normalize("NFKD").replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-|-$/gu, "");
  return result || `item-${sha(value).slice(0, 12)}`;
}

function globRegex(glob: string): RegExp {
  const source = normalizeRelative(glob).replace(/[.+^${}()|[\]\\]/gu, "\\$&")
    .replaceAll("**", "\u0000").replaceAll("*", "[^/]*").replaceAll("\u0000", ".*")
    .replaceAll("?", "[^/]");
  return new RegExp(`^${source}$`, "u");
}

function matchesFilters(file: string, includes: string[], excludes: string[]): boolean {
  return (includes.length === 0 || includes.some((item) => globRegex(item).test(file)))
    && !excludes.some((item) => globRegex(item).test(file));
}

export function classifyFile(file: string): FileCategory {
  const value = normalizeRelative(file);
  const lower = value.toLowerCase();
  const base = path.posix.basename(lower);
  const segments = lower.split("/");
  const extension = path.posix.extname(lower);
  if (segments.some((segment) => GENERATED_SEGMENTS.has(segment))) return "generated";
  if (base === "package.json" || base === "pnpm-workspace.yaml" || /^(pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$/u.test(base)) return "manifest";
  if (/^(readme|changelog)(\.|$)/u.test(base) || segments.includes("docs") || segments.includes("doc") || [".md", ".mdx"].includes(extension)) return "documentation";
  if (segments.some((segment) => ["example", "examples", "demo", "demos", "playground", "stories"].includes(segment))) return "example";
  if (segments.some((segment) => ["test", "tests", "__tests__"].includes(segment)) || /\.(test|spec)\.[^.]+$/u.test(base)) return "test";
  if (segments.some((segment) => ["build", "scripts"].includes(segment)) || /^(vite|rollup|webpack|rspack|vitest|jest)\.config\./u.test(base)
    || /^esbuild\./u.test(base) || /^gulpfile\./u.test(base) || base === "makefile") return "build";
  if (/^tsconfig.*\.json$/u.test(base) || /eslint|prettier|editorconfig/u.test(base) || /^\.env\.example$/u.test(base)) return "config";
  if ([".scss", ".sass", ".css", ".less", ".styl"].includes(extension)) return "style";
  if ([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".vue", ".svelte"].includes(extension)) return "source";
  if ([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico", ".woff", ".woff2", ".ttf", ".mp3", ".mp4"].includes(extension)) return "asset";
  return "other";
}

function languageFor(file: string): string {
  const base = path.posix.basename(file).toLowerCase();
  const ext = path.posix.extname(base);
  const table: Record<string, string> = {
    ".ts": "TypeScript", ".tsx": "TypeScript", ".js": "JavaScript", ".jsx": "JavaScript",
    ".mjs": "JavaScript", ".cjs": "JavaScript", ".json": "JSON", ".yaml": "YAML", ".yml": "YAML",
    ".md": "Markdown", ".mdx": "Markdown", ".scss": "SCSS", ".sass": "SCSS", ".css": "CSS",
    ".html": "HTML", ".sh": "Shell", ".ps1": "PowerShell", ".txt": "Text",
  };
  return table[ext] ?? (base === "makefile" ? "Text" : "Unknown");
}

function decodeText(buffer: Buffer): { text: string | null; encoding: string } {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return { text: buffer.subarray(2).toString("utf16le"), encoding: "UTF-16LE" };
  }
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return { text: buffer.subarray(3).toString("utf8"), encoding: "UTF-8 BOM" };
  }
  if (buffer.includes(0)) return { text: null, encoding: "binary" };
  const text = buffer.toString("utf8");
  if (text.includes("\ufffd")) return { text: null, encoding: "unknown" };
  return { text, encoding: "UTF-8" };
}

function countLines(text: string): number {
  if (text.length === 0) return 0;
  const normalized = text.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  const matches = normalized.match(/\n/gu)?.length ?? 0;
  return matches + (normalized.endsWith("\n") ? 0 : 1);
}

async function git(source: string, args: string[]): Promise<string> {
  const result = await spawnCollect("git", ["-c", "core.quotepath=false", "-C", source, ...args], source, 30_000);
  if (result.exitCode !== 0) throw new Error(`Git 命令失败：git ${args.join(" ")}：${result.stderr.trim() || result.error}`);
  return result.stdout;
}

async function gitState(source: string): Promise<{
  commit: string; branch: string | null; detached: boolean; remote: string | null;
  trackedChanges: string[]; untracked: string[]; ignoredGeneratedDirectories: string[];
}> {
  const [commitRaw, branchRaw, statusRaw, remoteRaw] = await Promise.all([
    git(source, ["rev-parse", "HEAD"]),
    git(source, ["branch", "--show-current"]),
    git(source, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]),
    spawnCollect("git", ["-C", source, "remote", "get-url", "origin"], source),
  ]);
  const commit = commitRaw.trim();
  if (!COMMIT_PATTERN.test(commit)) throw new Error("源码目录未返回有效 Git commit。");
  const trackedChanges: string[] = [];
  const untracked: string[] = [];
  for (const entry of statusRaw.split("\0").filter(Boolean)) {
    const code = entry.slice(0, 2);
    const file = normalizeRelative(entry.slice(3));
    if (code === "??") untracked.push(file);
    else trackedChanges.push(file);
  }
  const ignoredGeneratedDirectories = [...new Set(untracked
    .filter((file) => file.split("/").some((segment) => GENERATED_OUTPUT_SEGMENTS.has(segment)))
    .map((file) => {
      const parts = file.split("/");
      const index = parts.findIndex((part) => GENERATED_OUTPUT_SEGMENTS.has(part));
      return parts.slice(0, index + 1).join("/");
    }))].sort();
  const branch = branchRaw.trim() || null;
  return {
    commit, branch, detached: branch === null,
    remote: remoteRaw.exitCode === 0 ? remoteRaw.stdout.trim() || null : null,
    trackedChanges: trackedChanges.sort(), untracked: untracked.sort(), ignoredGeneratedDirectories,
  };
}

async function trackedFiles(source: string): Promise<Map<string, string | null>> {
  const [namesRaw, stagesRaw] = await Promise.all([git(source, ["ls-files", "-z"]), git(source, ["ls-files", "-s", "-z"])]);
  const result = new Map<string, string | null>();
  for (const name of namesRaw.split("\0").filter(Boolean)) result.set(normalizeRelative(name), null);
  for (const entry of stagesRaw.split("\0").filter(Boolean)) {
    const match = /^(\d+)\s+([a-f0-9]{40,64})\s+\d+\t(.+)$/u.exec(entry);
    if (match?.[2] && match[3]) result.set(normalizeRelative(match[3]), match[2]);
  }
  return result;
}

async function readTrackedFile(source: string, file: string, max: number): Promise<{
  record: Omit<CatalogFile, "id" | "packageId">; text: string | null;
}> {
  const full = path.resolve(source, ...file.split("/"));
  const relative = path.relative(source, full);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(`文件越过源码根：${file}`);
  const info = await lstat(full);
  const warnings: string[] = [];
  const category = classifyFile(file);
  const extractionLimit = ["manifest", "config", "build"].includes(category)
    ? Math.max(max, 10 * 1024 * 1024)
    : max;
  let target: string | null = null;
  if (info.isSymbolicLink()) {
    target = portablePath(await readlink(full));
    if (symlinkTargetOutside(source, full, target)) warnings.push("symlink target is outside source root; content not followed");
  }
  const digest = info.isSymbolicLink() ? sha(Buffer.from(target ?? "")) : await hashFile(full);
  let text: string | null = null;
  let encoding = info.isSymbolicLink() ? "symlink" : "binary";
  if (!info.isSymbolicLink() && info.size <= extractionLimit) {
    try {
      const decoded = decodeText(await readFile(full));
      text = decoded.text;
      encoding = decoded.encoding;
    } catch (error) {
      warnings.push(`read failed: ${(error as Error).message}`);
      encoding = "unknown";
    }
  } else if (info.size > extractionLimit) warnings.push(`text extraction skipped: size exceeds ${extractionLimit} bytes`);
  const language = text === null && encoding !== "symlink" ? "Binary" : languageFor(file);
  return {
    record: {
      path: file, basename: path.posix.basename(file), extension: path.posix.extname(file).toLowerCase(),
      category, language, sizeBytes: info.size, lineCount: text === null ? null : countLines(text),
      sha256: digest, isText: text !== null, encoding, generated: category === "generated",
      executable: (info.mode & 0o111) !== 0, symlink: info.isSymbolicLink(), symlinkTarget: target,
      gitObjectId: null, warnings,
    },
    text,
  };
}

export function workspacePatterns(rootPackage: Record<string, unknown>, workspaceText: string | null): string[] {
  const workspaces = rootPackage.workspaces;
  if (Array.isArray(workspaces)) return workspaces.filter((item): item is string => typeof item === "string");
  if (workspaces && typeof workspaces === "object" && Array.isArray((workspaces as { packages?: unknown }).packages)) {
    return (workspaces as { packages: unknown[] }).packages.filter((item): item is string => typeof item === "string");
  }
  if (workspaceText) {
    const parsed = parseYaml(workspaceText) as { packages?: unknown };
    if (Array.isArray(parsed?.packages)) return parsed.packages.filter((item): item is string => typeof item === "string");
  }
  return [];
}

export function symlinkTargetOutside(sourceRoot: string, linkFile: string, target: string): boolean {
  const resolvedTarget = path.resolve(path.dirname(linkFile), target);
  const relative = path.relative(sourceRoot, resolvedTarget);
  return relative.startsWith("..") || path.isAbsolute(relative);
}

function manifestMatches(directory: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    const normalized = normalizeRelative(pattern).replace(/\/+$/u, "");
    return globRegex(normalized).test(directory);
  });
}

function stringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string").sort(([a], [b]) => a.localeCompare(b)));
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function packageOwner(file: string, packages: PackageRecord[]): string | null {
  const matches = packages.filter((item) => item.directory === "." || file === item.directory || file.startsWith(`${item.directory}/`))
    .sort((a, b) => b.directory.length - a.directory.length || a.id.localeCompare(b.id));
  return matches[0]?.id ?? null;
}

function anchorFor(value: string): string {
  return value.trim().toLowerCase().replace(/[^\p{Letter}\p{Number}\s-]/gu, "").replace(/\s+/gu, "-");
}

function extractDocument(file: CatalogFile, text: string, files: Set<string>): DocumentRecord {
  const lines = text.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n");
  const headings: Array<{ heading: string; level: number; line: number }> = [];
  const fences: DocumentRecord["codeFences"] = [];
  const links: DocumentRecord["links"] = [];
  let inFence = false;
  let fenceStart = 0;
  let fenceLanguage: string | null = null;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const fence = /^\s*```([\w+-]*)/u.exec(line);
    if (fence) {
      if (!inFence) { inFence = true; fenceStart = index + 1; fenceLanguage = fence[1] || null; }
      else { fences.push({ language: fenceLanguage, lineStart: fenceStart, lineEnd: index + 1 }); inFence = false; }
      continue;
    }
    if (inFence) continue;
    const heading = /^(#{1,6})\s+(.+?)\s*#*\s*$/u.exec(line);
    if (heading?.[1] && heading[2]) headings.push({ heading: heading[2], level: heading[1].length, line: index + 1 });
    for (const match of line.matchAll(/\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/gu)) {
      const target = match[2] ?? "";
      const external = /^(?:https?:|mailto:|#)/u.test(target);
      const withoutAnchor = decodeURIComponent(target.split("#")[0] ?? "");
      const resolved = external || !withoutAnchor ? null : normalizeRelative(path.posix.normalize(path.posix.join(path.posix.dirname(file.path), withoutAnchor)));
      links.push({ text: match[1] ?? "", target, line: index + 1, external, resolvedPath: resolved, broken: !external && resolved !== null && !files.has(resolved) });
    }
  }
  if (inFence) fences.push({ language: fenceLanguage, lineStart: fenceStart, lineEnd: lines.length });
  const rawSections = headings.length > 0 ? headings : [{ heading: path.posix.basename(file.path), level: 1, line: 1 }];
  const sections = rawSections.map((item, index) => {
    const next = rawSections.slice(index + 1).find((candidate) => candidate.level <= item.level);
    const lineEnd = next ? next.line - 1 : Math.max(lines.length, item.line);
    const parent = [...rawSections.slice(0, index)].reverse().find((candidate) => candidate.level < item.level);
    return {
      id: `section-${String(index + 1).padStart(4, "0")}`, heading: item.heading, level: item.level,
      lineStart: item.line, lineEnd,
      parentSectionId: parent ? `section-${String(rawSections.indexOf(parent) + 1).padStart(4, "0")}` : null,
      anchor: anchorFor(item.heading), contentSha256: sha(lines.slice(item.line - 1, lineEnd).join("\n")),
    };
  });
  return {
    id: `document-${sha(file.path).slice(0, 12)}`, path: file.path, packageId: file.packageId,
    title: headings.find((item) => item.level === 1)?.heading ?? path.posix.basename(file.path),
    sha256: file.sha256, lineCount: file.lineCount ?? 0, sections, links, codeFences: fences, warnings: [],
  };
}

function configType(file: string): { type: string; tool: string } {
  const base = path.posix.basename(file).toLowerCase();
  if (base.startsWith("tsconfig")) return { type: "TypeScript", tool: "typescript" };
  if (base.startsWith("vite.")) return { type: "Vite", tool: "vite" };
  if (base.startsWith("rollup.")) return { type: "Rollup", tool: "rollup" };
  if (base.includes("eslint")) return { type: "ESLint", tool: "eslint" };
  if (base.includes("prettier")) return { type: "Prettier", tool: "prettier" };
  if (base.startsWith("vitest.")) return { type: "Vitest", tool: "vitest" };
  if (base.startsWith("jest.")) return { type: "Jest", tool: "jest" };
  if (base === "pnpm-workspace.yaml") return { type: "workspace", tool: "pnpm" };
  if (/lock|package\.json/u.test(base)) return { type: "package_manager", tool: base.startsWith("pnpm") ? "pnpm" : "node" };
  return { type: "generic", tool: "unknown" };
}

function extractReferences(file: string, text: string | null): string[] {
  if (!text) return [];
  const references = new Set<string>();
  if (file.endsWith(".json")) {
    try {
      const value = JSON.parse(text) as Record<string, unknown>;
      for (const key of ["extends", "include", "exclude", "references"]) {
        const item = value[key];
        if (typeof item === "string") references.add(item);
        if (Array.isArray(item)) for (const child of item) {
          if (typeof child === "string") references.add(child);
          else if (child && typeof child === "object" && typeof (child as { path?: unknown }).path === "string") references.add((child as { path: string }).path);
        }
      }
    } catch { /* malformed config is represented by a warning elsewhere */ }
  }
  for (const match of text.matchAll(/(?:from|extends|include|exclude)\s*[:=(]\s*["']([^"']+)["']/gu)) if (match[1]) references.add(match[1]);
  return [...references].sort();
}

function exportTargets(value: unknown): string[] {
  const targets: string[] = [];
  const visit = (item: unknown): void => {
    if (typeof item === "string") { if (item.startsWith(".")) targets.push(item); return; }
    if (Array.isArray(item)) { item.forEach(visit); return; }
    if (item && typeof item === "object") Object.values(item as Record<string, unknown>).forEach(visit);
  };
  visit(value);
  return [...new Set(targets)].sort();
}

async function buildCatalog(options: ScanOptions): Promise<{ data: CatalogData; snapshotId: string; rootHash: string; source: string }> {
  const config = await loadFrameworkConfig(options.labRoot, options.frameworkId);
  const source = resolveFromLab(options.labRoot, options.sourceDir ?? config.framework.source_dir);
  await access(path.join(source, ".git")).catch(async () => {
    await git(source, ["rev-parse", "--is-inside-work-tree"]);
  });
  const state = await gitState(source);
  if (state.trackedChanges.length > 0 && !options.allowDirty) {
    throw new Error(`源码存在 tracked dirty，默认拒绝扫描：${state.trackedChanges.join(", ")}`);
  }
  const dirtyFingerprint = state.trackedChanges.length > 0
    ? sha(await git(source, ["diff", "--binary", "HEAD"])) : null;
  const snapshotId = options.snapshotId ?? (dirtyFingerprint ? `${state.commit}-dirty-${dirtyFingerprint.slice(0, 12)}` : state.commit);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{2,127}$/u.test(snapshotId)) throw new Error(`无效 snapshot id：${snapshotId}`);
  const tracked = await trackedFiles(source);
  const includes = options.include ?? [];
  const excludes = options.exclude ?? [];
  const selected = [...tracked.keys()].filter((file) => matchesFilters(file, includes, excludes)).sort();
  const textByPath = new Map<string, string | null>();
  const files: CatalogFile[] = [];
  const max = options.maxFileSize ?? DEFAULT_MAX_FILE_SIZE;
  for (let offset = 0; offset < selected.length; offset += 8) {
    const batch = selected.slice(offset, offset + 8);
    const results = await Promise.all(batch.map(async (file) => ({ file, value: await readTrackedFile(source, file, max) })));
    for (const { file, value } of results) {
      textByPath.set(file, value.text);
      files.push({ id: `file-${sha(file).slice(0, 16)}`, packageId: null, ...value.record, gitObjectId: tracked.get(file) ?? null });
    }
  }
  files.sort((a, b) => a.path.localeCompare(b.path));
  const rootManifestText = textByPath.get("package.json");
  if (!rootManifestText) throw new Error("Git 跟踪文件中缺少可读取的根 package.json。");
  const rootManifest = JSON.parse(rootManifestText) as Record<string, unknown>;
  const patterns = workspacePatterns(rootManifest, textByPath.get("pnpm-workspace.yaml") ?? null);
  const manifestFiles = files.filter((file) => file.basename === "package.json");
  const packageRecords: PackageRecord[] = [];
  for (const manifestFile of manifestFiles) {
    const directory = path.posix.dirname(manifestFile.path);
    if (directory !== "." && !manifestMatches(directory, patterns)) continue;
    const text = textByPath.get(manifestFile.path);
    if (!text) continue;
    const value = JSON.parse(text) as Record<string, unknown>;
    const name = typeof value.name === "string" ? value.name : directory === "." ? options.frameworkId : directory;
    packageRecords.push({
      id: directory === "." ? "root" : `package-${slug(name)}`, name, version: nullableString(value.version),
      private: value.private === true, directory, manifestPath: manifestFile.path, manifestSha256: manifestFile.sha256,
      scripts: stringRecord(value.scripts), dependencies: stringRecord(value.dependencies),
      devDependencies: stringRecord(value.devDependencies), peerDependencies: stringRecord(value.peerDependencies),
      optionalDependencies: stringRecord(value.optionalDependencies), exports: value.exports ?? null,
      main: nullableString(value.main), module: nullableString(value.module), types: nullableString(value.types),
      files: Array.isArray(value.files) ? value.files.filter((item): item is string => typeof item === "string") : [],
      engines: stringRecord(value.engines), packageManager: nullableString(value.packageManager),
      sourceFileCount: 0, documentCount: 0, exampleCount: 0, testCount: 0,
    });
  }
  const duplicateNames = packageRecords.filter((item, index) => packageRecords.findIndex((other) => other.name === item.name) !== index);
  if (duplicateNames.length) throw new Error(`重复 workspace package name：${duplicateNames.map((item) => item.name).join(", ")}`);
  packageRecords.sort((a, b) => a.directory.localeCompare(b.directory));
  for (const file of files) file.packageId = packageOwner(file.path, packageRecords);
  for (const pkg of packageRecords) {
    const owned = files.filter((file) => file.packageId === pkg.id);
    pkg.sourceFileCount = owned.filter((file) => file.category === "source").length;
    pkg.documentCount = owned.filter((file) => file.category === "documentation").length;
    pkg.exampleCount = owned.filter((file) => file.category === "example").length;
    pkg.testCount = owned.filter((file) => file.category === "test").length;
  }
  const pathSet = new Set(files.map((file) => file.path));
  const documents = files.filter((file) => file.category === "documentation" && file.isText)
    .map((file) => extractDocument(file, textByPath.get(file.path) ?? "", pathSet));
  const configFiles = files.filter((file) =>
    ["config", "build", "manifest"].includes(file.category) || configType(file.path).type !== "generic");
  const configs = configFiles.map((file): ConfigRecord => {
    const detected = configType(file.path);
    return {
      id: `config-${sha(file.path).slice(0, 12)}`, path: file.path, type: detected.type,
      packageId: file.packageId, sha256: file.sha256, detectedTool: detected.tool,
      references: extractReferences(file.path, textByPath.get(file.path) ?? null), warnings: [],
    };
  });
  const marker = /^(example|examples|demo|demos|playground|stories)$/u;
  const exampleRoots = new Set<string>();
  for (const file of files) {
    const parts = file.path.split("/");
    const index = parts.findIndex((part) => marker.test(part.toLowerCase()));
    if (index >= 0) exampleRoots.add(parts.slice(0, index + 1).join("/"));
  }
  const workspaceNames = new Set(packageRecords.map((pkg) => pkg.name));
  const examples = [...exampleRoots].sort().map((root): ExampleRecord => {
    const related = files.filter((file) => file.path.startsWith(`${root}/`)).map((file) => file.path);
    const entries = related.filter((file) => {
      const relative = file.slice(root.length + 1);
      return /^(?:index\.html|(?:src|index)\/(?:main|index)\.(?:ts|tsx|js|jsx)|[^/]+\/index\.html)$/u.test(relative);
    }).sort();
    const owner = packageOwner(`${root}/`, packageRecords);
    const pkg = packageRecords.find((item) => item.id === owner);
    const scripts = packageRecords.flatMap((item) => Object.entries(item.scripts)
      .filter(([key, command]) => /(?:example|demo|dev|playground|story)/iu.test(`${key} ${command}`) && command.includes(pkg?.name ?? path.posix.basename(root)))
      .map(([key]) => `${item.id}:${key}`)).sort();
    const referenced = new Set<string>();
    for (const file of related) {
      const text = textByPath.get(file);
      if (!text) continue;
      for (const name of workspaceNames) if (name !== pkg?.name && text.includes(name)) referenced.add(name);
    }
    const detectedBy = [`path:${root}`, ...entries.map((file) => `entry:${file}`), ...scripts.map((item) => `script:${item}`)];
    return {
      id: `example-${sha(root).slice(0, 12)}`, name: path.posix.basename(root), rootPath: root,
      packageId: owner, entryFiles: entries, relatedFiles: related, detectedBy,
      confidence: entries.length > 0 && scripts.length > 0 ? "high" : "medium", scripts,
      referencedPackages: [...referenced].sort(),
      sha256: sha(related.map((file) => `${file}:${files.find((item) => item.path === file)?.sha256 ?? ""}`).join("\n")),
      warnings: entries.length === 0 ? ["no conventional entry file detected"] : [],
    };
  });
  const relationships: Relationship[] = [];
  const addRelation = (type: string, from: string, to: string, evidencePath: string, confidence: "high" | "medium" = "high"): void => {
    relationships.push({ id: `relation-${sha(`${type}\0${from}\0${to}\0${evidencePath}`).slice(0, 16)}`, type, from, to, evidencePath, confidence });
  };
  for (const pkg of packageRecords) {
    for (const file of files.filter((item) => item.packageId === pkg.id)) addRelation("package_contains_file", pkg.id, file.id, pkg.manifestPath);
    for (const section of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"] as const) {
      for (const name of Object.keys(pkg[section])) {
        const target = packageRecords.find((item) => item.name === name);
        if (target) addRelation("workspace_dependency", pkg.id, target.id, pkg.manifestPath);
      }
    }
    const targets = [...exportTargets(pkg.exports), ...[pkg.main, pkg.module, pkg.types].filter((item): item is string => item !== null)];
    for (const target of [...new Set(targets)]) {
      const resolved = normalizeRelative(path.posix.normalize(path.posix.join(pkg.directory, target)));
      const sourceFile = files.find((item) => item.path === resolved || item.path === resolved.replace(/^\.\//u, ""));
      if (sourceFile) addRelation("package_export_target", pkg.id, sourceFile.id, pkg.manifestPath);
    }
  }
  for (const doc of documents) if (doc.packageId) addRelation("document_belongs_to_package", doc.id, doc.packageId, doc.path);
  for (const example of examples) if (example.packageId) addRelation("example_belongs_to_package", example.id, example.packageId, example.rootPath, "medium");
  for (const cfg of configs) if (cfg.packageId) addRelation("config_belongs_to_package", cfg.id, cfg.packageId, cfg.path);
  relationships.sort((a, b) => a.id.localeCompare(b.id));
  const rootHash = sha(files.map((file) => `${file.path}\0${file.sha256}\0${file.category}\0${file.packageId ?? ""}`).join("\n"));
  const warnings = files.flatMap((file) => file.warnings.map((warning) => `${file.path}: ${warning}`));
  if (state.untracked.length) warnings.push(`${state.untracked.length} untracked files/directories were excluded`);
  const repository = {
    schemaVersion: SCHEMA_VERSION, frameworkId: options.frameworkId, repositoryUrl: state.remote,
    sourceCommit: state.commit, branch: state.branch, detached: state.detached,
    clean: state.trackedChanges.length === 0, trackedChangedFiles: state.trackedChanges,
    untrackedFileCount: state.untracked.length, ignoredGeneratedDirectories: state.ignoredGeneratedDirectories,
    packageManager: { name: config.package_manager.name, version: config.package_manager.version },
    lockfiles: files.filter((file) => /(?:^|\/)(?:pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$/u.test(file.path)).map((file) => file.path),
    workspaceType: textByPath.has("pnpm-workspace.yaml") ? "pnpm" : patterns.length ? "npm-yarn" : "single-package",
    sourceRootRelative: portablePath(path.relative(options.labRoot, source)), scannedAt: new Date().toISOString(), scannerVersion: VERSION,
  };
  const by = <T extends string>(values: T[]): Record<string, number> => Object.fromEntries([...new Set(values)].sort().map((key) => [key, values.filter((item) => item === key).length]));
  const largest = [...files].sort((a, b) => b.sizeBytes - a.sizeBytes || a.path.localeCompare(b.path)).slice(0, 20).map((file) => ({ path: file.path, sizeBytes: file.sizeBytes }));
  const statistics = {
    schemaVersion: SCHEMA_VERSION, totalFiles: files.length, textFiles: files.filter((file) => file.isText).length,
    binaryFiles: files.filter((file) => !file.isText).length, totalBytes: files.reduce((sum, file) => sum + file.sizeBytes, 0),
    totalTextLines: files.reduce((sum, file) => sum + (file.lineCount ?? 0), 0),
    countsByCategory: by(files.map((file) => file.category)), countsByLanguage: by(files.map((file) => file.language)),
    countsByPackage: by(files.map((file) => file.packageId ?? "unassigned")), documentCount: documents.length,
    documentSectionCount: documents.reduce((sum, doc) => sum + doc.sections.length, 0), exampleCount: examples.length,
    configCount: configs.length, testCount: files.filter((file) => file.category === "test").length,
    largestFiles: largest, filesSkippedBySize: files.filter((file) => file.warnings.some((warning) => warning.includes("size exceeds"))).length,
    warningsCount: warnings.length,
  };
  const counts = { files: files.length, packages: packageRecords.length, documents: documents.length, examples: examples.length, configs: configs.length, relationships: relationships.length };
  const snapshot = {
    schemaVersion: SCHEMA_VERSION, frameworkId: options.frameworkId, snapshotId, sourceCommit: state.commit,
    dirty: state.trackedChanges.length > 0, dirtyFingerprint, generatedAt: new Date().toISOString(),
    scannerVersion: VERSION, rootHash: `sha256:${rootHash}`, counts, files: files.map((file) => file.path),
    catalogFiles: [...CATALOG_FILES], warnings,
    exclusions: { trackedOnly: true, untrackedExcluded: state.untracked.length, include: includes, exclude: excludes, maxFileSize: max },
    previousSnapshotId: null,
  };
  return {
    source, snapshotId, rootHash: `sha256:${rootHash}`,
    data: {
      repository,
      files: { schemaVersion: SCHEMA_VERSION, files },
      packages: { schemaVersion: SCHEMA_VERSION, packages: packageRecords },
      documents: { schemaVersion: SCHEMA_VERSION, documents },
      examples: { schemaVersion: SCHEMA_VERSION, examples },
      configs: { schemaVersion: SCHEMA_VERSION, configs },
      relationships: { schemaVersion: SCHEMA_VERSION, relationships },
      statistics, snapshot,
    },
  };
}

const SCHEMAS: Record<keyof CatalogData, string> = {
  repository: "repository-catalog.schema.json", files: "source-files.schema.json",
  packages: "packages-catalog.schema.json", documents: "documents-catalog.schema.json",
  examples: "examples-catalog.schema.json", configs: "configs-catalog.schema.json",
  relationships: "relationships-catalog.schema.json", statistics: "catalog-statistics.schema.json",
  snapshot: "catalog-snapshot.schema.json",
};

async function validateData(labRoot: string, data: CatalogData): Promise<void> {
  for (const [key, schema] of Object.entries(SCHEMAS) as Array<[keyof CatalogData, string]>) {
    await validateWithSchema(labRoot, schema, data[key]);
  }
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function scanCatalog(options: ScanOptions): Promise<ScanResult> {
  const built = await buildCatalog(options);
  await validateData(options.labRoot, built.data);
  const catalogRoot = path.resolve(options.labRoot, "frameworks", options.frameworkId, "catalog");
  const snapshots = path.join(catalogRoot, "snapshots");
  const output = path.join(snapshots, built.snapshotId);
  if (options.dryRun) return { ...built, outputDir: null, existed: false };
  await mkdir(snapshots, { recursive: true });
  let replaceExisting = false;
  try {
    const existing = JSON.parse(await readFile(path.join(output, "snapshot.json"), "utf8")) as { rootHash?: string };
    if (existing.rootHash === built.rootHash && !options.force) return { ...built, outputDir: output, existed: true };
    if (!options.force) throw new Error(`snapshot 已存在且内容不一致，拒绝覆盖：${built.snapshotId}`);
    const relative = path.relative(catalogRoot, output);
    if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("拒绝删除 catalog 根目录外路径。");
    replaceExisting = true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const temp = path.join(snapshots, `.${built.snapshotId}.tmp-${process.pid}-${Date.now()}`);
  await mkdir(temp);
  try {
    for (const name of CATALOG_FILES) {
      const key = name.replace(".json", "") as keyof CatalogData;
      await writeJson(path.join(temp, name), built.data[key]);
    }
    const hashes = Object.fromEntries(await Promise.all(CATALOG_FILES.map(async (name) => [name, await hashFile(path.join(temp, name))])));
    const manifest = {
      schemaVersion: SCHEMA_VERSION, catalogFiles: hashes, sourceRootHash: built.rootHash,
      scannerVersion: VERSION, schemaVersions: Object.fromEntries(Object.keys(SCHEMAS).map((key) => [key, SCHEMA_VERSION])),
      sourceCommit: built.data.snapshot.sourceCommit, scanOptions: built.data.snapshot.exclusions,
      exclusionRules: ["git tracked files only", "untracked and ignored files excluded"],
      warningCount: (built.data.snapshot.warnings as unknown[]).length, createdAt: new Date().toISOString(),
    };
    await validateWithSchema(options.labRoot, "catalog-manifest.schema.json", manifest);
    await writeJson(path.join(temp, "manifest.json"), manifest);
    if (replaceExisting) await rm(output, { recursive: true, force: true });
    await rename(temp, output);
    const current = {
      schemaVersion: SCHEMA_VERSION, frameworkId: options.frameworkId, snapshotId: built.snapshotId,
      commit: built.data.snapshot.sourceCommit, rootHash: built.rootHash, updatedAt: new Date().toISOString(),
    };
    await validateWithSchema(options.labRoot, "catalog-current.schema.json", current);
    const currentTemp = path.join(catalogRoot, `.current-${process.pid}.tmp`);
    await writeJson(currentTemp, current);
    await rename(currentTemp, path.join(catalogRoot, "current.json")).catch(async (error: NodeJS.ErrnoException) => {
      if (error.code !== "EEXIST" && error.code !== "EPERM") throw error;
      await rm(path.join(catalogRoot, "current.json"), { force: true });
      await rename(currentTemp, path.join(catalogRoot, "current.json"));
    });
    return { ...built, outputDir: output, existed: false };
  } catch (error) {
    await rm(temp, { recursive: true, force: true });
    throw error;
  }
}

function hasAbsoluteMachinePath(value: unknown): boolean {
  if (typeof value === "string") return /^[A-Za-z]:[\\/]/u.test(value) || /^\/(?:Users|home)\//u.test(value) || value.includes("\\");
  if (Array.isArray(value)) return value.some(hasAbsoluteMachinePath);
  return Boolean(value && typeof value === "object" && Object.values(value as Record<string, unknown>).some(hasAbsoluteMachinePath));
}

export async function validateCatalog(labRoot: string, frameworkId: string): Promise<{ snapshots: number; errors: string[] }> {
  const catalogRoot = path.resolve(labRoot, "frameworks", frameworkId, "catalog");
  const current = JSON.parse(await readFile(path.join(catalogRoot, "current.json"), "utf8")) as { snapshotId: string; commit: string; rootHash: string };
  await validateWithSchema(labRoot, "catalog-current.schema.json", current);
  const snapshotRoot = path.join(catalogRoot, "snapshots");
  const entries = await import("node:fs/promises").then((fs) => fs.readdir(snapshotRoot, { withFileTypes: true }));
  const errors: string[] = [];
  for (const entry of entries.filter((item) => item.isDirectory() && !item.name.startsWith("."))) {
    const dir = path.join(snapshotRoot, entry.name);
    try {
      const data = {} as CatalogData;
      for (const name of CATALOG_FILES) {
        const key = name.replace(".json", "") as keyof CatalogData;
        data[key] = JSON.parse(await readFile(path.join(dir, name), "utf8")) as never;
      }
      await validateData(labRoot, data);
      const manifest = JSON.parse(await readFile(path.join(dir, "manifest.json"), "utf8")) as { catalogFiles: Record<string, string>; sourceCommit: string; sourceRootHash: string };
      await validateWithSchema(labRoot, "catalog-manifest.schema.json", manifest);
      for (const [name, expected] of Object.entries(manifest.catalogFiles)) {
        if (await hashFile(path.join(dir, name)) !== expected) throw new Error(`${name} SHA256 不匹配`);
      }
      const files = data.files.files;
      if (new Set(files.map((file) => file.path)).size !== files.length) throw new Error("文件路径不唯一");
      if (new Set(data.packages.packages.map((pkg) => pkg.id)).size !== data.packages.packages.length) throw new Error("package id 不唯一");
      const recomputed = `sha256:${sha(files.slice().sort((a, b) => a.path.localeCompare(b.path)).map((file) => `${file.path}\0${file.sha256}\0${file.category}\0${file.packageId ?? ""}`).join("\n"))}`;
      if (recomputed !== data.snapshot.rootHash || recomputed !== manifest.sourceRootHash) throw new Error("rootHash 无法重新计算");
      if (data.snapshot.sourceCommit !== data.repository.sourceCommit || manifest.sourceCommit !== data.repository.sourceCommit) throw new Error("snapshot commit 不一致");
      if (hasAbsoluteMachinePath(data) || hasAbsoluteMachinePath(manifest)) throw new Error("catalog 包含机器绝对路径或反斜杠");
      const fileIds = new Set(files.map((file) => file.id));
      const packageIds = new Set(data.packages.packages.map((pkg) => pkg.id));
      const documentIds = new Set(data.documents.documents.map((doc) => doc.id));
      const exampleIds = new Set(data.examples.examples.map((example) => example.id));
      const configIds = new Set(data.configs.configs.map((cfg) => cfg.id));
      for (const doc of data.documents.documents) for (const section of doc.sections) if (section.lineStart < 1 || section.lineEnd < section.lineStart || section.lineEnd > doc.lineCount + 1) throw new Error(`文档章节行号非法：${doc.path}`);
      for (const relation of data.relationships.relationships) {
        const known = (id: string) => fileIds.has(id) || packageIds.has(id) || documentIds.has(id) || exampleIds.has(id) || configIds.has(id);
        if (!known(relation.from) || !known(relation.to)) throw new Error(`关系引用不存在：${relation.id}`);
      }
      if (entry.name === current.snapshotId && (current.commit !== data.snapshot.sourceCommit || current.rootHash !== data.snapshot.rootHash)) throw new Error("current.json 与 snapshot 不一致");
    } catch (error) {
      errors.push(`${entry.name}: ${(error as Error).message}`);
    }
  }
  if (!entries.some((entry) => entry.isDirectory() && entry.name === current.snapshotId)) errors.push("current.json 指向不存在的 snapshot");
  return { snapshots: entries.filter((item) => item.isDirectory() && !item.name.startsWith(".")).length, errors };
}

export async function listCatalog(labRoot: string, frameworkId: string): Promise<Array<Record<string, unknown>>> {
  const root = path.resolve(labRoot, "frameworks", frameworkId, "catalog", "snapshots");
  const entries = await import("node:fs/promises").then((fs) => fs.readdir(root, { withFileTypes: true }));
  const validation = await validateCatalog(labRoot, frameworkId);
  return await Promise.all(entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith(".")).sort((a, b) => a.name.localeCompare(b.name)).map(async (entry) => {
    const snapshot = JSON.parse(await readFile(path.join(root, entry.name, "snapshot.json"), "utf8")) as Record<string, unknown>;
    return { snapshotId: entry.name, commit: snapshot.sourceCommit, dirty: snapshot.dirty, scannedAt: snapshot.generatedAt, ...(snapshot.counts as object), rootHash: snapshot.rootHash, valid: validation.errors.every((error) => !error.startsWith(`${entry.name}:`)) };
  }));
}

interface DiffItem { path: string; from?: string; to?: string }

export async function diffCatalog(labRoot: string, frameworkId: string, fromId: string, toId: string, force = false): Promise<Record<string, unknown>> {
  const catalogRoot = path.resolve(labRoot, "frameworks", frameworkId, "catalog");
  const load = async (id: string) => {
    const root = path.join(catalogRoot, "snapshots", id);
    return {
      snapshot: JSON.parse(await readFile(path.join(root, "snapshot.json"), "utf8")) as Record<string, unknown>,
      files: (JSON.parse(await readFile(path.join(root, "files.json"), "utf8")) as { files: CatalogFile[] }).files,
      packages: (JSON.parse(await readFile(path.join(root, "packages.json"), "utf8")) as { packages: PackageRecord[] }).packages,
      documents: (JSON.parse(await readFile(path.join(root, "documents.json"), "utf8")) as { documents: DocumentRecord[] }).documents,
      examples: (JSON.parse(await readFile(path.join(root, "examples.json"), "utf8")) as { examples: ExampleRecord[] }).examples,
      configs: (JSON.parse(await readFile(path.join(root, "configs.json"), "utf8")) as { configs: ConfigRecord[] }).configs,
    };
  };
  const [from, to] = await Promise.all([load(fromId), load(toId)]);
  const oldMap = new Map(from.files.map((file) => [file.path, file]));
  const newMap = new Map(to.files.map((file) => [file.path, file]));
  const added = to.files.filter((file) => !oldMap.has(file.path));
  const removed = from.files.filter((file) => !newMap.has(file.path));
  const modified: DiffItem[] = [];
  const reclassified: DiffItem[] = [];
  for (const file of to.files) {
    const old = oldMap.get(file.path);
    if (!old) continue;
    if (old.sha256 !== file.sha256) modified.push({ path: file.path, from: old.sha256, to: file.sha256 });
    if (old.category !== file.category || old.packageId !== file.packageId) reclassified.push({ path: file.path, from: `${old.category}:${old.packageId ?? ""}`, to: `${file.category}:${file.packageId ?? ""}` });
  }
  const renamed: Array<{ from: string; to: string; sha256: string }> = [];
  for (const old of removed) {
    const candidates = added.filter((item) => item.sha256 === old.sha256);
    const reverse = from.files.filter((item) => !newMap.has(item.path) && item.sha256 === old.sha256);
    if (candidates.length === 1 && reverse.length === 1) renamed.push({ from: old.path, to: candidates[0]?.path ?? "", sha256: old.sha256 });
  }
  const changedIds = <T extends { id: string }>(a: T[], b: T[], hashOf: (item: T) => string) => {
    const am = new Map(a.map((item) => [item.id, hashOf(item)]));
    const bm = new Map(b.map((item) => [item.id, hashOf(item)]));
    return {
      added: [...bm.keys()].filter((id) => !am.has(id)), removed: [...am.keys()].filter((id) => !bm.has(id)),
      modified: [...bm.keys()].filter((id) => am.has(id) && am.get(id) !== bm.get(id)),
    };
  };
  const packages = changedIds(from.packages, to.packages, stableJson);
  const documents = changedIds(from.documents, to.documents, (item) => item.sha256);
  const examples = changedIds(from.examples, to.examples, (item) => item.sha256);
  const configs = changedIds(from.configs, to.configs, (item) => item.sha256);
  const result = {
    schemaVersion: SCHEMA_VERSION, frameworkId, fromSnapshot: fromId, toSnapshot: toId,
    fromCommit: from.snapshot.sourceCommit, toCommit: to.snapshot.sourceCommit,
    rootHashChanged: from.snapshot.rootHash !== to.snapshot.rootHash,
    added: added.map((file) => file.path), removed: removed.map((file) => file.path), modified, renamed,
    reclassified, packageAdded: packages.added, packageRemoved: packages.removed, packageModified: packages.modified,
    documentsChanged: documents, examplesChanged: examples, configsChanged: configs,
  };
  await validateWithSchema(labRoot, "catalog-diff.schema.json", result);
  const diffRoot = path.join(catalogRoot, "diffs");
  await mkdir(diffRoot, { recursive: true });
  const base = `${fromId}--${toId}`;
  const jsonPath = path.join(diffRoot, `${base}.json`);
  const mdPath = path.join(diffRoot, `${base}.md`);
  if (!force) {
    try { await access(jsonPath); throw new Error(`catalog diff 已存在，拒绝覆盖：${base}`); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }
  await writeJson(jsonPath, result);
  const affected = [...new Set([...modified.map((item) => item.path), ...added.map((item) => item.path), ...removed.map((item) => item.path)])].sort();
  const markdown = `# Catalog Diff: ${fromId} → ${toId}\n\n`
    + `- From commit: \`${String(from.snapshot.sourceCommit)}\`\n- To commit: \`${String(to.snapshot.sourceCommit)}\`\n`
    + `- Root hash changed: ${String(result.rootHashChanged)}\n\n`
    + `| Change | Count |\n|---|---:|\n| Added | ${added.length} |\n| Removed | ${removed.length} |\n| Modified | ${modified.length} |\n| Exact-hash renames | ${renamed.length} |\n| Reclassified | ${reclassified.length} |\n\n`
    + `## 可能需要重新采集知识的范围\n\n${affected.length ? affected.map((file) => `- \`${file}\` 已变化；后续对应类别知识需要重新采集。`).join("\n") : "- 无文件内容变化。"}\n`;
  await writeFile(mdPath, markdown, "utf8");
  return result;
}

export { stableJson };
