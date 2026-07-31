import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  BrowserDocsProvider,
  FileDocsProvider,
  HttpDocsProvider,
  buildContextV2,
  collectDocs,
  parseCapture,
  parseDocs,
  reconcileItems,
  type DocsCapture,
  type KnowledgeSourceValue,
} from "../cli/lib/docs.js";
import type { DocsSourceConfig } from "../cli/lib/types.js";

const commit = "a".repeat(40);
const source: DocsSourceConfig = {
  id: "official",
  mode: "http",
  baseUrl: "https://example.test/docs",
  entryPages: ["card"],
  sourceType: "official-doc",
};

function capture(body: string, contentType = "text/html"): DocsCapture {
  return {
    url: "https://example.test/card",
    sourceId: "official",
    status: 200,
    requestedMode: "http",
    captureMode: "http",
    capturedAt: "2026-07-30T00:00:00.000Z",
    title: "Card",
    contentType,
    body,
    warnings: [],
  };
}

const reference = {
  sourceId: "fixture",
  sourceType: "official-doc" as const,
  path: "docs/card.md",
  url: null,
  lineStart: 1,
  lineEnd: 1,
  sha256: `sha256:${"b".repeat(64)}`,
  commit,
};

function value(kind: KnowledgeSourceValue["kind"], name: string, type: string | null, defaultValue: string | null, itemCommit = commit): KnowledgeSourceValue {
  return {
    kind,
    name,
    type,
    defaultValue,
    commit: itemCommit,
    evidenceRef: { ...reference, sourceType: kind, commit: itemCommit },
  };
}

test("HTTP provider records status, content type and body", async () => {
  const provider = new HttpDocsProvider(async () => new Response("<title>Card</title><main>API</main>", {
    status: 200,
    headers: { "content-type": "text/html" },
  }));
  const result = await provider.capture({ source, entryPage: "card", labRoot: ".", frameworkId: "fixture", sourceCommit: commit });
  assert.equal(result.status, 200);
  assert.equal(result.title, "Card");
  assert.equal(result.captureMode, "http");
});

test("HTTP provider preserves non-200 failure evidence", async () => {
  const provider = new HttpDocsProvider(async () => new Response("missing", { status: 404 }));
  const result = await provider.capture({ source, entryPage: "missing", labRoot: ".", frameworkId: "fixture", sourceCommit: commit });
  assert.equal(result.status, 404);
  assert.match(result.warnings[0] ?? "", /404/);
});

test("browser provider uses injected renderer without browser dependency", async () => {
  const provider = new BrowserDocsProvider(async () => ({ html: "<title>Rendered</title><h1>Card</h1>", title: "Rendered" }));
  const result = await provider.capture({ source: { ...source, mode: "browser" }, entryPage: "card", labRoot: ".", frameworkId: "fixture", sourceCommit: commit });
  assert.equal(result.captureMode, "browser");
  assert.equal(result.title, "Rendered");
});

test("browser provider reports unavailable adapter instead of fabricating success", async () => {
  const result = await new BrowserDocsProvider(null).capture({ source: { ...source, mode: "browser" }, entryPage: "card", labRoot: ".", frameworkId: "fixture", sourceCommit: commit });
  assert.equal(result.status, null);
  assert.equal(result.body, "");
  assert.match(result.warnings[0] ?? "", /不可用/);
});

test("dynamic application shell is classified empty", () => {
  const page = parseCapture(capture("<html><head><title>NCom</title></head><body><div id=\"app\"></div><script src=\"app.js\"></script></body></html>"), commit);
  assert.equal(page.quality.qualityStatus, "empty");
  assert.equal(page.components[0]?.attributes.length, 0);
});

test("HTTP 200 without component data is not complete", () => {
  const page = parseCapture(capture("<title>Navigation</title><nav>Home Docs</nav>"), commit);
  assert.notEqual(page.quality.qualityStatus, "complete");
});

test("HTML headings and code blocks are extracted", () => {
  const page = parseCapture(capture("<title>Card</title><h1>Card</h1><h2>Examples</h2><pre class=\"language-ts\">const card = 1;</pre>"), commit);
  assert.equal(page.sections[1]?.title, "Examples");
  assert.match(page.codeBlocks[0]?.code ?? "", /const card/);
});

