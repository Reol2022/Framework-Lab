# Run 009 与 Run 010：CJK Sass additionalData 修复对照

日期：2026-07-23

## 候选 worktree

创建命令：

```text
git -C .framework-sources/ncom-a350b57 worktree add --detach ../ncom-a350b57-cjk-fix a350b576bbeae6c6254273037a17d2a8730fb80f
```

创建后 HEAD 为 `a350b576bbeae6c6254273037a17d2a8730fb80f`，初始 `git status --short` 无输出。候选目录未复制 `node_modules` 或 `dist`。

## 受控变量

Run 009 与 Run 010 的相同项：

| 项目 | Run 009 | Run 010 |
| --- | --- | --- |
| Base commit | `a350b576bbeae6c6254273037a17d2a8730fb80f` | `a350b576bbeae6c6254273037a17d2a8730fb80f` |
| OS | Windows `10.0.19045` x64 | Windows `10.0.19045` x64 |
| Node | `v24.18.0` | `v24.18.0` |
| npm | `11.7.0` | `11.7.0` |
| pnpm | 配置/实际 `10.26.1` | 配置/实际 `10.26.1` |
| Baseline steps | `install --frozen-lockfile`、`lint:eslint`、`build` | `install --frozen-lockfile`、`lint:eslint`、`build` |

## 唯一源码差异

候选补丁只修改 `packages/all/build/shared.ts`：从 `createStyleConfig` 移除 `preprocessorOptions.scss.additionalData`，不再为非 theme SCSS 注入指向 `packages/theme/index.scss` 的绝对路径 `@use`。

补丁证据：

- `frameworks/ncom/patches/ISSUE-NCOM-CJK-SASS-001.patch`
- SHA256：`e4c0112fd30ac7ca2e701fa2793cbe55f1e641dbf75bb07cf57a00e1c7f3b81d`

Run 010 采集时 `source.json` 将 worktree 标为 `dirty: true`，`changedFiles` 只包含 `packages/all/build/shared.ts`。安装和构建之后出现的未跟踪 `node_modules/`、`dist/` 目录是生成文件，不属于补丁。

## 运行结果

| Step | Run 009 | Run 010 |
| --- | --- | --- |
| install | `passed`，1.352 s | `passed`，13.704 s |
| lint | `failed`，允许失败，10.674 s | `failed`，允许失败，11.297 s |
| build | `failed`，37.208 s | `passed`，57.305 s |
| 最终状态 | `failed` | `partial` |
| 总耗时 | 49.782 s | 82.830 s |

Run 009 使用原始 worktree。其 build 日志记录 Sass 无法导入 additionalData 注入的、包含 CJK 绝对路径的 `packages/theme/index.scss`。

Run 010 使用候选补丁 worktree。install 通过，lint 仍以退出码 1 失败且未隐藏；build 以退出码 0 通过。由于唯一失败步骤允许失败，最终状态为 `partial`。

## 结论

在本次 Windows `10.0.19045`、Node `v24.18.0`、npm `11.7.0`、pnpm `10.26.1` 的受控对照中，移除冗余 additionalData 后，同一 commit、同一环境下构建由失败变为通过。

该结果不证明所有 Windows 版本或所有 CJK 路径都会出现相同行为，也不证明补丁不存在功能回归。补丁尚未被声明为上游修复或维护者已接受的变更。
