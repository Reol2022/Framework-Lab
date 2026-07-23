import { normalizeLog } from "./error-normalize.js";
import type {
  ErrorParseContext,
  ErrorParser,
  ErrorSeverity,
  ParsedErrorCandidate,
} from "./types.js";

const VERSION = "1.0.0";

function combined(context: ErrorParseContext): Array<{ text: string; sourceLog: string }> {
  return [
    { text: normalizeLog(context.stdout), sourceLog: context.stdoutLogPath },
    { text: normalizeLog(context.stderr), sourceLog: context.stderrLogPath },
  ].filter((entry) => entry.text.trim().length > 0);
}

function candidate(
  parser: string,
  tool: ParsedErrorCandidate["tool"],
  category: string,
  sourceLog: string,
  values: Partial<ParsedErrorCandidate> & Pick<ParsedErrorCandidate, "message" | "rawExcerpt">,
): ParsedErrorCandidate {
  return {
    parser,
    parserVersion: VERSION,
    tool,
    category,
    severity: values.severity ?? "error",
    message: values.message,
    file: values.file ?? null,
    line: values.line ?? null,
    column: values.column ?? null,
    rule: values.rule ?? null,
    code: values.code ?? null,
    plugin: values.plugin ?? null,
    rawExcerpt: values.rawExcerpt,
    sourceLog,
    confidence: values.confidence ?? "high",
  };
}

const eslintParser: ErrorParser = {
  id: "eslint",
  version: VERSION,
  priority: 100,
  supports: (context) => /\b(?:error|warning)\b.*(?:@?[\w-]+\/[\w/-]+|prettier\/prettier)/u.test(`${context.stdout}\n${context.stderr}`),
  parse(context) {
    const events: ParsedErrorCandidate[] = [];
    for (const log of combined(context)) {
      const lines = log.text.split("\n");
      let currentFile: string | null = null;
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !/^\d+[:：]/u.test(trimmed) && /(?:[A-Za-z]:[\\/]|\/).+\.[cm]?[jt]sx?$/u.test(trimmed)) {
          currentFile = trimmed;
          continue;
        }
        const match = /^\s*(\d+):(\d+)\s+(error|warning)\s+(.+?)\s{2,}([^\s]+)\s*$/u.exec(line);
        const withoutRule = match
          ? null
          : /^\s*(\d+):(\d+)\s+(error|warning)\s+(.+?)\s*$/u.exec(line);
        const diagnostic = match ?? withoutRule;
        if (!diagnostic?.[1] || !diagnostic[2] || !diagnostic[3] || !diagnostic[4]) continue;
        events.push(candidate("eslint", "eslint", "lint", log.sourceLog, {
          severity: diagnostic[3] as ErrorSeverity,
          message: diagnostic[4].trim(),
          file: currentFile,
          line: Number(diagnostic[1]),
          column: Number(diagnostic[2]),
          rule: diagnostic[5] ?? null,
          rawExcerpt: `${currentFile ?? ""}\n${line}`.trim(),
        }));
      }
    }
    return events;
  },
};

const sassParser: ErrorParser = {
  id: "sass",
  version: VERSION,
  priority: 95,
  supports: (context) => /\[sass\]|stylesheet to import|SassError|root stylesheet/iu.test(`${context.stdout}\n${context.stderr}`),
  parse(context) {
    const events: ParsedErrorCandidate[] = [];
    for (const log of combined(context)) {
      const text = log.text;
      const error = /(?:\[sass\]\s*)?Error:\s*([^\n]+)/iu.exec(text);
      if (!error?.[1]) continue;
      const fileLine = /(?:file:\s*)?((?:[A-Za-z]:[\\/]|\/)[^\n?]+?\.s[ac]ss)(?:\?[^\s]*)?(?:\s+(\d+):(\d+)\s+root stylesheet)?/iu.exec(text);
      const rootLine = /((?:[A-Za-z]:[\\/]|\/)[^\n]+?\.s[ac]ss)\s+(\d+):(\d+)\s+root stylesheet/iu.exec(text);
      const location = rootLine ?? fileLine;
      const plugin = /\[(vite:[^\]]+)\]\s*\[sass\]/iu.exec(text)?.[1] ?? null;
      const start = Math.max(0, error.index - 80);
      events.push(candidate("sass", "sass", "style", log.sourceLog, {
        message: error[1].trim(),
        file: location?.[1] ?? null,
        line: location?.[2] ? Number(location[2]) : null,
        column: location?.[3] ? Number(location[3]) : null,
        plugin,
        rawExcerpt: text.slice(start, start + 1000),
        confidence: "high",
      }));
    }
    return events;
  },
};

