# Changelog

## 0.1.8 - 2026-07-23

- 归档相同 NCom commit 上 NCButton 示例开发的无 Context / 有 Context 双会话实验。
- 记录两组修改边界、构建、开发服务、HTTP 结果和实现差异。
- 使用既有 Run Record 结构保存脱敏指标；无法获得的精确 usage、耗时和读取量保持 `null`。
- 明确浏览器行为、代码质量改进和真实 Token 降低仍未得到充分验证。
- 不新增 Agent 调用、浏览器自动化或任务闭环核心能力。

## 0.1.7 - 2026-07-23

- 新增确定性 TaskProfile、候选召回、透明评分与深度受限关系扩展。
- 新增 `retrieval query/validate/explain` 和原子本地 Retrieval 产物。
- 将 Symbol、Component、文档、示例、样式与 KnowledgeCard 融合进既有 `context create`。
- 新增 Catalog 哈希校验的有限源码片段、预算裁剪、Manifest 和 Schema。
- 完成 NCButton、NCInput 和 Sass 构建问题三个真实 NCom 检索与 Context。

## 0.1.6 - 2026-07-23

- 新增 Catalog 驱动的 TypeScript/TSX Compiler API 分析。
- 新增声明、成员、JSDoc、import/export、公共 API 导出链和 diagnostics。
- 新增配置驱动组件检测及 props、events、slots、style、example、document 关联。
- 新增 symbols extract/validate/list/query/diff、Schema、Manifest 和稳定 rootHash。
- 完成 NCom 真实 Symbol Snapshot 与重复提取验证。

## 0.1.5 - 2026-07-23

- 新增 Git 跟踪文件驱动的框架源码与文档 Catalog。
- 新增文件、workspace package、Markdown 章节、示例、配置和确定性关系索引。
- 新增稳定 rootHash、原子 snapshot、manifest 校验以及 catalog validate/list/diff。
- 新增 Catalog 产物 Schema 和临时 Git fixture 回归测试。
- 完成 NCom `a350b576...` 的真实 Catalog 扫描与重复扫描验证。

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 的结构。

## [Unreleased]

### Added

- 后续变更将在此记录。

## [0.1.4] - 2026-07-23

### Added

- 增加 EvidenceRef、版本/环境 Scope 与 KnowledgeCard 校验。
- 增加确定性知识索引、scope/关键词选择和原子 claim 预算裁剪。
- 增加 `knowledge validate/index` 与 `context create`。
- 增加六张 NCom 证据卡、两个真实最小 Agent context 和知识回归测试。

## [0.1.3] - 2026-07-23

### Added

- 增加统一 ErrorEvent 模型、parser registry 和稳定 SHA256 fingerprint。
- 增加 ESLint、Sass、Vite、TypeScript、Node、pnpm lifecycle 与 generic 解析器。
- baseline 自动生成 `errors.json` 并在新运行记录和报告中引用摘要。
- 增加 `errors parse` 历史日志回放及显式 `--force` 覆盖。
- 增加错误事件 Schema、路径脱敏、ANSI/CRLF 规范化和 28 项解析回归测试。

### Changed

- 项目版本更新为 `0.1.3`。

## [0.1.2] - 2026-07-23

### Added

- 增加 `framework-lab baseline run` 可执行 CLI。
- 增加声明式框架配置、环境与 Git 状态采集、串行命令运行器。
- 增加超时终止、允许失败、阻塞跳过和 Windows `.cmd` 参数适配。
- 增加自动 run id、独立步骤日志、结构化运行产物和事实型报告。
- 增加配置与基线运行 Schema，以及十类隔离测试。

### Changed

- 项目版本更新为 `0.1.2`。
- NCom 基线从人工命令整理为 `install`、`lint`、`build` 配置步骤。

## [0.1.0-dev]

### Added

- 初始化仓库文档、目录、协作规范和基础 Schema。
- 定义工作流、开源边界及 NCom 基线准备模板。
# v0.2.0

- 新增配置驱动的受控 Coding Agent 任务模型与 CLI。
- 新增 Acceptance、Change Policy、Verification Plan、worktree、handoff、inspect、comparison、manifest 和 append-only history。
- 复用既有进程运行器与 ErrorEvent 解析；HTTP 验证在步骤 timeout 内轮询服务就绪。
- 新增 113 项任务系统测试和真实 NCButton 任务证据。
- Framework Lab 不直接调用 Coding Agent、OpenAI API，也不自动接受、commit 或 push 修改。