test("HTML attribute and event tables are structured", () => {
  const html = `<title>Card</title><h1>Card</h1><h2>Attributes</h2>
  <table><tr><th>Name</th><th>Type</th><th>Default</th><th>Description</th></tr>
  <tr><td>shadow</td><td>string</td><td>always</td><td>Shadow mode</td></tr></table>
  <h2>Events</h2><table><tr><th>Event</th><th>Payload</th></tr><tr><td>change</td><td>Event</td></tr></table>`;
  const component = parseCapture(capture(html), commit).components[0]!;
  assert.equal(component.attributes[0]?.name, "shadow");
  assert.equal(component.attributes[0]?.defaultValue, "always");
  assert.equal(component.events[0]?.name, "change");
});

test("Markdown attributes and examples retain source lines", () => {
  const markdown = `# Card (nc-card)

## Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| \`shadow\` | string | always | Shadow mode |

## Examples

\`\`\`ts
const card = document.createElement("nc-card");
\`\`\`
`;
  const component = parseCapture(capture(markdown, "text/markdown"), commit).components[0]!;
  assert.equal(component.attributes[0]?.name, "shadow");
  assert.ok((component.attributes[0]?.sourceRef.lineStart ?? 0) > 1);
  assert.equal(component.examples.length, 1);
});

test("empty capture is failed and creates a valid in-memory page", () => {
  const input = { ...capture(""), status: null, warnings: ["network failure"] };
  const page = parseCapture(input, commit);
  assert.equal(page.quality.qualityStatus, "failed");
  assert.match(page.quality.parseWarnings.join(" "), /network failure/);
});

test("two agreeing independent sources produce verified item", () => {
  const result = reconcileItems("NCCard", "attribute", [
    value("official-doc", "shadow", "string", "always"),
    value("type-definition", "shadow", "string", "always"),
  ], commit);
  assert.equal(result.items[0]?.status, "verified");
  assert.equal(result.conflicts.length, 0);
});

test("single official source remains documented", () => {
  const result = reconcileItems("NCCard", "attribute", [value("official-doc", "shadow", "string", "always")], commit);
  assert.equal(result.items[0]?.status, "documented");
});

test("single source-code item remains inferred", () => {
  const result = reconcileItems("NCCard", "method", [value("source-code", "focus", "() => void", null)], commit);
  assert.equal(result.items[0]?.status, "inferred");
});

test("type mismatch creates explicit conflict", () => {
  const result = reconcileItems("NCCard", "attribute", [
    value("official-doc", "width", "string", null),
    value("type-definition", "width", "number", null),
  ], commit);
  assert.equal(result.items[0]?.status, "conflict");
  assert.equal(result.conflicts[0]?.conflictType, "type-mismatch");
});

test("default mismatch creates explicit conflict", () => {
  const result = reconcileItems("NCCard", "attribute", [
    value("official-doc", "shadow", "string", "always"),
    value("source-code", "shadow", "string", "never"),
  ], commit);
  assert.equal(result.conflicts[0]?.conflictType, "default-mismatch");
});

test("commit mismatch creates explicit conflict", () => {
  const result = reconcileItems("NCCard", "attribute", [
    value("official-doc", "shadow", "string", "always", "c".repeat(40)),
    value("source-code", "shadow", "string", "always"),
  ], commit);
  assert.ok(result.conflicts.some((item) => item.conflictType === "commit-mismatch"));
});

