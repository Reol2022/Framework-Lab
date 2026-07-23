# 数据结构

本目录使用 JSON Schema Draft 2020-12 定义可机读结构。`examples/` 只展示字段形状，不代表已验证框架事实或真实命令结果。

v0.1.2 新增：

- `framework-config.schema.json`：验证 `frameworks/<id>/framework.yaml`。
- `baseline-run.schema.json`：验证自动运行生成的 `run.json`。

v0.1.3 新增 `error-events.schema.json`，约束 `errors.json` 的摘要、事件字段、可空位置、置信度、阻塞标记和 SHA256 fingerprint。`baseline-run.schema.json` 只增加 optional 的 `errorsFile`、`errorSummary` 与 `firstBlockingErrorId`，因此旧 Run 不需要迁移。

CLI 使用 Ajv 2020 在加载配置和写入运行产物前执行校验。环境和源码详情分开保存到 `environment.json` 与 `source.json`；`run.json` 保存运行状态、步骤结果、证据相对路径和警告。

v0.1.4 使用 `knowledge-card.schema.json`、`knowledge-index.schema.json`、`agent-context.schema.json` 和 `context-manifest.schema.json` 约束证据卡、确定性索引与 Agent context。证据 SHA256、枚举、时间和 id 均受约束。

v0.1.5 新增 Catalog Schema，分别约束 current pointer、repository、tracked files、workspace packages、Markdown documents、examples、configs、relationships、snapshot、manifest、statistics 和 snapshot diff。路径必须使用 `/` 且不得包含盘符、反斜杠或路径穿越；commit、SHA256、时间和分类枚举具有明确格式约束。既有 baseline、errors、knowledge 和 context Schema 未收紧为不兼容结构。

v0.1.6 新增 TypeScript analysis、modules、symbols、imports/exports、components、symbol relationships、diagnostics、statistics、manifest、current pointer 和 diff Schema。源码位置为正整数，路径保持仓库相对形式，声明和产物摘要使用 SHA256。

v0.1.7 新增 `task-profile.schema.json`、`retrieval-result.schema.json`、`retrieval-manifest.schema.json` 和 `source-snippet.schema.json`，并以 optional 字段扩展 Agent Context/Manifest，保持 v0.1.4 旧格式兼容。片段必须记录 commit、文件 SHA256 和正整数行号，且拒绝绝对路径、node_modules 与 dist。

v0.1.8 不新增或收紧 Schema。NCButton A/B 探索性实验复用 `run-record.schema.json` 保存可获得的脱敏指标；未采集的模型、时间、精确读取量和 usage 使用 `null`，不以估算值代替。
# v0.2.0 Task Schema

任务系统使用 `task`、`acceptance`、`change-policy`、`verification-plan`、`task-verification`、`task-comparison`、`task-worktree`、`task-handoff`、`task-history` 与 `task-manifest` Schema。运行时还检查 acceptance id 唯一、verification dependency 无环、路径可移植、history 追加顺序和 manifest SHA256；旧版 Task 示例继续由兼容分支校验。
