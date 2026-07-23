# Run 007：NCom example 开发模式与浏览器冒烟

## 范围

本轮只验证 commit `faf42ba101975befb79629c63d92e962194e4abe` 的 example 开发服务器、HTTP 响应和浏览器人工检查入口，不运行生产 build，不修改 NCom 源码、配置、package manifest 或 lockfile。

`faf42ba..0eddf72` 的实际 Git diff 涉及 15 个 changeset、CHANGELOG、README 和 package manifest 文件，并非 README-only，因此本轮行为结果不能外推为 `0eddf72` 已验证。

## 环境

| 项目 | 结果 |
| --- | --- |
| OS | Windows 10 Home China 22H2，build 19045，x64 |
| PowerShell | 5.1.19041.6456 Desktop |
| Node | v24.18.0，`D:\node24\node.exe` |
| npm | 11.7.0 |
| Corepack | 0.35.0 |
| pnpm | 仓库固定路径 10.26.1 |
| 测试 commit | `faf42ba101975befb79629c63d92e962194e4abe` |

## 启动命令依据

根 `package.json` 提供 `dev:example: pnpm --filter ncom-example dev`；`example/package.json` 中 package 名为 `ncom-example`，其 `dev` script 为 `vite`；`pnpm-workspace.yaml` 包含 `example`；锁定 README 也列出 `pnpm dev:example`。

实际命令为 `& $env:FRAMEWORK_LAB_PNPM dev:example`，执行目录为 `.framework-sources/ncom-faf42ba`。子进程 PATH 首位为固定 pnpm 10.26.1 所在目录。

`example/vite.config.ts` 设置 `host: true`、`port: 3000`、`open: true`；未设置 `base`，使用 Vite 默认 `/`；未设置 `strictPort`，因此 3000 是首选端口而非强制端口，端口占用时允许自动递增。

## 开发服务器结果

Vite 7.3.6 在 4954 ms 后就绪，实际 URL 为 `http://localhost:3000/`，监听进程 PID 为 `19744`。stdout 记录静态复制插件收集 4122 items；服务器仍在运行并等待人工检查。

服务器随后记录阻塞性转换错误：页面入口无法解析 `@ncom/all/theme/deepblue`。该 import 在 Vite HTML proxy 模块中触发，完整堆栈保存在 `raw/run-007/04-example-server.stderr.log`。

## HTTP 结果

| 请求 | StatusCode | Content-Type | 长度 | 结果 |
| --- | ---: | --- | ---: | --- |
| `/` | 200 | `text/html` | 510 bytes | 首页 HTML 返回成功，含 Vite client 与 module entry |
| `/@vite/client` | 200 | `text/javascript` | 179619 bytes | Passed |
| `/css/imgs/logo.png` | 200 | `image/png` | 523370 bytes | Passed |
| `/css/index.css` | 200 | `text/javascript` | 871 bytes | Passed；开发模式 CSS module |
| `/index.html?html-proxy&index=0.js` | 500 | 未返回有效模块 | 0 bytes | Failed；无法解析 deepblue theme import |

结论：`Homepage HTTP: Passed`，已抽查的静态资源返回成功，但应用主入口为 500，因此整体为 **HTTP Smoke: Failed**，不能标记为 Passed。

## 浏览器状态

Vite 配置的 `open: true` 已打开用户浏览器。用户人工观察到 Vite `import-analysis` 错误 overlay，定位到 `example/index.html:15:12` 的 `import "@ncom/all/theme/deepblue"`；应用首页、导航和组件示例没有完成渲染。

**Browser Behavior: Failed**。该结论来自用户实际看到的浏览器 overlay，不再是 HTTP 结果推断。

路径核对进一步确认：`example/vite.config.ts` 将该 import alias 到 `packages/theme/dist/ncom-deepblue.css`，而 `packages/theme/dist/` 在测试工作树中不存在。结合 ISSUE-NCOM-002 已确认的 theme build 入口缺失，当前事实链为“example 引用 dist theme → alias 目标不存在 → Vite 页面入口解析失败”。尚未验证上游预期应提交 dist 还是在启动 example 前生成 dist，因此不提供修复方案。

## 用户人工检查

清单位于 `raw/run-007/06-browser-checklist.md`。异常文字已记录；首页、导航、样式、组件渲染和交互项因页面入口错误保持 Failed、Blocked 或 Not Run。

## 会话与停止方式

会话详情见 `raw/run-007/server-session.json`。当前监听 PID 为 `19744`，会话状态为 `running-manual-browser-check-failed`；如不再需要保留错误页面，可在 PowerShell 执行 `Stop-Process -Id 19744`。停止后应再次确认端口 3000 不再监听，并检查是否有同一命令链的父进程残留。

## 源码边界

启动前后 NCom 工作树均没有已跟踪修改，仅存在安装生成的 `node_modules/` 目录。Run 007 将现有整体状态维持为 `baseline-partial`，未创建知识卡。
