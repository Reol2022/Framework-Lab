# Framework Lab

Framework Lab 是一个面向 Coding Agent 的框架学习与验证工作流。它固定框架源码版本、采集环境、执行声明式基线步骤并保存可复现证据；它不是聊天机器人或自动修复平台。

当前版本：`v0.1.8`

## NCButton Context A/B 探索性实验

v0.1.8 使用相同 NCom commit、两个独立 Coding Agent 会话，对比了无 Context 与有 v0.1.7 Context 的 NCButton 示例开发。两组均只修改两个 example 文件、通过 example 构建并获得 HTTP 200；有 Context 组减少了对组件核心源码、类型、公共导出和文档的补充探索。

这是单框架、单任务、双会话的探索性结果。实际浏览器点击未验证，精确文件读取量、会话 usage 和 Token 数未记录；因此不声明 Context 提升代码质量、降低真实 Token 或具有统计普遍性。完整边界见 [v0.1.8 实验报告](docs/v0.1.8-ncbutton-context-ab-experiment.md)。

## 任务级检索与 Agent Context

```powershell
pnpm framework-lab retrieval query ncom --task "在 example 新增 NCButton 示例" --retrieval-id ncbutton-task
pnpm framework-lab retrieval explain ncom ncbutton-task
pnpm framework-lab context create ncom --task "在 example 新增 NCButton 示例" --retrieval-id ncbutton-task --budget 4000
```

处理链为：任务 → 精确召回 `NCButton` → 沿 Props/Event/Example/文档和公开导出扩展 → 在 4000 启发式 token 预算内生成 Agent Context。评分、关系、Scope、降权和裁剪理由均写入 Manifest。

Framework Lab 当前生成上下文，但不自动调用 Coding Agent。字符数除以 4 只是透明估算，尚未验证真实 Token 节省。

## TypeScript 符号与组件索引

```powershell
pnpm framework-lab symbols extract ncom --dry-run
pnpm framework-lab symbols extract ncom
pnpm framework-lab symbols validate ncom
pnpm framework-lab symbols list ncom
pnpm framework-lab symbols query ncom --name NCButton
```

Symbol Extractor 只读取 Catalog 已登记的 TypeScript/TSX 文件，使用 TypeScript Compiler API 提取语法声明、import/export、公共导出链和配置驱动的组件候选。它不执行框架代码、不运行构建、不调用 LLM，也不把内部 `export` 自动等同于 package 公共 API。

## 源码与文档 Catalog

Catalog 是对目标 Git worktree 的确定性元数据索引，只读取 `git ls-files -z` 返回的跟踪文件：

```powershell
pnpm framework-lab catalog scan ncom --dry-run
pnpm framework-lab catalog scan ncom
pnpm framework-lab catalog validate ncom
pnpm framework-lab catalog list ncom
pnpm framework-lab catalog diff ncom <from-snapshot> <to-snapshot>
```

它记录文件哈希、分类、workspace package、依赖/导出目标、Markdown 章节、示例入口、静态配置和关系，不执行目标框架代码、不动态加载配置、不使用 LLM，也不复制完整源码。Catalog 是后续符号知识采集的原料层，不是语义知识库，更不表示 Framework Lab 已经“学会”目标框架。

本地 snapshot 默认不提交，因为其中可能包含未脱敏的仓库结构。v0.1.7 使用 Catalog 与 Symbol Snapshot 做确定性任务检索。

## 证据约束知识与 Agent 上下文

```powershell
pnpm framework-lab knowledge validate ncom
pnpm framework-lab knowledge index ncom
pnpm framework-lab context create ncom --task "分析构建失败" --run-id run-009
```

知识卡的每条 claim 必须绑定可定位、可校验 SHA256 的 EvidenceRef，并声明精确 commit 与环境 scope。上下文使用确定性的关键词、卡片类型和 scope 匹配，不使用 LLM、embedding、向量数据库或联网检索。字符数除以 4 只是透明的 token 启发式估算，不是精确 tokenizer。

脱敏知识卡的最小形态如下；示例摘要不能作为真实证据使用：

