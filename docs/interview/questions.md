# Framework Lab 面试问题

## 1. 为什么不直接让 Agent 读全部源码？

全量读取缺少 commit、证据与预算边界。Framework Lab 先用 Catalog/Symbol 建立可追溯索引，再提供有限 Context；Raw fallback 仍保留。

## 2. 这和 RAG 有什么区别？

当前是确定性本地检索：结构化 ID、关系、关键词、Scope 和透明权重；没有 embedding、向量数据库或在线语义服务。

## 3. 为什么不用向量数据库？

当前 NCom 规模下，精确 Symbol/Component 和导出关系已经可用；向量召回会引入新依赖、不可解释排序和评估成本，尚无证据证明必要。

## 4. 如何避免 AI 总结错误？

Claim 必须绑定 Bundle Evidence id，校验 commit/rootHash/SHA，推断不能直接发布，review 与 publish 分离。

## 5. 框架更新后怎么办？

复用 Catalog/Symbol diff，只对精确 Evidence/结构引用传播 impact。未受影响知识保持 current；受影响项生成 refresh plan，不自动改写。

## 6. 怎么证明 Context 有用？

固定任务集同时生成 Raw/KF Context，记录 recall、fallback、字符估计，再用同条件外部 Agent 比较命令、读取、搜索、diff 与验证。

## 7. 为什么不能只看 Context 长度？

Demo B 中 KF Context 更短、搜索更少，但真实 Agent input usage 更高。Context 长度不是整个会话成本。

## 8. Agent 为什么不能直接信任？

Agent 输出可能越界或构建失败。任务 worktree、change policy、独立 diff、lint/build 和行为验收提供外部约束。

## 9. 为什么使用 Git worktree？

它从精确 commit 创建隔离目录，允许并行 Raw/KF 对照，避免污染原始源码，并能用 Git 精确检查修改边界。

## 10. 组件族怎么生成？

只根据共享 base type、event、slot 产生候选。候选不自动获得语义名称；必须显式复核成员和限制。

## 11. Priority Score 为什么可信？

它不是“可信真值”，而是透明排序启发式。每个 business、centrality、evidence、demand、reuse、validation、risk 因子和公式都输出。

## 12. 冲突检测为什么结果为 0？

检测器只报告相同 structured target/claim key 的不同 value。0 表示未发现这种严格冲突，不表示不存在语义矛盾。

## 13. Knowledge Quality 为什么没有总分？

Evidence、freshness、API support 与 workflow verification 不可互相抵消。合成单分会制造虚假精度，因此逐维展示。

## 14. 为什么 Learning Agent Draft 没发布？

真实 Agent 在无 bounded excerpt 时输出 0 Claim。它通过 Schema/validate，但没有可复用事实价值，所以保留 Draft。

## 15. 如何保证可复现？

固定 commit/rootHash、相对路径、SHA256、稳定 businessHash、固定任务集和固定 pnpm；时间戳不参与业务 hash。

## 16. 当前最大限制是什么？

只验证 NCom，人工质量项仍多，浏览器验证未自动化，组件族不是语义模型，Agent Demo 样本很小。

## 17. 如何支持第二框架？

先提供 framework.yaml、Catalog/Symbol 配置和真实 baseline，再用同一 Schema 与评测流程验证；不能只复制 NCom 特判。

## 18. 为什么 Raw fallback 不能删除？

Published Knowledge 覆盖有限、可能过时或过度压缩。Raw evidence 是发现缺口和验证知识的安全出口。

## 19. 出过什么问题？

首轮 Knowledge-first 召回通用词过多，平均 Context 比 Raw 更长；保留失败结果后收紧停止词、精确 ID 和选择上限。

## 20. 替代方案是什么？

可选方案包括全仓库搜索、人工框架手册、传统 RAG 或 IDE 索引。Framework Lab 选择证据和版本优先，代价是知识生产与复核成本。