const viteParser: ErrorParser = {
  id: "vite",
  version: VERSION,
  priority: 90,
  supports: (context) => /(?:\[plugin:vite:|\[vite:|error during build|Failed to resolve import|RollupError|Could not resolve)/iu.test(`${context.stdout}\n${context.stderr}`),
  parse(context) {
    const events: ParsedErrorCandidate[] = [];
    for (const log of combined(context)) {
      const text = log.text;
      const resolveError = /(?:\[plugin:([^\]]+)\]\s*)?Failed to resolve import\s+([^\n]+?)(?:\s+from\s+["']([^"']+)["'])?(?:\.|$)/iu.exec(text);
      if (resolveError?.[2]) {
        events.push(candidate("vite", "vite", "module-resolution", log.sourceLog, {
          message: `Failed to resolve import ${resolveError[2].trim()}`,
          file: resolveError[3] ?? /\nfile:\s*([^\n?]+)/iu.exec(text)?.[1] ?? null,
          plugin: resolveError[1] ?? null,
          rawExcerpt: resolveError[0],
          confidence: "high",
        }));
      } else {
        const rollup = /(?:RollupError:\s*)?(Could not resolve\s+["'][^"']+["'](?:\s+from\s+["']([^"']+)["'])?)/iu.exec(text);
        if (rollup?.[1]) {
          events.push(candidate("vite", "vite", "module-resolution", log.sourceLog, {
            message: rollup[1],
            file: rollup[2] ?? null,
            plugin: "rollup",
            rawExcerpt: rollup[0],
            confidence: "high",
          }));
        } else if (/error during build:/iu.test(text) && !/\[sass\]|stylesheet to import|SassError/iu.test(text)) {
        const detail = /error during build:\s*\n?([^\n]+)/iu.exec(text)?.[1]?.trim() ?? "Vite build failed";
        events.push(candidate("vite", "vite", "build", log.sourceLog, {
          message: detail,
          plugin: /\[([^\]]+)\]/u.exec(detail)?.[1] ?? null,
          rawExcerpt: detail,
          confidence: "medium",
        }));
        }
      }
    }
    return events;
  },
};

const typescriptParser: ErrorParser = {
  id: "typescript",
  version: VERSION,
  priority: 85,
  supports: (context) => /error TS\d+:/u.test(`${context.stdout}\n${context.stderr}`),
  parse(context) {
    const events: ParsedErrorCandidate[] = [];
  const pattern = /^(.+?)(?:\((\d+),(\d+)\):|:(\d+):(\d+)\s+-)\s*error\s+(TS\d+):\s*(.+)$/gmu;
    for (const log of combined(context)) {
      for (const match of log.text.matchAll(pattern)) {
        if (!match[1] || !match[6] || !match[7]) continue;
        events.push(candidate("typescript", "typescript", "typecheck", log.sourceLog, {
          message: match[7].trim(),
          file: match[1].trim(),
          line: Number(match[2] ?? match[4]),
          column: Number(match[3] ?? match[5]),
          code: match[6],
          rawExcerpt: match[0],
        }));
      }
    }
    return events;
  },
};

