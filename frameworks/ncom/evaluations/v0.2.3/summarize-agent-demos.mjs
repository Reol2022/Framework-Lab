import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve("frameworks/ncom/evaluations/v0.2.3/agent-demos");
const demos = ["demo-a", "demo-b-raw", "demo-b-knowledge-first"];

function decode(buffer) {
  if (buffer[0] === 0xff && buffer[1] === 0xfe) return buffer.subarray(2).toString("utf16le");
  if (buffer[0] === 0xfe && buffer[1] === 0xff) throw new Error("UTF-16BE event log is unsupported");
  const nullRatio = [...buffer.subarray(0, Math.min(buffer.length, 200))].filter((item) => item === 0).length / Math.min(buffer.length, 200);
  return nullRatio > 0.2 ? buffer.toString("utf16le") : buffer.toString("utf8");
}

function classify(command) {
  const lower = command.toLowerCase();
  if (lower.includes("get-content") || lower.includes("readfile")) return "read";
  if (/\brg(?:\.exe)?\b/u.test(lower) || lower.includes("select-string")) return "search";
  if (lower.includes("eslint")) return "lint";
  if (/\bbuild\b/u.test(lower)) return "build";
  if (lower.includes("git diff --check")) return "static-acceptance";
  if (lower.includes("git status") || lower.includes("git diff")) return "inspect";
  return "other";
}

for (const demo of demos) {
  const directory = path.join(root, demo);
  const events = decode(await readFile(path.join(directory, "events.jsonl")))
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const commands = events
    .filter((item) => item.type === "item.completed" && item.item?.type === "command_execution")
    .map((item) => item.item.command);
  const commandKinds = commands.map(classify);
  const completed = events.findLast((item) => item.type === "turn.completed");
  const final = await readFile(path.join(directory, "final.md"));
  const metrics = {
    schemaVersion: "1.0.0",
    demo,
    codexVersion: "0.146.0-alpha.3",
    requestedModel: null,
    observedModel: null,
    modelLimitation: "Codex JSONL did not expose the default model name; all successful demo sessions used the same default configuration.",
    commandCount: commands.length,
    commandKinds: Object.fromEntries([...new Set(commandKinds)].sort().map((kind) => [kind, commandKinds.filter((item) => item === kind).length])),
    readCommandCount: commandKinds.filter((item) => item === "read").length,
    searchCommandCount: commandKinds.filter((item) => item === "search").length,
    lintCommandObserved: commandKinds.includes("lint"),
    buildCommandObserved: commandKinds.includes("build"),
    sessionUsage: completed?.usage ?? null,
    finalSha256: `sha256:${createHash("sha256").update(final).digest("hex")}`,
    limitations: [
      "Command counts are derived from Codex command_execution events, not wall-clock process tracing.",
      "Files read through a compound shell command are counted as one read command.",
      "Raw events and final Agent text are private evaluation evidence and may contain machine paths.",
    ],
  };
  await writeFile(path.join(directory, "metrics.json"), `${JSON.stringify(metrics, null, 2)}\n`, "utf8");
}
