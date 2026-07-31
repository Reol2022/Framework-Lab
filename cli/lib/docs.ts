import { createHash } from "node:crypto";
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { parse } from "yaml";
import { loadFrameworkConfig } from "./config.js";
import { validateWithSchema } from "./schema.js";
import type { DocsMode, DocsSourceConfig } from "./types.js";

const VERSION = "1.0.0";
const REQUIRED_SECTIONS = ["attributes", "events", "methods", "slots", "examples"] as const;
type QualityStatus = "complete" | "partial" | "empty" | "failed";
type SourceKind =
  | "official-doc"
  | "type-definition"
  | "source-code"
  | "official-example"
  | "test"
  | "runtime-record";
type KnowledgeStatus = "verified" | "documented" | "inferred" | "conflict" | "missing" | "unverified";

export interface DocSourceRef {
  sourceId: string;
  sourceType: SourceKind;
  path: string | null;
  url: string | null;
  lineStart: number | null;
  lineEnd: number | null;
  sha256: string;
  commit: string | null;
}

interface DocField {
  name: string;
  description: string | null;
  sourceRef: DocSourceRef;
}

export interface DocAttribute extends DocField {
  type: string | null;
  required: boolean | null;
  defaultValue: string | null;
}

export interface DocEvent extends DocField {
  payloadType: string | null;
}

export interface DocMethod extends DocField {
  signature: string | null;
}

export interface DocSlot extends DocField {
  scope: string | null;
}

export interface DocExample {
  title: string | null;
  description: string | null;
  code: string;
  language: string | null;
  sourceRef: DocSourceRef;
}

export interface DocQuality {
  attributeCount: number;
  eventCount: number;
  methodCount: number;
  slotCount: number;
  exampleCount: number;
  codeBlockCount: number;
  missingSections: string[];
  parseWarnings: string[];
  qualityStatus: QualityStatus;
}

export interface DocComponent {
  name: string;
  description: string | null;
  attributes: DocAttribute[];
  events: DocEvent[];
  methods: DocMethod[];
  slots: DocSlot[];
  examples: DocExample[];
  sourceRefs: DocSourceRef[];
  quality: DocQuality;
}

export interface DocPage {
  schemaVersion: typeof VERSION;
  id: string;
  sourceId: string;
  url: string;
  title: string | null;
  capturedAt: string;
  contentHash: string;
  sections: Array<{ level: number; title: string; line: number }>;
  codeBlocks: Array<{ language: string | null; code: string; lineStart: number; lineEnd: number }>;
  links: Array<{ text: string; href: string }>;
  quality: DocQuality;
  components: DocComponent[];
}

export interface DocsCaptureRequest {
  source: DocsSourceConfig;
  entryPage: string;
  labRoot: string;
  frameworkId: string;
  sourceCommit: string | null;
}

export interface DocsCapture {
  url: string;
  sourceId: string;
  status: number | null;
  requestedMode: DocsMode;
  captureMode: "http" | "browser" | "file";
  capturedAt: string;
  title: string | null;
  contentType: string | null;
  body: string;
  warnings: string[];
}

export interface DocsProvider {
  readonly mode: "http" | "browser" | "file";
  capture(request: DocsCaptureRequest): Promise<DocsCapture>;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
type BrowserRenderer = (url: string) => Promise<{ html: string; status?: number; title?: string }>;

const sha = (value: string | Buffer): string =>
  createHash("sha256").update(value).digest("hex");
const hash = (value: string | Buffer): string => `sha256:${sha(value)}`;
const json = async <T>(file: string): Promise<T> =>
  JSON.parse(await readFile(file, "utf8")) as T;
const portable = (value: string): string => value.replaceAll("\\", "/");
const now = (): string => new Date().toISOString();
const stable = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
};
const stripTags = (value: string): string =>
  value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
const safeMessage = (value: unknown): string =>
  (value instanceof Error ? value.message : String(value))
    .replace(/[A-Za-z]:\\[^\r\n'"]+/g, "<local-path>")
    .replace(/\/(?:Users|home)\/[^\r\n'"]+/g, "<local-path>");
const htmlTitle = (html: string): string | null => {
  const match = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return match ? stripTags(match[1] ?? "") || null : null;
};
const entryUrl = (baseUrl: string, entryPage: string): string =>
  `${baseUrl.replace(/\/+$/, "")}/${entryPage.replace(/^\/+/, "")}`;

export class HttpDocsProvider implements DocsProvider {
  readonly mode = "http" as const;
  constructor(private readonly fetcher: FetchLike = fetch) {}

  async capture(request: DocsCaptureRequest): Promise<DocsCapture> {
    const base = request.source.baseUrl;
    if (!base) throw new Error(`文档源 ${request.source.id} 缺少 baseUrl。`);
    const url = entryUrl(base, request.entryPage);
    const capturedAt = now();
    try {
      const response = await this.fetcher(url, {
        headers: { "user-agent": "Framework-Lab-Docs/1.0" },
        redirect: "follow",
        signal: AbortSignal.timeout(15_000),
      });
      const body = await response.text();
      return {
        url,
        sourceId: request.source.id,
        status: response.status,
        requestedMode: request.source.mode,
        captureMode: "http",
        capturedAt,
        title: htmlTitle(body),
        contentType: response.headers.get("content-type"),
        body,
        warnings: response.ok ? [] : [`HTTP ${response.status}`],
      };
    } catch (error) {
      return {
        url,
        sourceId: request.source.id,
        status: null,
        requestedMode: request.source.mode,
        captureMode: "http",
        capturedAt,
        title: null,
        contentType: null,
        body: "",
        warnings: [`HTTP 采集失败：${safeMessage(error)}`],
      };
    }
  }
}

export class FileDocsProvider implements DocsProvider {
  readonly mode = "file" as const;

  async capture(request: DocsCaptureRequest): Promise<DocsCapture> {
    const base = request.source.basePath;
    if (!base) throw new Error(`文档源 ${request.source.id} 缺少 basePath。`);
    const root = path.resolve(request.labRoot, base);
    const file = path.resolve(root, request.entryPage);
    const relative = path.relative(root, file);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error(`文档入口越过 basePath：${request.entryPage}`);
    }
    const body = await readFile(file, "utf8");
    const markdown = /\.md$/i.test(file);
    return {
      url: `file:${portable(path.relative(request.labRoot, file))}`,
      sourceId: request.source.id,
      status: 200,
      requestedMode: request.source.mode,
      captureMode: "file",
      capturedAt: now(),
      title: markdown ? markdownTitle(body) : htmlTitle(body),
      contentType: markdown ? "text/markdown" : "text/html",
      body,
      warnings: [],
    };
  }
}

export class BrowserDocsProvider implements DocsProvider {
  readonly mode = "browser" as const;
  constructor(private readonly renderer: BrowserRenderer | null | undefined = undefined) {}

  async capture(request: DocsCaptureRequest): Promise<DocsCapture> {
    const base = request.source.baseUrl;
    if (!base) throw new Error(`文档源 ${request.source.id} 缺少 baseUrl。`);
    const url = entryUrl(base, request.entryPage);
    if (this.renderer === null) {
      return {
        url,
        sourceId: request.source.id,
        status: null,
        requestedMode: request.source.mode,
        captureMode: "browser",
        capturedAt: now(),
        title: null,
        contentType: "text/html",
        body: "",
        warnings: ["浏览器渲染适配器不可用。"],
      };
    }
    try {
      const rendered = await (this.renderer ?? renderWithInstalledBrowser)(url);
      return {
        url,
        sourceId: request.source.id,
        status: rendered.status ?? null,
        requestedMode: request.source.mode,
        captureMode: "browser",
        capturedAt: now(),
        title: rendered.title ?? htmlTitle(rendered.html),
        contentType: "text/html",
        body: rendered.html,
        warnings: [],
      };
    } catch (error) {
      return {
        url,
        sourceId: request.source.id,
        status: null,
        requestedMode: request.source.mode,
        captureMode: "browser",
        capturedAt: now(),
        title: null,
        contentType: "text/html",
        body: "",
        warnings: [`浏览器采集失败：${safeMessage(error)}`],
      };
    }
  }
}

async function installedBrowser(): Promise<string> {
  const configured = process.env.FRAMEWORK_LAB_BROWSER;
  const candidates = [
    configured,
    process.platform === "win32" ? path.join(process.env.ProgramFiles ?? "", "Google", "Chrome", "Application", "chrome.exe") : undefined,
    process.platform === "win32" ? path.join(process.env["ProgramFiles(x86)"] ?? "", "Microsoft", "Edge", "Application", "msedge.exe") : undefined,
    process.platform === "win32" ? path.join(process.env.ProgramFiles ?? "", "Microsoft", "Edge", "Application", "msedge.exe") : undefined,
  ].filter((item): item is string => Boolean(item));
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Continue to the next explicitly bounded candidate.
    }
  }
  throw new Error("未找到浏览器可执行文件；可设置 FRAMEWORK_LAB_BROWSER。");
}

async function renderWithInstalledBrowser(url: string): Promise<{ html: string; status?: number; title?: string }> {
  const executable = await installedBrowser();
  const profile = await mkdtemp(path.join(os.tmpdir(), "framework-lab-browser-"));
  try {
    return await new Promise<{ html: string }>((resolve, reject) => {
      const child = spawn(executable, [
        "--headless=new",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        `--user-data-dir=${profile}`,
        "--virtual-time-budget=8000",
        "--dump-dom",
        url,
      ], { shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error("浏览器渲染超过 20 秒。"));
      }, 20_000);
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => { stdout += chunk; });
      child.stderr.on("data", (chunk: string) => { stderr += chunk; });
      child.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        if (code === 0 && stdout.trim()) resolve({ html: stdout });
        else reject(new Error(`浏览器退出码 ${code ?? "null"}：${stderr.trim().slice(0, 500)}`));
      });
    });
  } finally {
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => undefined);
  }
}