async function fixtureLab(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "framework-lab-docs-"));
  await cp(path.resolve("schemas"), path.join(root, "schemas"), { recursive: true });
  await mkdir(path.join(root, "frameworks", "fixture", "catalog"), { recursive: true });
  await mkdir(path.join(root, "source", "docs"), { recursive: true });
  await writeFile(path.join(root, "source", "docs", "card.md"), `# Card\n\n## Attributes\n\n| Name | Type |\n| --- | --- |\n| shadow | string |\n`, "utf8");
  await writeFile(path.join(root, "frameworks", "fixture", "catalog", "current.json"), `${JSON.stringify({ commit })}\n`, "utf8");
  await writeFile(path.join(root, "frameworks", "fixture", "framework.yaml"), `schema_version: 1.0.0
framework:
  id: fixture
  name: Fixture
  source_dir: source
package_manager:
  name: pnpm
  version: 10.26.1
  executable: pnpm
stop_on_failure: true
baseline_steps:
  - id: build
    command: pnpm
    args: [build]
    timeout_seconds: 10
    allow_failure: false
docs:
  sources:
    - id: local-docs
      mode: file
      basePath: source/docs
      entryPages: [card.md]
      sourceType: official-doc
`, "utf8");
  return root;
}

test("file collection writes immutable raw evidence and schema-valid parsed page", async () => {
  const root = await fixtureLab();
  try {
    const collected = await collectDocs({ labRoot: root, frameworkId: "fixture", sourceId: "local-docs" });
    assert.equal(collected.pages.length, 1);
    const parsed = await parseDocs(root, "fixture", collected.collectionId);
    assert.equal(parsed.pages[0]?.components[0]?.attributes[0]?.name, "shadow");
    const raw = path.join(root, "frameworks", "fixture", "docs", "snapshots", collected.collectionId);
    assert.equal((await readdirRecursive(raw)).some((file) => file.endsWith("raw.md")), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("file provider rejects path traversal", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "framework-lab-file-provider-"));
  try {
    const provider = new FileDocsProvider();
    await assert.rejects(provider.capture({
      source: { id: "local", mode: "file", basePath: "docs", entryPages: ["../secret.md"] },
      entryPage: "../secret.md",
      labRoot: root,
      frameworkId: "fixture",
      sourceCommit: commit,
    }), /越过/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Context v2 contains bounded public API, evidence status and commands", async () => {
  const root = await fixtureLab();
  try {
    const output = path.join(root, "frameworks", "fixture", "knowledge", "reconciled");
    await mkdir(output, { recursive: true });
    await writeFile(path.join(output, "component-knowledge.json"), `${JSON.stringify({
      commit,
      components: [{
        component: "NCCard",
        imports: ['import { NCCard } from "@ncom/components";'],
        attributes: [{ value: { name: "shadow", type: "string", defaultValue: "always" }, status: "verified" }],
        events: [],
        methods: [],
        slots: [],
        examples: [{ code: "const card = document.createElement('nc-card');" }],
        conflicts: [],
        verification: { runtimeVerified: false },
      }],
    })}\n`, "utf8");
    const result = await buildContextV2({ labRoot: root, frameworkId: "fixture", components: ["Card"] });
    assert.match(result.markdown, /shadow/);
    assert.match(result.markdown, /Runtime verified: false/);
    assert.doesNotMatch(result.markdown, /large internal implementation/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

async function readdirRecursive(directory: string): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await (await import("node:fs/promises")).readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await readdirRecursive(target));
    else result.push(target);
  }
  return result;
}

test("raw snapshot metadata contains no absolute path", async () => {
  const root = await fixtureLab();
  try {
    const collected = await collectDocs({ labRoot: root, frameworkId: "fixture" });
    const snapshotRoot = path.join(root, "frameworks", "fixture", "docs", "snapshots", collected.collectionId);
    const metadataFile = (await readdirRecursive(snapshotRoot)).find((file) => file.endsWith("snapshot.json"));
    assert.ok(metadataFile);
    const metadata = await readFile(metadataFile, "utf8");
    assert.doesNotMatch(metadata, /[A-Za-z]:\\/);
    assert.doesNotMatch(metadata, new RegExp(root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("CLI rejects unknown docs options with a non-zero exit code", async () => {
  const result = await new Promise<{ code: number | null; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, [
      path.resolve("node_modules/tsx/dist/cli.mjs"),
      path.resolve("cli/index.ts"),
      "docs",
      "collect",
      "ncom",
      "--unknown",
      "value",
    ], { cwd: path.resolve("."), shell: false, windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stderr }));
  });
  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /未知选项/);
});
