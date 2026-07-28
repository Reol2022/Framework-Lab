# Framework Lab 面试 Demo

## 10 分钟演示路径

1. 说明问题：新兴框架知识会变化，Coding Agent 直接读全仓库缺少版本与验证边界。
2. 展示固定 commit 的 Catalog 与 Symbol Snapshot。
3. 执行 Gap/Family/Quality：

```powershell
pnpm framework-lab learn gaps ncom
pnpm framework-lab learn prioritize ncom
pnpm framework-lab learn families ncom
pnpm framework-lab learn quality ncom
pnpm framework-lab learn conflicts ncom
```

4. 展示 Knowledge 生命周期：Topic → Bundle → Draft → validate → review → publish。
5. 执行固定任务评测：

```powershell
pnpm framework-lab learn validate-evaluation ncom
pnpm framework-lab learn evaluate ncom
pnpm framework-lab learn economics ncom
```

6. 对照 `results-first-pass.json` 与最终 `results.json`，说明过宽召回如何被证据发现。
7. 展示 Demo B：两组都 build 通过；Knowledge-first 少搜索但实际 input usage 更高。
8. 最后强调边界：只验证 NCom，不自动调用 Agent，不证明真实 token 或生产 ROI。

## 可复现证据

- 22 个 published unit。
- 3 个显式复核组件族。
- 12 个固定任务。
- 3 个成功 Coding Agent 会话。
- Schema、metrics、patch、lint/build 与 worktree 状态。

不要演示原始 Agent session、机器路径、node_modules、完整 Catalog/Symbol Snapshot 或本地 worktree。
