# Run 006：受支持环境基线

## 范围与证据等级

本轮只验证 NCom v0.1.1 基线，不形成知识卡，不修改上游源码。测试 commit 为 `faf42ba101975befb79629c63d92e962194e4abe`。完整 install 与 build stdout 未保存，相关结论标记为 `user-executed`，并使用依赖元数据、Git tree、package manifest 与当前环境复核交叉验证；lint 于 2026-07-22 无写入复跑并取得完整计数。

## Preflight

| 项目 | 结果 |
| --- | --- |
| OS | Windows 10 Home China 22H2，build 19045.6466，x64 |
| PowerShell | 5.1.19041.6456 Desktop |
| Node | v24.18.0，`D:\node24\node.exe` |
| npm | 11.7.0 |
| Corepack | 0.35.0 |
| 普通 PATH pnpm | 预检时不可用；`where.exe pnpm` 无结果 |
| 固定 pnpm | 10.26.1，`.framework-tools/pnpm-10.26.1/node_modules/.bin/pnpm.cmd` |
| 测试工作树 HEAD | `faf42ba101975befb79629c63d92e962194e4abe` |
| 测试工作树状态 | 仅有七个未跟踪 `node_modules/` 目录，无已跟踪文件修改 |

## Frozen install

命令：`pnpm install --frozen-lockfile`，实际执行器为固定的 pnpm 10.26.1。结果为成功（user-executed）。完整 stdout 未保存；当前 `node_modules/.modules.yaml` 记录 `packageManager: pnpm@10.26.1` 和 2026-07-21 的 prune 时间，可验证依赖安装状态。`pnpm-lock.yaml` 和 package manifests 没有已跟踪修改。

这说明 ISSUE-NCOM-001 绑定的旧 commit `4c1fdf7` 问题在 `faf42ba` 的后续验证中不再复现；不能据此改写旧 commit 的失败事实。

## Lint

命令：`pnpm lint:eslint`。2026-07-22 在 Node v24.18.0、pnpm 10.26.1 下复跑，exit code 1，共 **41 problems（30 errors、11 warnings）**；其中 30 errors 和 2 warnings 被 ESLint 标记为 potentially fixable。复跑前后 Git 状态一致，没有已跟踪文件变化。

失败包括 Prettier 格式规则和 `prefer-const` errors，以及未使用变量/禁用指令 warnings。这里只记录基线，不修改上游文件，也不把 lint 失败扩展解释为框架完全不可用。

## Build

命令：`pnpm build`。结果为失败（user-executed），完整 stdout 未保存。已确认的调用链为根 `build` → `@ncom/all` 的 `build` → `build:theme` → `@ncom/theme` 的 `build` → `node scripts/build.mjs`。

`packages/all/package.json` 在 `faf42ba` 中确实声明了 build scripts，因此旧版“`@ncom/all` 缺少 build script”的疑点已被实际运行和 manifest 证据否定。真正失败点是 `packages/theme/package.json` 引用 `node scripts/build.mjs`，但 Git tree 不含 `packages/theme/scripts/build.mjs`；Node 以 `MODULE_NOT_FOUND` 退出。该问题记录为 `ISSUE-NCOM-002`，不提供未经验证的修复方案。

## Upstream status

基础工作树仍停在 `4c1fdf745afe1d08c1c00c3de3b11feb9d5b71ac` 且 `git status --short` 为空；测试工作树停在 `faf42ba101975befb79629c63d92e962194e4abe`，仅有安装生成的未跟踪 `node_modules/`；本地 `origin/main` 为 `0eddf72d37579c3670770c0f73d22ffc769d3a12`。

`faf42ba..0eddf72` 只有一个 commit，但不是 README-only：共 15 个文件、286 insertions、23 deletions，涉及 changeset、各 package 的 CHANGELOG/package.json 和 `packages/all/README.md`。最新 commit 仍未包含 `packages/theme/scripts/build.mjs`，且 `packages/theme/package.json` 仍引用该路径。

## Final summary

最终状态为 **baseline-partial**：frozen install 已成功，项目 lint/build 命令已真正执行，环境和工具链不再是阻塞项；当前失败来自仓库 lint 基线和已确认的 theme build 入口缺失。typecheck 与 test 入口未提供；example、HTTP 和浏览器行为尚未验证。

原始证据索引位于 `raw/run-006/README.md`。缺失的 install/build 完整 stdout 明确保持为未验证项，不补写模拟输出。
