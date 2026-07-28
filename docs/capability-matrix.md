# Framework Lab 支持能力矩阵

| 能力 | 状态 | 边界 |
|---|---|---|
| NCom Gap/Priority/Component Family | 已实现并在 57 个 public components 上运行 | Family 只按结构候选且需显式复核；不是语义聚类 |
| Knowledge Quality/Conflict/Economics | 已实现 | 逐维启发式、严格结构冲突、无伪精确总分或 ROI |
| 12 项 Raw/Knowledge-first Context 评测 | 已实现 | 字符估计；12 项人工质量复核仍 pending |
| 外部 Coding Agent Demo | 3 个成功会话 | 手动启动、单框架小样本、无浏览器行为验证 |
| 配置驱动 baseline | 已实现并由 NCom 验证 | 未验证第二个真实框架 |
| 结构化错误事件 | 已实现并回放 Run 009/010 | 仅覆盖已测试文本格式 |
| 证据知识卡与最小上下文 | 已实现 | 非 RAG、非语义理解 |
| Git tracked Catalog | 已实现并由 NCom 验证 | 只索引元数据，不复制源码 |
| Workspace/package 关系 | 已实现确定性关系 | 不解析源码调用关系 |
| Markdown 章节和示例入口 | 已实现 | 不生成自然语言总结 |
| TypeScript AST、导出链与组件索引 | 已实现并由 NCom 验证 | 仅 TypeScript/TSX；组件识别依赖配置与结构证据 |
| 任务级符号检索与上下文组装 | 已实现并以三个 NCom 任务验证 | 确定性符号/关系检索，非语义理解或 RAG |
| Agent Context 开发任务 A/B 验证 | 已完成一次 NCButton 探索性实验 | 单框架、单任务、双会话；无精确 usage，不能外推统计效果 |
| 自动修复、浏览器自动化、Agent 驱动 | 未实现 | 不属于当前版本 |
# 能力矩阵

| 版本 | 能力 | 证据边界 |
|---|---|---|
| v0.2.0 | 单框架受控任务、worktree、handoff、policy、独立验证与对照 | 仅在 NCom 完成真实任务；Agent 由用户侧启动；浏览器行为仍需人工确认 |
| v0.2.1 | 学习主题、受限证据、审核发布知识与 knowledge-first Context | 只表示结构化知识覆盖；不自动调用 Agent 或发布草稿 |
