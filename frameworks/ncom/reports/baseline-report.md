# NCom v0.1.1 基线报告

> 当前状态：**baseline-partial**。`faf42ba` 已在受支持环境完成 frozen install，且 lint/build/example 已进入项目命令；剩余失败来自仓库 lint 问题、缺失的 theme build 入口，以及 example 对不存在的 theme dist 文件的引用。

## 当前锁定状态

| 项目 | 值 |
| --- | --- |
| 基线 commit | `faf42ba101975befb79629c63d92e962194e4abe` |
| 根 package 版本 | `0.0.8` |
| 环境 | Windows 10 Home China 22H2 build 19045.6466；PowerShell 5.1.19041.6456 |
| Node / npm | v24.18.0 / 11.7.0 |
| pnpm | 仓库固定路径 10.26.1；普通 PATH 在预检时不可用 |
| 测试工作树 | 无已跟踪文件修改；存在安装生成的未跟踪 `node_modules/` 目录 |
| 最新本地上游引用 | `origin/main` = `0eddf72d37579c3670770c0f73d22ffc769d3a12` |

## 各轮结果

| Run | Commit | Node | pnpm | 主要变量变化 | Install | Lint | Build | Example | 最终状态 | 失败分类 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 001 | `4c1fdf7` | v21.7.3 | 目标 10.26.1，未取得 | 首次基线；Corepack 下载 pnpm 失败 | Blocked | Blocked | Blocked | Not Run | baseline-blocked | local-environment/tooling |
| 002 | `4c1fdf7` | v21.7.3 | PATH 11.9.0 | 发现 PATH 版本与固定要求不符，停止项目命令 | Not Run | Not Run | Not Run | Not Run | baseline-blocked | local-environment/tooling |
| 003 | `4c1fdf7` | v21.7.3 | 固定 10.26.1 | 改用显式可执行路径 | `ERR_PNPM_OUTDATED_LOCKFILE` | Not Run | Not Run | Not Run | baseline-blocked | developer-experience |
| 004 | `faf42ba` | 原始输出缺失 | 固定 10.26.1 | 新建独立测试工作树并首次尝试 frozen install | user-executed；结果未从完整日志保留 | Not Run | Not Run | Not Run | inconclusive | evidence-gap |
| 005 | `faf42ba` | 原始输出缺失 | 固定 10.26.1 | 支持环境准备与重复安装尝试 | user-executed；完整 stdout 缺失 | Not Run | Not Run | Not Run | inconclusive | evidence-gap |
| 006 | `faf42ba` | v24.18.0 | 固定 10.26.1 | 受支持 Node；固定 pnpm 目录加入 PATH 供嵌套脚本解析 | Passed（user-executed） | Failed：30 errors、11 warnings | Failed：`MODULE_NOT_FOUND` | Not Run | baseline-partial | framework-bug / lint failure |
| 007 | `faf42ba` | v24.18.0 | 固定 10.26.1 | 启动真实 Vite example，执行 HTTP 与人工浏览器检查 | Reused | Not Run | Not Run | Failed：Vite overlay，deepblue theme import 无法解析 | baseline-partial | example-error / missing build artifact |

Run 004 与 Run 005 的 PowerShell 命令历史仍在，但 stdout 未保存；表中不依据命令顺序猜测 Node 版本或退出码。Run 006 的完整 install/build stdout同样缺失，详细证据等级见 `run-006-supported-environment-baseline.md`。

## 已确认结论

### 旧 commit 4c1fdf7

固定 pnpm 10.26.1 的 frozen install 因 `packages/all/package.json` 与 `pnpm-lock.yaml` importer 不一致失败，证据保留在 `raw/run-003/02-install.log` 和 ISSUE-NCOM-001。该历史事实不因后续版本成功而删除。

### 新 commit faf42ba

- Frozen install 在 Node v24.18.0、pnpm 10.26.1 下成功；已跟踪的 lockfile 和 package manifests 没有修改。
- `pnpm lint:eslint` 退出 1，共 41 problems：30 errors、11 warnings。
- 根 build 已实际进入 `@ncom/all`，证明该 workspace 缺少 build script 的旧疑点不成立。
- `@ncom/all` 继续进入 `@ncom/theme`；theme manifest 调用 `node scripts/build.mjs`，但 Git tree 中没有 `packages/theme/scripts/build.mjs`，最终以 `MODULE_NOT_FOUND` 失败。
- typecheck 和 test 入口未提供。
- Run 007 确认 example 服务器可监听 3000，首页 HTML 与抽查静态资源返回 200，但应用入口返回 500；用户浏览器显示 Vite import-analysis overlay，Browser Behavior 为 Failed。
- `example/vite.config.ts` 将 deepblue theme alias 到不存在的 `packages/theme/dist/ncom-deepblue.css`；`packages/theme/dist/` 整体缺失。该事实与 ISSUE-NCOM-002 的 theme build 入口缺失相关，但上游预期的产物生成方式尚未验证。

## Issue 状态

- ISSUE-NCOM-001：绑定 `4c1fdf7` 的 frozen lockfile mismatch；旧问题保留，状态更新为在后续 commit `faf42ba` 已解决。
- ISSUE-NCOM-002：绑定 `faf42ba` 的 theme build entry missing；severity high、status confirmed、category framework-bug。

## 上游版本影响

`4c1fdf7..faf42ba` 共 222 个文件、10631 insertions、1660 deletions，涉及 package/发布结构、组件、示例、文档与 `pnpm-lock.yaml`。详见 `change-impact-4c1fdf7-to-faf42ba.md`。

`faf42ba..0eddf72` 共 15 个文件、286 insertions、23 deletions，涉及 changeset、CHANGELOG、package manifests 和 README，明确不是 README-only；最新 commit 仍缺少 theme build entry。

## 当前风险与边界

当前工具链不再阻塞基线，但 lint 未通过、build 存在已确认仓库缺陷，example 浏览器验证也因缺失 theme dist 失败，不能写成 `baseline-passed`。这仍不等于 NCom 整体不可用。本阶段没有创建或修改 NCom 知识卡。

## 原始日志索引

- Run 001：`frameworks/ncom/reports/raw/` 根目录的九份日志。
- Run 002：`frameworks/ncom/reports/raw/run-002/`。
- Run 003：`frameworks/ncom/reports/raw/run-003/`。
- Run 004–005：未保存完整原始日志，状态明确为 evidence-gap。
- Run 006：`frameworks/ncom/reports/raw/run-006/README.md`；该索引区分 user-executed、复核事实和缺失 stdout。
- Run 007：`frameworks/ncom/reports/raw/run-007/` 与 `frameworks/ncom/reports/run-007-example-browser-smoke.md`。
