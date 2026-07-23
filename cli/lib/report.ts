import type {
  BaselineRunRecord,
  EnvironmentRecord,
  ErrorEventsDocument,
  SourceRecord,
} from "./types.js";

function cell(value: unknown): string {
  return String(value ?? "null")
    .replaceAll("|", "\\|")
    .replaceAll("\r", "")
    .replaceAll("\n", "<br>");
}

function seconds(durationMs: number): string {
  return `${(durationMs / 1000).toFixed(3)} s`;
}

export function generateReport(
  run: BaselineRunRecord,
  environment: EnvironmentRecord,
  source: SourceRecord,
  errors?: ErrorEventsDocument,
): string {
  const lines: string[] = [
    `# ${run.framework.name} ${run.runId} 基线报告`,
    "",
    `- Framework ID：\`${run.framework.id}\``,
    `- 最终状态：**${run.status}**`,
    `- 源码 commit：\`${source.commit ?? "null"}\``,
    `- Dirty worktree：\`${source.dirty === null ? "unknown" : String(source.dirty)}\``,
    `- 总耗时：${seconds(run.totalDurationMs)}`,
    `- 首个阻塞步骤：${run.firstBlockingStep ? `\`${run.firstBlockingStep}\`` : "无"}`,
    "",
    "## 环境摘要",
    "",
    `- OS：${environment.os.platform} ${environment.os.release} (${environment.os.arch})`,
    `- Node：${environment.nodeVersion}`,
    `- npm：${environment.npmVersion ?? "null"}`,
    `- ${environment.packageManager.name}：配置 ${environment.packageManager.configuredVersion}，实际 ${environment.packageManager.resolvedVersion ?? "null"}`,
    `- Framework Lab commit：\`${environment.frameworkLabCommit ?? "null"}\``,
    "",
    "## 步骤结果",
    "",
    "| Step | Status | Exit code | Duration | Allow failure | Stdout | Stderr |",
    "| --- | --- | ---: | ---: | --- | --- | --- |",
  ];

  for (const step of run.steps) {
    lines.push(
      `| ${cell(step.id)} | ${step.status} | ${cell(step.exitCode)} | ${seconds(step.durationMs)} | ${step.allowFailure} | \`${step.stdoutLog}\` | \`${step.stderrLog}\` |`,
    );
  }

  if (errors) {
    const recognizedRate = errors.summary.total === 0
      ? "100.0%"
      : `${((errors.summary.recognized / errors.summary.total) * 100).toFixed(1)}%`;
    lines.push(
      "",
      "## 结构化错误摘要",
      "",
      `- 错误数：${errors.summary.errors}`,
      `- 警告数：${errors.summary.warnings}`,
      `- 识别率：${recognizedRate}`,
      `- 按工具：${Object.entries(errors.summary.byTool).map(([tool, count]) => `${tool}=${count}`).join(", ") || "无"}`,
      `- 首个阻塞错误：${errors.firstBlockingErrorId ? `\`${errors.firstBlockingErrorId}\`` : "无"}`,
      "- 结构化事件：`errors.json`",
      "",
      "### 代表性事件",
      "",
    );
    if (errors.events.length === 0) {
      lines.push("- 无。", "");
    } else {
      for (const event of errors.events.slice(0, 5)) {
        const location = event.file
          ? `${event.file}${event.line ? `:${event.line}${event.column ? `:${event.column}` : ""}` : ""}`
          : "无位置";
        lines.push(
          `- ${event.tool}/${event.category}：${event.message}（${location}；${event.sourceLog}）`,
        );
      }
      lines.push("");
    }
  }

  lines.push("## 源码变更", "");
  if (source.changedFiles.length === 0) {
    lines.push("- Git 未报告 worktree 变更。", "");
  } else {
    for (const file of source.changedFiles) lines.push(`- \`${file}\``);
    lines.push("");
  }

  lines.push("## 警告", "");
  if (run.warnings.length === 0) {
    lines.push("- 无。", "");
  } else {
    for (const warning of run.warnings) lines.push(`- ${warning}`);
    lines.push("");
  }

  lines.push(
    "## 证据文件",
    "",
    "- Run：`run.json`",
    `- Environment：\`${run.environmentFile}\``,
    `- Source：\`${run.sourceFile}\``,
  );
  if (errors) lines.push("- Errors：`errors.json`");
  lines.push(
    "",
    "本报告只汇总命令、环境和日志中明确出现的事实，不推断根因，也不生成修复建议。",
    "",
  );
  return lines.join("\n");
}