const sourceRef = (
  capture: DocsCapture,
  sourceType: SourceKind,
  commit: string | null,
  lineStart: number | null = null,
  lineEnd: number | null = null,
): DocSourceRef => ({
  sourceId: capture.sourceId,
  sourceType,
  path: capture.url.startsWith("file:") ? capture.url.slice(5) : null,
  url: capture.url.startsWith("file:") ? null : capture.url,
  lineStart,
  lineEnd,
  sha256: hash(capture.body),
  commit,
});

function markdownTitle(markdown: string): string | null {
  const match = /^#\s+(.+)$/m.exec(markdown);
  return match?.[1]?.trim() ?? null;
}

function markdownSections(markdown: string): DocPage["sections"] {
  return markdown.split(/\r?\n/).flatMap((line, index) => {
    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    return match
      ? [{ level: match[1]?.length ?? 1, title: match[2]?.trim() ?? "", line: index + 1 }]
      : [];
  });
}

function markdownCodeBlocks(markdown: string): DocPage["codeBlocks"] {
  const lines = markdown.split(/\r?\n/);
  const blocks: DocPage["codeBlocks"] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const start = /^```(.*)$/.exec(lines[index] ?? "");
    if (!start) continue;
    const content: string[] = [];
    const lineStart = index + 1;
    index += 1;
    while (index < lines.length && !/^```/.test(lines[index] ?? "")) {
      content.push(lines[index] ?? "");
      index += 1;
    }
    blocks.push({
      language: start[1]?.trim() || null,
      code: content.join("\n"),
      lineStart,
      lineEnd: Math.min(index + 1, lines.length),
    });
  }
  return blocks;
}

function htmlSections(html: string): DocPage["sections"] {
  const result: DocPage["sections"] = [];
  const expression = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = expression.exec(html))) {
    result.push({
      level: Number(match[1]),
      title: stripTags(match[2] ?? ""),
      line: html.slice(0, match.index).split(/\r?\n/).length,
    });
  }
  return result;
}

function htmlCodeBlocks(html: string): DocPage["codeBlocks"] {
  const result: DocPage["codeBlocks"] = [];
  const expression = /<(?:pre|code)\b([^>]*)>([\s\S]*?)<\/(?:pre|code)>/gi;
  let match: RegExpExecArray | null;
  while ((match = expression.exec(html))) {
    const language = /(?:language-|lang-)([\w-]+)/i.exec(match[1] ?? "")?.[1] ?? null;
    const lineStart = html.slice(0, match.index).split(/\r?\n/).length;
    const code = stripTags(match[2] ?? "");
    if (code) result.push({ language, code, lineStart, lineEnd: lineStart + code.split("\n").length - 1 });
  }
  return result;
}

function htmlLinks(html: string): DocPage["links"] {
  const result: DocPage["links"] = [];
  const expression = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = expression.exec(html))) {
    result.push({ href: match[1] ?? "", text: stripTags(match[2] ?? "") });
  }
  return result;
}

function markdownLinks(markdown: string): DocPage["links"] {
  const result: DocPage["links"] = [];
  const expression = /\[([^\]]+)]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = expression.exec(markdown))) result.push({ text: match[1] ?? "", href: match[2] ?? "" });
  return result;
}

interface ParsedTable {
  heading: string;
  headers: string[];
  rows: string[][];
  lineStart: number;
}