const nodeParser: ErrorParser = {
  id: "node",
  version: VERSION,
  priority: 80,
  supports(context) {
    const text = `${context.stdout}\n${context.stderr}`;
    return /MODULE_NOT_FOUND/u.test(text)
      || (!/\[sass\]|SassError|stylesheet to import/iu.test(text)
        && /(?:Type|Reference|Syntax|Range)?Error:/u.test(text)
        && /^\s*at\s+/mu.test(text));
  },
  parse(context) {
    const events: ParsedErrorCandidate[] = [];
    for (const log of combined(context)) {
      const text = log.text;
      const missing = /Error:\s*Cannot find module\s+['"]([^'"]+)['"]/u.exec(text);
      const general = /\b((?:Type|Reference|Syntax|Range)?Error):\s*([^\n]+)/u.exec(text);
      if (!missing && !general) continue;
      const stack = /^\s*at\s+.*?\(?((?:[A-Za-z]:[\\/]|\/)[^\n():]+):(\d+):(\d+)\)?$/gmu;
      let location: RegExpExecArray | null = null;
      for (const frame of text.matchAll(stack)) {
        if (frame[1] && !/node_modules|node:internal/iu.test(frame[1])) {
          location = frame as RegExpExecArray;
          break;
        }
      }
      events.push(candidate("node", "node", "runtime", log.sourceLog, {
        message: missing ? `Cannot find module '${missing[1]}'` : `${general?.[1]}: ${general?.[2]?.trim()}`,
        file: location?.[1] ?? null,
        line: location?.[2] ? Number(location[2]) : null,
        column: location?.[3] ? Number(location[3]) : null,
        code: missing ? "MODULE_NOT_FOUND" : null,
        rawExcerpt: text.slice(Math.max(0, (missing ?? general)?.index ?? 0), 1000),
      }));
    }
    return events;
  },
};

const pnpmParser: ErrorParser = {
  id: "pnpm-lifecycle",
  version: VERSION,
  priority: 30,
  supports: (context) => /ELIFECYCLE|ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL|Command failed with exit code/iu.test(`${context.stdout}\n${context.stderr}`),
  parse(context) {
    const events: ParsedErrorCandidate[] = [];
    for (const log of combined(context)) {
      const text = log.text;
      const codes = [...text.matchAll(/\b(ERR_PNPM_[A-Z0-9_]+|ELIFECYCLE)\b/gu)];
      const unique = new Set<string>();
      for (const match of codes) {
        const code = match[1];
        if (!code || unique.has(code)) continue;
        unique.add(code);
        const line = text.slice(match.index, text.indexOf("\n", match.index) === -1 ? undefined : text.indexOf("\n", match.index)).trim();
        events.push(candidate("pnpm-lifecycle", "pnpm", "lifecycle", log.sourceLog, {
          message: line || code,
          code,
          rawExcerpt: line || code,
          confidence: "medium",
        }));
      }
      if (events.length === 0) {
        const failed = /Command failed with exit code\s+(\d+)/iu.exec(text);
        if (failed?.[1]) events.push(candidate("pnpm-lifecycle", "pnpm", "lifecycle", log.sourceLog, {
          message: `Command failed with exit code ${failed[1]}`,
          code: `EXIT_${failed[1]}`,
          rawExcerpt: failed[0],
          confidence: "medium",
        }));
      }
    }
    return events;
  },
};

export const parserRegistry: ErrorParser[] = [
  eslintParser,
  sassParser,
  viteParser,
  typescriptParser,
  nodeParser,
  pnpmParser,
].sort((left, right) => right.priority - left.priority);

export function genericFallback(context: ErrorParseContext): ParsedErrorCandidate[] {
  if (context.status !== "failed" && context.status !== "timed_out") return [];
  const text = normalizeLog(`${context.stderr}\n${context.stdout}`);
  const meaningful = text.split("\n").map((line) => line.trim()).filter(Boolean).reverse()
    .find((line) => /error|failed|timed?\s*out|exit/iu.test(line));
  const message = meaningful ?? (context.status === "timed_out"
    ? `Command timed out in step ${context.stepId}`
    : `Command exited with code ${context.exitCode ?? "unknown"}`);
  return [candidate("generic", "generic", context.status === "timed_out" ? "timeout" : "command", context.stderrLogPath, {
    message,
    rawExcerpt: message,
    confidence: "low",
  })];
}
