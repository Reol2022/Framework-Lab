# NCom 实验工作区

NCom 是 Framework Lab 当前唯一配置的真实验证对象。历史 Run 001 至 Run 007 保留在 `reports/` 与 `reports/raw/`，不得由新运行覆盖。

## v0.1.2 配置

`framework.yaml` 声明以下事实：

- 框架 id 与名称；
- 本地源码目录；
- 固定 pnpm 10.26.1 的仓库相对可执行路径；
- `install`、`lint`、`build` 三个串行步骤；
- 每步参数、超时、是否允许失败，以及前置必需步骤失败后的停止规则。

所有相对路径均从 Framework Lab 仓库根目录解析，TypeScript 中没有 NCom 机器绝对路径。当前 `lint` 为 `allow_failure: true`；它失败而必需步骤通过时，运行状态为 `partial`。`install` 或 `build` 失败时运行状态为 `failed`，后续未执行步骤记为 `skipped`。

运行命令：

```powershell
pnpm framework-lab baseline run ncom --dry-run
pnpm framework-lab baseline run ncom
```

自动运行产物保存在本地 `runs/<run-id>/` 并被 Git 忽略。需要公开报告时，应先脱敏机器路径、用户名和原始大日志，再将摘要放入 `reports/`。

## v0.1.8 Context A/B 实验

在 commit `a350b576bbeae6c6254273037a17d2a8730fb80f` 上完成了 NCButton example 开发的双会话探索性对照。无 Context 和有 Context 两组均保持 example-only 修改边界并通过构建；有 Context 组减少了框架核心源码、类型、导出和文档探索。浏览器真实点击、精确会话 usage 与 Token 降低均未验证。

脱敏报告见 `docs/v0.1.8-ncbutton-context-ab-experiment.md`，结构化指标见 `metrics/runs.jsonl`。实验使用的候选 worktree 已不在当前 worktree 列表中，因此本轮没有重新执行两组 diff 或浏览器行为复验。
