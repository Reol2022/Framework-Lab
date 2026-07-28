# Framework Lab v0.2.3 指标

| 指标 | 值 | 解释 |
|---|---:|---|
| Published Knowledge | 22 | 通过 review/publish 的当前 commit 单元 |
| 新增 Knowledge | 16 | 4 机制、3 家族、6 组件、3 工作流 |
| Public components | 57 | Symbol Snapshot 结构计数 |
| Covered components | 24 | Published Knowledge 唯一 relatedComponents |
| Gap | 146 | 33 个组件 API、96 个非组件 public symbol、17 个机制/工作流主题 |
| Reviewed families | 3 | 显式 CLI 复核 |
| Strict conflicts | 0 | 仅结构化 exact conflict |
| Evaluation tasks | 12 | 固定真实任务 |
| Context shorter/longer/tie | 12/0/0 | 字符启发式估计 |
| Raw estimated mean | 1844.5 | ceil(chars/4) |
| Knowledge-first estimated mean | 1402.17 | ceil(chars/4) |
| Pending manual reviews | 12 | 不计为质量通过 |
| Demo A completed/build | yes/yes | 无浏览器验证 |
| Demo B Raw completed/build | yes/yes | 2 次搜索 |
| Demo B KF completed/build | yes/yes | 0 次搜索，input usage 更高 |

这些值不能被写成真实 token 节省率、生产效率提升或跨框架能力。