function normalizeHeading(value: string): string {
  const lower = value.toLowerCase().replace(/^[#\s]+/, "");
  if (/^(?:属性|attributes?|props?)(?:\b|（|\(|$)/.test(lower)) return "attributes";
  if (/^(?:事件|events?)(?:\b|（|\(|$)/.test(lower)) return "events";
  if (/方法|method|public/.test(lower)) return "methods";
  if (/^(?:插槽|slots?)(?:\b|（|\(|$)/.test(lower)) return "slots";
  if (/^(?:示例|examples?|usage)(?:\b|（|\(|$)/.test(lower)) return "examples";
  return lower;
}

function markdownTables(markdown: string): ParsedTable[] {
  const lines = markdown.split(/\r?\n/);
  const result: ParsedTable[] = [];
  let heading = "";
  for (let index = 0; index < lines.length; index += 1) {
    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(lines[index] ?? "");
    if (headingMatch) heading = headingMatch[2]?.trim() ?? "";
    if (!/^\s*\|/.test(lines[index] ?? "") || !/^\s*\|?(?:\s*:?-+:?\s*\|)+/.test(lines[index + 1] ?? "")) continue;
    const split = (line: string): string[] =>
      line.trim().replace(/^\||\|$/g, "").replaceAll("\\|", "\u0000").split("|")
        .map((cell) => cell.replaceAll("\u0000", "|").trim().replace(/^`|`$/g, ""));
    const headers = split(lines[index] ?? "");
    const rows: string[][] = [];
    index += 2;
    while (index < lines.length && /^\s*\|/.test(lines[index] ?? "")) {
      rows.push(split(lines[index] ?? ""));
      index += 1;
    }
    result.push({ heading, headers, rows, lineStart: index - rows.length });
    index -= 1;
  }
  return result;
}

function htmlTables(html: string, sections: DocPage["sections"]): ParsedTable[] {
  const result: ParsedTable[] = [];
  const expression = /<table\b[^>]*>([\s\S]*?)<\/table>/gi;
  let match: RegExpExecArray | null;
  while ((match = expression.exec(html))) {
    const before = html.slice(0, match.index);
    const heading = [...sections].reverse().find((section) => section.line <= before.split(/\r?\n/).length)?.title ?? "";
    const rows = [...(match[1] ?? "").matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) =>
      [...(row[1] ?? "").matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((cell) => stripTags(cell[1] ?? "")),
    );
    if (rows.length > 1) result.push({ heading, headers: rows[0] ?? [], rows: rows.slice(1), lineStart: before.split(/\r?\n/).length });
  }
  return result;
}

const cell = (headers: string[], row: string[], names: RegExp, fallback: number): string | null => {
  const index = headers.findIndex((header) => names.test(header.toLowerCase()));
  const value = row[index >= 0 ? index : fallback]?.trim();
  return value && !/^(?:-|—|无|none)$/i.test(value) ? value : null;
};

function componentName(title: string | null, body: string): string {
  const tag = /`?(nc-[a-z0-9-]+)`?/i.exec(body)?.[1];
  if (title) {
    const clean = title.replace(/[（(].*$/, "").replace(/^#+\s*/, "").trim();
    if (clean) return clean;
  }
  return tag ?? "unresolved";
}

function buildComponent(
  capture: DocsCapture,
  commit: string | null,
  sections: DocPage["sections"],
  blocks: DocPage["codeBlocks"],
  tables: ParsedTable[],
): DocComponent {
  const ref = sourceRef(capture, "official-doc", commit);
  const attributes: DocAttribute[] = [];
  const events: DocEvent[] = [];
  const methods: DocMethod[] = [];
  const slots: DocSlot[] = [];
  for (const table of tables) {
    const kind = normalizeHeading(table.heading);
    for (const [offset, row] of table.rows.entries()) {
      const name = cell(table.headers, row, /^(?:属性名|事件名|方法名|插槽名|name|attribute|event|method|slot)/i, 0);
      if (!name) continue;
      const itemRef = { ...ref, lineStart: table.lineStart + offset + 2, lineEnd: table.lineStart + offset + 2 };
      const description = cell(table.headers, row, /说明|描述|description/i, row.length - 1);
      if (kind === "attributes") {
        const requiredRaw = cell(table.headers, row, /必填|required/i, -1);
        attributes.push({
          name,
          type: cell(table.headers, row, /类型|type/i, 1),
          required: requiredRaw === null ? null : /^(?:是|true|yes|required)$/i.test(requiredRaw),
          defaultValue: cell(table.headers, row, /默认|default/i, 2),
          description,
          sourceRef: itemRef,
        });
      } else if (kind === "events") {
        events.push({ name, payloadType: cell(table.headers, row, /参数|payload|detail|type/i, 1), description, sourceRef: itemRef });
      } else if (kind === "methods") {
        methods.push({ name, signature: cell(table.headers, row, /签名|signature|参数/i, 1), description, sourceRef: itemRef });
      } else if (kind === "slots") {
        slots.push({ name, scope: cell(table.headers, row, /作用域|scope|参数/i, 1), description, sourceRef: itemRef });
      }
    }
  }
  for (const attribute of [...attributes]) {
    if (canonical(attribute.type) === "slot" || /\bslot\b/i.test(attribute.name)) {
      slots.push({
        name: attribute.name.replace(/\s*slot\s*/i, "") || "default",
        scope: null,
        description: attribute.description,
        sourceRef: attribute.sourceRef,
      });
      attributes.splice(attributes.indexOf(attribute), 1);
    }
  }
  let parentKind = "";
  for (const section of sections) {
    if (section.level <= 2) {
      parentKind = normalizeHeading(section.title);
      continue;
    }
    if (parentKind === "methods") {
      const name = section.title.replaceAll("`", "").trim();
      if (name && !methods.some((method) => method.name === name)) {
        methods.push({
          name,
          signature: null,
          description: null,
          sourceRef: { ...ref, lineStart: section.line, lineEnd: section.line },
        });
      }
    }
  }
  const examples = blocks.map((block): DocExample => ({
    title: null,
    description: null,
    code: block.code,
    language: block.language,
    sourceRef: { ...ref, lineStart: block.lineStart, lineEnd: block.lineEnd },
  }));
  const present = new Set(sections.map((section) => normalizeHeading(section.title)));
  const missingSections = REQUIRED_SECTIONS.filter((section) => !present.has(section));
  const count = attributes.length + events.length + methods.length + slots.length + examples.length;
  const plain = capture.contentType?.includes("markdown") ? capture.body.replace(/[#|`]/g, " ").trim() : stripTags(capture.body);
  const shellOnly = /<div\b[^>]*id=["']app["'][^>]*>\s*<\/div>/i.test(capture.body) && plain.length < 200;
  let qualityStatus: QualityStatus = "partial";
  const warnings = [...capture.warnings];
  if (!capture.body || capture.status === null || (capture.status !== null && capture.status >= 400)) qualityStatus = "failed";
  else if (!plain || shellOnly || count === 0) {
    qualityStatus = "empty";
    warnings.push(shellOnly ? "页面只有应用壳，缺少渲染后的正文。" : "未提取到属性、事件、方法、插槽或示例。");
  } else if (missingSections.length === 0) qualityStatus = "complete";
  return {
    name: componentName(capture.title, capture.body),
    description: sections.length > 1 ? null : plain.slice(0, 240) || null,
    attributes,
    events,
    methods,
    slots,
    examples,
    sourceRefs: [ref],
    quality: {
      attributeCount: attributes.length,
      eventCount: events.length,
      methodCount: methods.length,
      slotCount: slots.length,
      exampleCount: examples.length,
      codeBlockCount: blocks.length,
      missingSections,
      parseWarnings: warnings,
      qualityStatus,
    },
  };
}

export function parseCapture(capture: DocsCapture, commit: string | null): DocPage {
  const markdown = capture.contentType?.includes("markdown") ?? false;
  const sections = markdown ? markdownSections(capture.body) : htmlSections(capture.body);
  const codeBlocks = markdown ? markdownCodeBlocks(capture.body) : htmlCodeBlocks(capture.body);
  const links = markdown ? markdownLinks(capture.body) : htmlLinks(capture.body);
  const tables = markdown ? markdownTables(capture.body) : htmlTables(capture.body, sections);
  const component = buildComponent(capture, commit, sections, codeBlocks, tables);
  const business = {
    sourceId: capture.sourceId,
    url: capture.url,
    contentHash: hash(capture.body),
    sections,
    codeBlocks,
    links,
    component,
  };
  return {
    schemaVersion: VERSION,
    id: `doc-${sha(stable(business)).slice(0, 16)}`,
    sourceId: capture.sourceId,
    url: capture.url,
    title: capture.title,
    capturedAt: capture.capturedAt,
    contentHash: hash(capture.body),
    sections,
    codeBlocks,
    links,
    quality: component.quality,
    components: [component],
  };
}

function docsRoot(labRoot: string, frameworkId: string): string {
  return path.join(labRoot, "frameworks", frameworkId, "docs");
}

async function currentCommit(labRoot: string, frameworkId: string): Promise<string | null> {
  try {
    return (await json<{ commit: string }>(path.join(labRoot, "frameworks", frameworkId, "catalog", "current.json"))).commit;
  } catch {
    return null;
  }
}

async function configuredSources(
  labRoot: string,
  frameworkId: string,
  embedded: DocsSourceConfig[] | undefined,
): Promise<DocsSourceConfig[]> {
  if (embedded?.length) return embedded;
  const file = path.join(labRoot, "frameworks", frameworkId, "docs.yaml");
  try {
    const value = parse(await readFile(file, "utf8")) as { sources?: DocsSourceConfig[] };
    await validateWithSchema(labRoot, "docs-config.schema.json", value);
    return value.sources ?? [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function captureForMode(
  request: DocsCaptureRequest,
  providers: { http: DocsProvider; browser: DocsProvider; file: DocsProvider },
): Promise<{ capture: DocsCapture; attempts: DocsCapture[] }> {
  if (request.source.mode !== "auto") {
    const capture = await providers[request.source.mode].capture(request);
    return { capture, attempts: [capture] };
  }
  const first = await providers.http.capture(request);
  const parsed = parseCapture(first, request.sourceCommit);
  if (parsed.quality.qualityStatus === "complete" || parsed.quality.qualityStatus === "partial") {
    return { capture: first, attempts: [first] };
  }
  const rendered = await providers.browser.capture(request);
  if (parseCapture(rendered, request.sourceCommit).quality.qualityStatus === "complete" ||
      parseCapture(rendered, request.sourceCommit).quality.qualityStatus === "partial") {
    return { capture: rendered, attempts: [first, rendered] };
  }
  rendered.warnings.push(`HTTP 质量为 ${parsed.quality.qualityStatus}，浏览器回退未获得有效正文。`);
  return { capture: rendered, attempts: [first, rendered] };
}

export interface CollectDocsOptions {
  labRoot: string;
  frameworkId: string;
  sourceId?: string;
  browserRenderer?: BrowserRenderer;
  fetcher?: FetchLike;
}

export async function collectDocs(options: CollectDocsOptions): Promise<{ collectionId: string; pages: DocPage[] }> {
  const config = await loadFrameworkConfig(options.labRoot, options.frameworkId);
  const allSources = await configuredSources(options.labRoot, options.frameworkId, config.docs?.sources);
  const sources = options.sourceId ? allSources.filter((source) => source.id === options.sourceId) : allSources;
  if (!sources.length) throw new Error(options.sourceId ? `未知文档源：${options.sourceId}` : `框架 ${options.frameworkId} 未配置文档源。`);
  const commit = await currentCommit(options.labRoot, options.frameworkId);
  const providers = {
    http: new HttpDocsProvider(options.fetcher),
    browser: new BrowserDocsProvider(options.browserRenderer),
    file: new FileDocsProvider(),
  };
  const collectionId = `docs-${new Date().toISOString().replace(/[-:.TZ]/g, "")}-${sha(sources.map((source) => source.id).join("\n")).slice(0, 8)}`;
  const root = docsRoot(options.labRoot, options.frameworkId);
  const snapshotDir = path.join(root, "snapshots", collectionId);
  const parsedDir = path.join(root, "parsed", collectionId);
  await Promise.all([
    mkdir(path.dirname(snapshotDir), { recursive: true }),
    mkdir(path.dirname(parsedDir), { recursive: true }),
  ]);
  await Promise.all([mkdir(snapshotDir, { recursive: false }), mkdir(parsedDir, { recursive: false })]);
  const pages: DocPage[] = [];
  const records: unknown[] = [];
  for (const source of sources) {
    for (const entryPage of source.entryPages) {
      const request = { source, entryPage, labRoot: options.labRoot, frameworkId: options.frameworkId, sourceCommit: commit };
      const { capture, attempts } = await captureForMode(request, providers);
      const page = parseCapture(capture, commit);
      const slug = `${source.id}-${sha(entryPage).slice(0, 12)}`;
      const rawName = capture.contentType?.includes("markdown") ? "raw.md" : "raw.html";
      const entryDir = path.join(snapshotDir, slug);
      await mkdir(entryDir, { recursive: false });
      await writeFile(path.join(entryDir, rawName), capture.body, { encoding: "utf8", flag: "wx" });
      const record = {
        schemaVersion: VERSION,
        collectionId,
        frameworkId: options.frameworkId,
        frameworkCommit: commit,
        sourceId: source.id,
        sourceType: source.sourceType ?? "official-doc",
        url: capture.url,
        httpStatus: attempts.find((attempt) => attempt.captureMode === "http")?.status ?? capture.status,
        requestedMode: source.mode,
        captureMode: capture.captureMode,
        capturedAt: capture.capturedAt,
        title: capture.title,
        rawHtmlHash: hash(attempts[0]?.body ?? ""),
        renderedHtmlHash: attempts.length > 1 ? hash(attempts.at(-1)?.body ?? "") : null,
        contentHash: hash(capture.body),
        bodyTextHash: hash(stripTags(capture.body)),
        headings: page.sections,
        codeBlocks: page.codeBlocks.map((block) => ({ language: block.language, lineStart: block.lineStart, lineEnd: block.lineEnd, sha256: hash(block.code) })),
        links: page.links,
        rawSnapshotPath: portable(path.relative(root, path.join(entryDir, rawName))),
        quality: page.quality,
        attempts: attempts.map((attempt) => ({
          mode: attempt.captureMode,
          status: attempt.status,
          contentHash: hash(attempt.body),
          warnings: attempt.warnings,
        })),
      };
      await Promise.all([
        validateWithSchema(options.labRoot, "doc-snapshot.schema.json", record),
        validateWithSchema(options.labRoot, "doc-page.schema.json", page),
      ]);
      await Promise.all([
        writeFile(path.join(entryDir, "snapshot.json"), `${JSON.stringify(record, null, 2)}\n`, { encoding: "utf8", flag: "wx" }),
        writeFile(path.join(parsedDir, `${slug}.json`), `${JSON.stringify(page, null, 2)}\n`, { encoding: "utf8", flag: "wx" }),
      ]);
      records.push(record);
      pages.push(page);
    }
  }
  const manifest = {
    schemaVersion: VERSION,
    collectionId,
    frameworkId: options.frameworkId,
    frameworkCommit: commit,
    generatedAt: now(),
    pages: pages.map((page) => ({ id: page.id, sourceId: page.sourceId, contentHash: page.contentHash, qualityStatus: page.quality.qualityStatus })),
    rootHash: hash(stable(pages.map((page) => ({ sourceId: page.sourceId, url: page.url, contentHash: page.contentHash })))),
  };
  const parsedCurrent = {
    schemaVersion: VERSION,
    collectionId,
    frameworkId: options.frameworkId,
    frameworkCommit: commit,
    pages,
    rootHash: manifest.rootHash,
  };
  await validateWithSchema(options.labRoot, "docs-collection.schema.json", manifest);
  await validateWithSchema(options.labRoot, "parsed-docs.schema.json", parsedCurrent);
  const currentPointer = { schemaVersion: VERSION, frameworkId: options.frameworkId, collectionId, frameworkCommit: commit, rootHash: manifest.rootHash, updatedAt: now() };
  await validateWithSchema(options.labRoot, "docs-current.schema.json", currentPointer);
  await Promise.all([
    writeFile(path.join(parsedDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
    writeFile(path.join(root, "parsed-current.json"), `${JSON.stringify(parsedCurrent, null, 2)}\n`, "utf8"),
    writeFile(path.join(root, "current.json"), `${JSON.stringify(currentPointer, null, 2)}\n`, "utf8"),
  ]);
  return { collectionId, pages };
}

export async function parseDocs(
  labRoot: string,
  frameworkId: string,
  collectionId?: string,
): Promise<{ collectionId: string; pages: DocPage[] }> {
  const current = collectionId
    ? { collectionId }
    : await json<{ collectionId: string }>(path.join(docsRoot(labRoot, frameworkId), "current.json"));
  const directory = path.join(docsRoot(labRoot, frameworkId), "parsed", current.collectionId);
  let pages: DocPage[];
  try {
    const files = (await readdir(directory)).filter((file) => file.endsWith(".json") && file !== "manifest.json").sort();
    pages = await Promise.all(files.map((file) => json<DocPage>(path.join(directory, file))));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const fallback = await json<{ collectionId: string; pages: DocPage[] }>(path.join(docsRoot(labRoot, frameworkId), "parsed-current.json"));
    if (fallback.collectionId !== current.collectionId) throw new Error(`本地没有文档集合：${current.collectionId}`);
    pages = fallback.pages;
  }
  for (const page of pages) await validateWithSchema(labRoot, "doc-page.schema.json", page);
  return { collectionId: current.collectionId, pages };
}

export async function inspectDocs(
  labRoot: string,
  frameworkId: string,
  component: string,
): Promise<DocComponent[]> {
  const parsed = await parseDocs(labRoot, frameworkId);
  const needle = component.toLowerCase().replace(/^nc/, "");
  return parsed.pages
    .flatMap((page) => page.components)
    .filter((item) => item.name.toLowerCase().replace(/^nc/, "").includes(needle));
}

export async function diffDocs(
  labRoot: string,
  frameworkId: string,
  fromId: string,
  toId: string,
): Promise<object> {
  const [from, to] = await Promise.all([parseDocs(labRoot, frameworkId, fromId), parseDocs(labRoot, frameworkId, toId)]);
  const key = (page: DocPage): string => `${page.sourceId}\0${page.url}`;
  const oldMap = new Map(from.pages.map((page) => [key(page), page]));
  const newMap = new Map(to.pages.map((page) => [key(page), page]));
  const added = [...newMap].filter(([id]) => !oldMap.has(id)).map(([, page]) => page.url);
  const removed = [...oldMap].filter(([id]) => !newMap.has(id)).map(([, page]) => page.url);
  const modified = [...newMap].flatMap(([id, page]) => {
    const old = oldMap.get(id);
    return old && old.contentHash !== page.contentHash
      ? [{ url: page.url, from: old.contentHash, to: page.contentHash }]
      : [];
  });
  const result = {
    schemaVersion: VERSION,
    frameworkId,
    fromCollectionId: fromId,
    toCollectionId: toId,
    added,
    removed,
    modified,
    rootHash: hash(stable({ added, removed, modified })),
  };
  await validateWithSchema(labRoot, "docs-diff.schema.json", result);
  const output = path.join(docsRoot(labRoot, frameworkId), "diffs");
  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, `${fromId}--${toId}.json`), `${JSON.stringify(result, null, 2)}\n`, "utf8");
  return result;
}

export interface KnowledgeSourceValue {
  kind: SourceKind;
  name: string;
  type: string | null;
  defaultValue: string | null;
  commit: string | null;
  evidenceRef: DocSourceRef;
}

export interface ReconciledItem {
  value: { name: string; type: string | null; defaultValue: string | null };
  sources: SourceKind[];
  evidenceRefs: DocSourceRef[];
  status: KnowledgeStatus;
  confidence: "high" | "medium" | "low";
  lastVerifiedAt: string | null;
}

interface KnowledgeConflict {
  id: string;
  component: string;
  itemKind: string;
  itemName: string;
  sourceA: SourceKind;
  sourceB: SourceKind;
  evidence: DocSourceRef[];
  severity: "error" | "warning";
  suggestedAction: string;
  conflictType: string;
}

function canonical(value: string | null): string | null {
  return value?.replace(/\s+/g, "").toLowerCase() ?? null;
}

export function reconcileItems(
  component: string,
  itemKind: string,
  values: KnowledgeSourceValue[],
  targetCommit: string | null,
): { items: ReconciledItem[]; conflicts: KnowledgeConflict[] } {
  const grouped = new Map<string, KnowledgeSourceValue[]>();
  const itemKey = (name: string): string => {
    const normalized = name.toLowerCase().replace(/[-_\s]/g, "");
    return itemKind === "event" ? normalized.replace(/^nc/, "") : normalized;
  };
  for (const value of values) {
    const key = itemKey(value.name);
    grouped.set(key, [...(grouped.get(key) ?? []), value]);
  }
  const items: ReconciledItem[] = [];
  const conflicts: KnowledgeConflict[] = [];
  for (const [, group] of [...grouped].sort(([a], [b]) => a.localeCompare(b))) {
    const name = group[0]?.name ?? "unresolved";
    const kinds = [...new Set(group.map((item) => item.kind))];
    const types = new Set(kinds.flatMap((kind) => {
      const valuesForKind = group.filter((item) => item.kind === kind).map((item) => canonical(item.type)).filter(Boolean);
      return valuesForKind.slice(0, 1);
    }));
    const defaults = new Set(kinds.flatMap((kind) => {
      const valuesForKind = group.filter((item) => item.kind === kind).map((item) => canonical(item.defaultValue)).filter(Boolean);
      return valuesForKind.slice(0, 1);
    }));
    const commits = new Set(group.map((item) => item.commit).filter(Boolean));
    const sourceKinds = kinds;
    const hasConflict = types.size > 1 || defaults.size > 1 || Boolean(targetCommit && [...commits].some((commit) => commit !== targetCommit));
    const addConflict = (type: string, a: KnowledgeSourceValue, b: KnowledgeSourceValue, severity: "error" | "warning"): void => {
      conflicts.push({
        id: `conflict-${sha(`${component}\0${itemKind}\0${name}\0${type}`).slice(0, 16)}`,
        component,
        itemKind,
        itemName: name,
        sourceA: a.kind,
        sourceB: b.kind,
        evidence: [a.evidenceRef, b.evidenceRef],
        severity,
        suggestedAction: "人工核对所列证据；本报告不自动选择冲突值。",
        conflictType: type,
      });
    };
    if (types.size > 1 && group[0] && group[1]) addConflict("type-mismatch", group[0], group[1], "error");
    if (defaults.size > 1 && group[0] && group[1]) addConflict("default-mismatch", group[0], group[1], "warning");
    if (targetCommit && [...commits].some((commit) => commit !== targetCommit) && group[0]) {
      addConflict("commit-mismatch", group[0], group.find((item) => item.commit === targetCommit) ?? group[0], "error");
    }
    let status: KnowledgeStatus;
    if (hasConflict) status = "conflict";
    else if (sourceKinds.length >= 2 || sourceKinds.includes("runtime-record")) status = "verified";
    else if (sourceKinds[0] === "official-doc") status = "documented";
    else if (sourceKinds[0] === "source-code" || sourceKinds[0] === "type-definition") status = "inferred";
    else status = "unverified";
    items.push({
      value: { name, type: group[0]?.type ?? null, defaultValue: group[0]?.defaultValue ?? null },
      sources: sourceKinds,
      evidenceRefs: group.map((item) => item.evidenceRef),
      status,
      confidence: status === "verified" ? "high" : status === "conflict" ? "low" : "medium",
      lastVerifiedAt: null,
    });
  }
  return { items, conflicts };
}

interface SymbolComponent {
  name: string;
  filePath: string;
  events: string[];
  slots: string[];
  methods: string[];
  props: string[];
  properties: string[];
  lifecycleMethods: string[];
  examples: string[];
  publicPackages: string[];
  evidence: Array<{ path: string; line: number; fileSha256: string }>;
}

interface SymbolApiItem {
  id: string;
  name: string;
  kind: string;
  signature: string;
  declaredType: string | null;
  visibility: string;
  members: string[];
  evidence: Array<{ path: string; line: number; fileSha256: string }>;
}

function docValues(component: DocComponent, kind: "attributes" | "events" | "methods" | "slots"): KnowledgeSourceValue[] {
  return component[kind].map((item) => ({
    kind: "official-doc",
    name: item.name,
    type: "type" in item ? item.type : "payloadType" in item ? item.payloadType : "signature" in item ? item.signature : item.scope,
    defaultValue: "defaultValue" in item ? item.defaultValue : null,
    commit: item.sourceRef.commit,
    evidenceRef: item.sourceRef,
  }));
}

async function sourceApiValues(
  sourceDir: string,
  symbol: SymbolComponent,
  commit: string,
  symbolItems: Map<string, SymbolApiItem>,
): Promise<{ attributes: KnowledgeSourceValue[]; events: KnowledgeSourceValue[]; methods: KnowledgeSourceValue[]; slots: KnowledgeSourceValue[]; examples: DocExample[] }> {
  const attributes: KnowledgeSourceValue[] = [];
  const events: KnowledgeSourceValue[] = [];
  const methods: KnowledgeSourceValue[] = [];
  const slots: KnowledgeSourceValue[] = [];
  const apiRef = (item: SymbolApiItem, kind: SourceKind): DocSourceRef => ({
    sourceId: `symbol:${item.id}`,
    sourceType: kind,
    path: item.evidence[0]?.path ?? symbol.filePath,
    url: null,
    lineStart: item.evidence[0]?.line ?? 1,
    lineEnd: item.evidence[0]?.line ?? 1,
    sha256: item.evidence[0] ? `sha256:${item.evidence[0].fileSha256}` : hash(item.signature),
    commit,
  });
  const propIds = symbol.props.flatMap((id) => {
    const item = symbolItems.get(id);
    return item?.members.length ? item.members : [id];
  });
  for (const id of [...new Set([...propIds, ...symbol.properties])]) {
    const item = symbolItems.get(id);
    if (!item || ["private", "protected"].includes(item.visibility)) continue;
    attributes.push({
      kind: item.evidence[0]?.path.endsWith("types.ts") ? "type-definition" : "source-code",
      name: item.name,
      type: item.declaredType ?? item.signature,
      defaultValue: null,
      commit,
      evidenceRef: apiRef(item, item.evidence[0]?.path.endsWith("types.ts") ? "type-definition" : "source-code"),
    });
  }
  for (const id of symbol.methods) {
    const item = symbolItems.get(id);
    if (!item || ["private", "protected"].includes(item.visibility) || symbol.lifecycleMethods.includes(item.name)) continue;
    if (["template", "observedAttributes"].includes(item.name) || attributes.some((attribute) => attribute.name === item.name)) continue;
    methods.push({
      kind: "source-code",
      name: item.name,
      type: item.signature,
      defaultValue: null,
      commit,
      evidenceRef: apiRef(item, "source-code"),
    });
  }
  const baseRef = symbol.evidence[0];
  const symbolRef = (kind: SourceKind): DocSourceRef => ({
    sourceId: `symbol:${symbol.name}`,
    sourceType: kind,
    path: baseRef?.path ?? symbol.filePath,
    url: null,
    lineStart: baseRef?.line ?? 1,
    lineEnd: baseRef?.line ?? 1,
    sha256: baseRef ? `sha256:${baseRef.fileSha256}` : hash(symbol.filePath),
    commit,
  });
  for (const event of symbol.events) events.push({ kind: "source-code", name: event, type: null, defaultValue: null, commit, evidenceRef: symbolRef("source-code") });
  for (const slot of symbol.slots) slots.push({ kind: "source-code", name: slot, type: null, defaultValue: null, commit, evidenceRef: symbolRef("source-code") });
  const examples: DocExample[] = [];
  for (const examplePath of symbol.examples.slice(0, 1)) {
    const content = await readFile(path.join(sourceDir, ...examplePath.split("/")), "utf8");
    examples.push({
      title: path.posix.basename(examplePath),
      description: "固定源码 commit 中登记的官方示例入口。",
      code: content.split(/\r?\n/).slice(0, 80).join("\n"),
      language: "typescript",
      sourceRef: {
        sourceId: `official-example:${examplePath}`,
        sourceType: "official-example",
        path: examplePath,
        url: null,
        lineStart: 1,
        lineEnd: Math.min(80, content.split(/\r?\n/).length),
        sha256: hash(content),
        commit,
      },
    });
  }
  return { attributes, events, methods, slots, examples };
}

export interface ReconcileOptions {
  labRoot: string;
  frameworkId: string;
  component?: string;
}

export async function reconcileKnowledge(options: ReconcileOptions): Promise<{ components: unknown[]; conflicts: KnowledgeConflict[]; coverage: object }> {
  const parsed = await parseDocs(options.labRoot, options.frameworkId);
  const current = await json<{ snapshotId: string; commit: string }>(path.join(options.labRoot, "frameworks", options.frameworkId, "symbols", "current.json"));
  const symbols = await json<{ components: SymbolComponent[] }>(path.join(options.labRoot, "frameworks", options.frameworkId, "symbols", "snapshots", current.snapshotId, "components.json"));
  const symbolData = await json<{ symbols: SymbolApiItem[] }>(path.join(options.labRoot, "frameworks", options.frameworkId, "symbols", "snapshots", current.snapshotId, "symbols.json"));
  const symbolItems = new Map(symbolData.symbols.map((item) => [item.id, item]));
  const config = await loadFrameworkConfig(options.labRoot, options.frameworkId);
  const sourceDir = path.resolve(options.labRoot, config.framework.source_dir);
  const docComponents = parsed.pages.flatMap((page) => page.components);
  const target = options.component?.toLowerCase().replace(/^nc/, "");
  const selectedSymbols = symbols.components.filter((symbol) => {
    const normalized = symbol.name.toLowerCase().replace(/^nc/, "");
    if (target) return normalized.includes(target);
    return docComponents.some((item) => {
      const name = item.name.toLowerCase().replace(/^nc-?/, "").replace(/\s+/g, "");
      return name === normalized;
    });
  });
  if (!selectedSymbols.length) throw new Error(`未找到组件：${options.component ?? "(all)"}`);
  const components: unknown[] = [];
  const conflicts: KnowledgeConflict[] = [];
  for (const symbol of selectedSymbols) {
    const normalized = symbol.name.toLowerCase().replace(/^nc/, "");
    const doc = docComponents.find((item) => {
      const name = item.name.toLowerCase().replace(/^nc-?/, "").replace(/\s+/g, "");
      return name.includes(normalized) || normalized.includes(name);
    });
    const source = await sourceApiValues(sourceDir, symbol, current.commit, symbolItems);
    const kinds = ["attributes", "events", "methods", "slots"] as const;
    const merged: Record<string, ReconciledItem[]> = {};
    for (const kind of kinds) {
      const values = [...(doc ? docValues(doc, kind) : []), ...source[kind]];
      const result = reconcileItems(symbol.name, kind.slice(0, -1), values, current.commit);
      merged[kind] = result.items;
      conflicts.push(...result.conflicts);
      if (doc) {
        const normalizeName = (name: string): string => {
          const normalized = name.toLowerCase().replace(/[-_\s]/g, "");
          return kind === "events" ? normalized.replace(/^nc/, "") : normalized;
        };
        const docNames = new Set(docValues(doc, kind).map((item) => normalizeName(item.name)));
        const sourceNames = new Set(source[kind].map((item) => normalizeName(item.name)));
        for (const value of source[kind].filter((item) => !docNames.has(normalizeName(item.name)))) {
          conflicts.push({
            id: `conflict-${sha(`${symbol.name}\0${kind}\0${value.name}\0source-not-documented`).slice(0, 16)}`,
            component: symbol.name,
            itemKind: kind.slice(0, -1),
            itemName: value.name,
            sourceA: value.kind,
            sourceB: "official-doc",
            evidence: [value.evidenceRef, ...(doc.sourceRefs.slice(0, 1))],
            severity: "warning",
            suggestedAction: "人工确认该公开项是否应补充到官方文档。",
            conflictType: "source-public-item-not-documented",
          });
        }
        for (const value of docValues(doc, kind).filter((item) => !sourceNames.has(normalizeName(item.name)))) {
          conflicts.push({
            id: `conflict-${sha(`${symbol.name}\0${kind}\0${value.name}\0documented-not-source`).slice(0, 16)}`,
            component: symbol.name,
            itemKind: kind.slice(0, -1),
            itemName: value.name,
            sourceA: "official-doc",
            sourceB: "source-code",
            evidence: [value.evidenceRef, ...symbol.evidence.slice(0, 1).map((evidence): DocSourceRef => ({
              sourceId: `symbol:${symbol.name}`,
              sourceType: "source-code",
              path: evidence.path,
              url: null,
              lineStart: evidence.line,
              lineEnd: evidence.line,
              sha256: `sha256:${evidence.fileSha256}`,
              commit: current.commit,
            }))],
            severity: "error",
            suggestedAction: "人工核对文档项是否仍由组件公开实现。",
            conflictType: "documented-item-not-found-in-source",
          });
        }
      }
    }
    const examples = [...(doc?.examples ?? []), ...source.examples];
    const componentCoverage = doc
      ? {
          ...doc.quality,
          exampleCount: examples.length,
          missingSections: examples.length
            ? doc.quality.missingSections.filter((section) => section !== "examples")
            : doc.quality.missingSections,
        }
      : {
          attributeCount: 0,
          eventCount: 0,
          methodCount: 0,
          slotCount: 0,
          exampleCount: source.examples.length,
          codeBlockCount: 0,
          missingSections: source.examples.length ? REQUIRED_SECTIONS.filter((section) => section !== "examples") : [...REQUIRED_SECTIONS],
          parseWarnings: ["未匹配到官方文档组件。"],
          qualityStatus: "empty" as const,
        };
    components.push({
      component: symbol.name,
      commit: current.commit,
      imports: symbol.publicPackages.map((packageName) => `import { ${symbol.name} } from "${packageName}";`),
      attributes: merged.attributes,
      events: merged.events,
      methods: merged.methods,
      slots: merged.slots,
      examples,
      conflicts: conflicts.filter((conflict) => conflict.component === symbol.name).map((conflict) => conflict.id),
      coverage: componentCoverage,
      verification: {
        status: "source-and-document-reconciled",
        runtimeVerified: false,
        sourceSnapshotId: current.snapshotId,
        docsCollectionId: parsed.collectionId,
      },
    });
  }
  const coverageRows = components.map((value) => {
    const item = value as { component: string; coverage: DocQuality; conflicts: string[] };
    return { component: item.component, ...item.coverage, conflictCount: item.conflicts.length };
  });
  const coverage = {
    schemaVersion: VERSION,
    frameworkId: options.frameworkId,
    commit: current.commit,
    generatedAt: now(),
    components: coverageRows,
    summary: {
      componentCount: coverageRows.length,
      complete: coverageRows.filter((item) => item.qualityStatus === "complete").length,
      partial: coverageRows.filter((item) => item.qualityStatus === "partial").length,
      empty: coverageRows.filter((item) => item.qualityStatus === "empty").length,
      failed: coverageRows.filter((item) => item.qualityStatus === "failed").length,
    },
  };
  const conflictDocument = {
    schemaVersion: VERSION,
    frameworkId: options.frameworkId,
    commit: current.commit,
    generatedAt: now(),
    conflicts,
  };
  const knowledge = {
    schemaVersion: VERSION,
    frameworkId: options.frameworkId,
    commit: current.commit,
    generatedAt: now(),
    components,
    rootHash: hash(stable({ commit: current.commit, components })),
  };
  await Promise.all([
    validateWithSchema(options.labRoot, "component-knowledge.schema.json", knowledge),
    validateWithSchema(options.labRoot, "documentation-conflicts.schema.json", conflictDocument),
    validateWithSchema(options.labRoot, "documentation-coverage.schema.json", coverage),
  ]);
  const output = path.join(options.labRoot, "frameworks", options.frameworkId, "knowledge", "reconciled");
  await mkdir(output, { recursive: true });
  const conflictMarkdown = `# Knowledge Conflicts\n\n- Framework: ${options.frameworkId}\n- Commit: ${current.commit}\n- Count: ${conflicts.length}\n\n${conflicts.map((item) => `## ${item.component} / ${item.itemKind} / ${item.itemName}\n\n- Type: ${item.conflictType}\n- Sources: ${item.sourceA} ↔ ${item.sourceB}\n- Severity: ${item.severity}\n- Suggested action: ${item.suggestedAction}\n`).join("\n") || "未检测到结构化冲突。\n"}`;
  const coverageMarkdown = `# Documentation Coverage\n\n- Framework: ${options.frameworkId}\n- Commit: ${current.commit}\n\n| Component | Status | Attributes | Events | Methods | Slots | Examples | Conflicts |\n| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |\n${coverageRows.map((item) => `| ${item.component} | ${item.qualityStatus} | ${item.attributeCount} | ${item.eventCount} | ${item.methodCount} | ${item.slotCount} | ${item.exampleCount} | ${item.conflictCount} |`).join("\n")}\n`;
  await Promise.all([
    writeFile(path.join(output, "component-knowledge.json"), `${JSON.stringify(knowledge, null, 2)}\n`, "utf8"),
    writeFile(path.join(output, "knowledge-conflicts.json"), `${JSON.stringify(conflictDocument, null, 2)}\n`, "utf8"),
    writeFile(path.join(output, "knowledge-conflicts.md"), conflictMarkdown, "utf8"),
    writeFile(path.join(output, "documentation-coverage.json"), `${JSON.stringify(coverage, null, 2)}\n`, "utf8"),
    writeFile(path.join(output, "documentation-coverage.md"), coverageMarkdown, "utf8"),
  ]);
  return { components, conflicts, coverage };
}

export async function readReconciledArtifact(
  labRoot: string,
  frameworkId: string,
  name: "knowledge-conflicts.json" | "documentation-coverage.json",
): Promise<unknown> {
  return json(path.join(labRoot, "frameworks", frameworkId, "knowledge", "reconciled", name));
}

export interface ContextV2Options {
  labRoot: string;
  frameworkId: string;
  components: string[];
  outputId?: string;
}

export async function buildContextV2(options: ContextV2Options): Promise<{ context: object; markdown: string; outputDir: string }> {
  const file = path.join(options.labRoot, "frameworks", options.frameworkId, "knowledge", "reconciled", "component-knowledge.json");
  const knowledge = await json<{ commit: string; components: Array<Record<string, unknown>> }>(file);
  const requested = new Set(options.components.map((item) => item.toLowerCase().replace(/^nc/, "")));
  const selected = knowledge.components.filter((component) => requested.has(String(component.component).toLowerCase().replace(/^nc/, "")));
  if (!selected.length) throw new Error("没有找到请求的已校验组件；请先执行 knowledge reconcile。");
  const config = await loadFrameworkConfig(options.labRoot, options.frameworkId);
  const commands = {
    install: `${config.package_manager.executable} ${config.baseline_steps.find((step) => step.id === "install")?.args.join(" ") ?? ""}`.trim(),
    build: `${config.package_manager.executable} ${config.baseline_steps.find((step) => step.id === "build")?.args.join(" ") ?? ""}`.trim(),
    baseline: `pnpm framework-lab baseline run ${options.frameworkId}`,
  };
  const business = { frameworkId: options.frameworkId, commit: knowledge.commit, components: selected, commands };
  const context = {
    schemaVersion: "2.0.0",
    contextId: options.outputId ?? `context-v2-${sha(stable(business)).slice(0, 16)}`,
    generatedAt: now(),
    ...business,
    limitations: [
      "公共 API 仅来自列出的证据，不包含未标记的 AI 推断。",
      "runtimeVerified=false 的项目尚未通过本轮运行时行为验证。",
      "示例为有界摘录，不代表复制完整源码文件。",
    ],
    rootHash: hash(stable(business)),
  };
  await validateWithSchema(options.labRoot, "context-v2.schema.json", context);
  const renderItems = (items: unknown): string => (items as Array<{ value: { name: string; type: string | null; defaultValue: string | null }; status: string }>)
    .map((item) => `- \`${item.value.name}\`: type=${item.value.type ?? "unresolved"}; default=${item.value.defaultValue ?? "unresolved"}; status=${item.status}`)
    .join("\n") || "- 未记录。";
  const markdown = `# Agent Context v2\n\n## Scope\n\n- Framework: ${options.frameworkId}\n- Commit: ${knowledge.commit}\n\n${selected.map((component) => `## ${String(component.component)}\n\n### Import\n\n${(component.imports as string[]).map((item) => `- \`${item}\``).join("\n")}\n\n### Attributes\n\n${renderItems(component.attributes)}\n\n### Events\n\n${renderItems(component.events)}\n\n### Methods\n\n${renderItems(component.methods)}\n\n### Slots\n\n${renderItems(component.slots)}\n\n### Bounded example\n\n\`\`\`ts\n${String((component.examples as DocExample[])[0]?.code ?? "// 未记录可运行示例。")}\n\`\`\`\n\n### Evidence and verification\n\n- Conflicts: ${(component.conflicts as string[]).join(", ") || "none detected"}\n- Runtime verified: ${String((component.verification as { runtimeVerified: boolean }).runtimeVerified)}\n`).join("\n")}\n## Commands\n\n- Install: \`${commands.install}\`\n- Build: \`${commands.build}\`\n- Baseline: \`${commands.baseline}\`\n\n## Limitations\n\n${(context.limitations as string[]).map((item) => `- ${item}`).join("\n")}\n`;
  const outputDir = path.join(options.labRoot, "frameworks", options.frameworkId, "contexts", String(context.contextId));
  await mkdir(path.dirname(outputDir), { recursive: true });
  await mkdir(outputDir, { recursive: false });
  await Promise.all([
    writeFile(path.join(outputDir, "context.json"), `${JSON.stringify(context, null, 2)}\n`, "utf8"),
    writeFile(path.join(outputDir, "context.md"), markdown, "utf8"),
  ]);
  return { context, markdown, outputDir };
}
