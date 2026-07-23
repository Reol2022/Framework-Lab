import { createHash } from "node:crypto";
import path from "node:path";
import type { ErrorParseContext, ParsedErrorCandidate } from "./types.js";

// ANSI escape sequences necessarily contain control characters.
// eslint-disable-next-line no-control-regex
const ANSI_PATTERN = /[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d/#&.:=?%@~_]+)*)?\u0007)|(?:(?:\d{1,4}(?:[;:]\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/gu;
const SPACE_MARKS = /^[\u2000-\u200b\u202f\u205f\u3000]+|[\u2000-\u200b\u202f\u205f\u3000]+$/gmu;

export function normalizeLog(value: string): string {
  return value
    .replace(ANSI_PATTERN, "")
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .replace(SPACE_MARKS, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/u, ""))
    .join("\n")
    .replace(/\n{3,}/gu, "\n\n");
}

function portable(value: string): string {
  return value.replaceAll("\\", "/").replace(/^file:\/\//u, "");
}

function isWithin(value: string, root: string): boolean {
  const candidate = process.platform === "win32" ? value.toLowerCase() : value;
  const parent = process.platform === "win32" ? root.toLowerCase() : root;
  return candidate === parent || candidate.startsWith(`${parent}/`);
}

export function normalizeEventPath(
  value: string | null,
  sourceRoot: string,
  labRoot: string,
): string | null {
  if (!value) return null;
  const clean = portable(value.trim().replace(/^['"]|['"]$/gu, "").replace(/\?.*$/u, ""));
  const source = portable(path.resolve(sourceRoot));
  const lab = portable(path.resolve(labRoot));
  if (isWithin(clean, source)) return clean.slice(source.length).replace(/^\//u, "") || ".";
  if (isWithin(clean, lab)) return clean.slice(lab.length).replace(/^\//u, "") || ".";
  if (/^[A-Za-z]:\//u.test(clean) || clean.startsWith("/")) {
    return `<external>/${path.posix.basename(clean)}`;
  }
  return clean.replace(/^\.\//u, "");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

export function sanitizeExcerpt(value: string, context: ErrorParseContext): string {
  let result = normalizeLog(value).replaceAll("\\", "/");
  const roots = [
    [portable(path.resolve(context.sourceRoot)), "<source>"],
    [portable(path.resolve(context.labRoot)), "<lab>"],
  ] as const;
  for (const [root, replacement] of roots) {
    result = result.replace(new RegExp(escapeRegExp(root), "giu"), replacement);
  }
  return result
    .replace(/\b[A-Za-z]:\/[^\s"'`()]+/gu, "<external-path>")
    .slice(0, 1200);
}

export function normalizeMessage(value: string, context: ErrorParseContext): string {
  return sanitizeExcerpt(value, context)
    .replace(/[A-Za-z]:\/[\w./+@%~ -]+/gu, "<external-path>")
    .replace(/\s+/gu, " ")
    .trim();
}

export function errorFingerprint(
  candidate: ParsedErrorCandidate,
  context: ErrorParseContext,
): string {
  const fields = [
    candidate.parser,
    candidate.tool,
    candidate.category,
    normalizeEventPath(candidate.file, context.sourceRoot, context.labRoot) ?? "",
    candidate.line ?? "",
    candidate.column ?? "",
    normalizeMessage(candidate.message, context),
    candidate.rule ?? candidate.code ?? "",
    context.stepId,
  ];
  return createHash("sha256").update(fields.join("\u001f"), "utf8").digest("hex");
}