```json
{
  "id": "example-observed-command",
  "frameworkId": "example-framework",
  "type": "validated_command",
  "scope": {
    "exactCommits": ["0123456789abcdef0123456789abcdef01234567"]
  },
  "claims": [{
    "id": "example-command",
    "status": "observed",
    "text": "示例命令在绑定的运行证据中通过。",
    "evidence": [{
      "id": "E1",
      "path": "frameworks/example/runs/run-001/run.json",
      "jsonPointer": "/steps/0/status",
      "sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    }]
  }]
}
```

生成的 `context.md` 只保留入选的完整 claim、证据编号和适用范围，例如：

```markdown
## 已验证知识

- 示例命令在绑定的运行证据中通过。 `[E1]`

## 证据索引

- `E1` — `frameworks/example/runs/run-001/run.json` `/steps/0/status`
```

## 基线运行

```powershell
pnpm framework-lab baseline run ncom
```

支持 `--run-id`、`--source-dir`、`--dry-run` 和 `--help`。每次非 dry-run 基线生成：

```text
frameworks/<id>/runs/<run-id>/
  run.json
  environment.json
  source.json
  errors.json
  steps/*.stdout.log
  steps/*.stderr.log
  report.md
```

## 历史日志回放

回放只读取既有运行元数据和步骤日志，不重新执行 install、lint 或 build，也不修改原始日志：

```powershell
pnpm framework-lab errors parse ncom run-009
pnpm framework-lab errors parse ncom run-010
```

已有 `errors.json` 时默认拒绝覆盖；确需重新解析时显式使用 `--force`。

## errors.json 示例

```json
{
  "schemaVersion": "1.0.0",
  "runId": "run-009",
  "frameworkId": "ncom",
  "generatedAt": "2026-07-23T00:00:00.000Z",
  "summary": {
    "total": 1,
    "errors": 1,
    "warnings": 0,
    "recognized": 1,
    "unrecognized": 0,
    "byTool": { "sass": 1 },
    "byCategory": { "style": 1 }
  },
  "firstBlockingErrorId": "error-0123456789ab",
  "events": []
}
```

完整事件包含 parser、tool、category、severity、位置、rule/code/plugin、有限原文、来源日志、fingerprint、blocking 和 confidence。

## 支持的解析器

- ESLint stylish 文本
- Sass 导入及语法错误
- Vite/Rollup 构建与 import resolve 错误
- TypeScript 常见诊断格式
- Node `MODULE_NOT_FOUND` 与带用户 stack frame 的错误
- pnpm/npm lifecycle 包装错误
- 无专属匹配时的单一 generic fallback

解析器只处理运行元数据和已保存日志。结构化错误事件是确定性的文本抽取，不等于根因分析、语义理解或修复建议。

## 当前限制

- 只支持已实现的常见文本格式，不覆盖各工具的所有 formatter 或版本。
- 当前只有 NCom 经过真实回放验证，不代表多框架能力已经验证。
- 不执行自动修复、LLM 日志分析、自动知识生成、浏览器自动化或多框架并行。
- 历史回放只生成 `errors.json`，不改写既有 `run.json` 和 `report.md`。

## 开源边界

CLI、parser registry、通用解析器、类型、Schema、脱敏 fixture、fingerprint/去重逻辑和脱敏示例适合开源。原始运行日志、本地 worktree、`node_modules/`、`dist/` 及包含机器路径的未脱敏材料保持本地或忽略。

详见 [CLI 说明](cli/README.md)、[Schema 说明](schemas/README.md) 和 [开源边界](docs/02-open-source-boundary.md)。
# Framework Lab

当前版本：v0.2.0。

Framework Lab 当前不直接调用 Coding Agent。它生成任务包并在 Agent 修改后执行独立验证。

v0.2.0 增加受控任务生命周期、独立 worktree、结构化验收、变更策略、Agent Handoff、Diff 检查、Before/After 验证和事实型对照报告。浏览器行为在没有人工确认时保持 `manual_required`；验证结论只覆盖配置中的验收条件。

任务入口与完整参数见 [CLI 文档](cli/README.md)，实现边界与真实 NCom 结果见 [v0.2.0 实施报告](docs/v0.2.0-implementation-report.md)。
