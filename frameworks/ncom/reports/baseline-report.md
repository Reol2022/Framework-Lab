# NCom v0.1.1 基线报告

> 最终状态：**baseline-blocked**。Run 001 因 Corepack 无法取得 pnpm 阻塞；Run 002 因 PATH 命中 pnpm `11.9.0` 而停止；Run 003 通过显式路径使用精确 pnpm `10.26.1`，但 frozen install 确认仓库锁文件不一致。本报告不包含 NCom API、能力或内部机制总结。

## 仓库锁定

| 项目 | 结果 | 状态 |
| --- | --- | --- |
| 仓库 | `https://gitee.com/weblabsw/ncom` | Passed |
| 分支 | `main` | Passed |
| Commit | `4c1fdf745afe1d08c1c00c3de3b11feb9d5b71ac` | Passed |
| 根版本 | `0.0.1-alpha.2` | Passed |
| Package manager 声明 | `pnpm@10.26.1`；engines 要求 `pnpm >=10.26.1`；`.npmrc` 启用 `engine-strict=true` | Passed |
| Lockfile | `pnpm-lock.yaml`，lockfileVersion `9.0` | Passed |
| Workspace | `packages/*` 与 `example` | Passed |

## Run 001 — 2026-07-17

Run 001 的结果保持不变，原始日志仍位于 `frameworks/ncom/reports/raw/` 根目录。

| 步骤 | 结果 | 状态 |
| --- | --- | --- |
| Node | `v21.7.3` | Passed |
| Corepack | `0.25.2` | Passed |
| pnpm | PATH 中不存在；Corepack 下载 `10.26.1` 失败 | Blocked |
| Install | Corepack 在取得 pnpm 前退出 1 | Blocked |
| Lint | Corepack 在取得 pnpm 前退出 1 | Blocked |
| Typecheck | 仓库未提供 script | Not Provided |
| Test | 仓库未提供 script | Not Provided |
| Build | Corepack 在取得 pnpm 前退出 1 | Blocked |
| Example | 未启动服务 | Blocked |
| 浏览器行为 | 未执行 | Not Verified |

Run 001 结论：`baseline-blocked`。该结果没有被 Run 002 覆盖或改写为成功。

## Run 002 — 2026-07-19

### 预检

工作目录：`.framework-sources/ncom`。

| 命令 | 实际结果 | Exit code | 状态 |
| --- | --- | ---: | --- |
| `git rev-parse HEAD` | `4c1fdf745afe1d08c1c00c3de3b11feb9d5b71ac` | 0 | Passed |
| `git status --short` | 空输出 | 0 | Passed |
| `node --version` | `v21.7.3` | 0 | Passed |
| `npm --version` | `11.7.0`；stderr 警告不支持 Node 21.7.3 | 0 | Passed |
| `corepack --version` | `0.25.2` | 0 | Passed |
| `pnpm --version` | `11.9.0` | 0 | Failed（version mismatch） |
| `where.exe pnpm` | `C:\Users\Reol\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd` | 0 | Passed |

Commit 与上游清洁状态满足要求，但 pnpm 必须精确为 `10.26.1`，实际为 `11.9.0`。因此没有自动切换版本，并立即停止项目命令。

### 项目命令

| 步骤 | 命令 | Exit code | 状态 | 说明 |
| --- | --- | ---: | --- | --- |
| Install | `pnpm install --frozen-lockfile` | N/A | Not Run | pnpm 版本预检失败；未修改 lockfile，未更新依赖 |
| Lint | `pnpm lint:eslint` | N/A | Not Run | install 未执行 |
| Typecheck | 检查 root 与全部 workspace `package.json` | 0 | Not Provided | 未发现 typecheck script |
| Test | 检查 root 与全部 workspace `package.json` | 0 | Not Provided | 未发现 test script |
| Build | `pnpm build` | N/A | Not Run | 未验证 `@ncom/all` build 疑点 |
| Example | `pnpm dev:example` | N/A | Not Run | 未启动进程、未监听端口、未发 HTTP 请求 |
| 浏览器行为 | 未执行 | N/A | Not Verified | 未把服务启动尝试等同于浏览器验证 |
| 最终上游状态 | commit 不变，`git status --short` 为空 | 0 | Passed | 上游副本保持干净 |

### Build 风险与 issue 决策

根 `build` script 调用 `@ncom/all` 的 `build`，而当前 `packages/all/package.json` 未声明 scripts。Run 002 因 pnpm 版本不符没有执行 build，所以该疑点仍是 **Not Verified**，不能认定为 framework bug 或 example error。

本次未创建 issue。pnpm 版本不一致属于本地工具链问题，不是 NCom issue。

### Example 冒烟

- 服务监听：Not Run。
- 最小 HTTP 请求及状态码：Not Run。
- 进程清理：无需执行，进程未启动。
- Browser behavior：Not Verified。

## Run 003 — 2026-07-19

### 工具链解析

| 项目 | 实际结果 | 状态 |
| --- | --- | --- |
| PATH pnpm | `11.9.0`；`C:\Users\Reol\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd`；仅作诊断，不用于项目命令 | Passed |
| 固定 pnpm | `10.26.1`；`.framework-tools/pnpm-10.26.1/node_modules/.bin/pnpm.cmd` | Passed |
| 解析来源 | 环境变量 `FRAMEWORK_LAB_PNPM` 的显式可执行路径 | Passed |
| Commit | `4c1fdf745afe1d08c1c00c3de3b11feb9d5b71ac` | Passed |
| 执行前工作树 | 空 | Passed |

PATH 版本与固定版本不同，是因为 Codex runtime 的 fallback 目录位于 PATH；Run 003 没有使用普通 `pnpm` 执行项目命令，权威版本来自 `& $env:FRAMEWORK_LAB_PNPM --version`。

### 项目命令

| 步骤 | 命令 | Exit code | 状态 | 实际结果 |
| --- | --- | ---: | --- | --- |
| Install | `& $env:FRAMEWORK_LAB_PNPM install --frozen-lockfile` | 1 | Failed | `ERR_PNPM_OUTDATED_LOCKFILE`；`packages/all` importer 与当前 package 清单相差 11 项依赖 |
| Lint | `& $env:FRAMEWORK_LAB_PNPM lint:eslint` | N/A | Not Run | frozen install 失败后停止 |
| Typecheck | 检查 root 与全部 workspace `package.json` | 0 | Not Provided | 未发现 typecheck script |
| Test | 检查 root 与全部 workspace `package.json` | 0 | Not Provided | 未发现 test script |
| Build | `& $env:FRAMEWORK_LAB_PNPM build` | N/A | Not Run | install 失败；未确认缺少 build script 的运行结果 |
| Example | `& $env:FRAMEWORK_LAB_PNPM dev:example` | N/A | Not Run | 未启动服务、未监听端口、未发 HTTP 请求 |
| Browser behavior | 未执行 | N/A | Not Verified | 无真实浏览器测试 |

安装前后 `pnpm-lock.yaml` SHA-256 均为 `609AF3246DB2DE9794FEBF2C42321C81B0CC9E88FC3DB69505CDCE8B033A7E07`，根 `package.json` 哈希也保持不变。没有使用 `--no-frozen-lockfile`，没有更新依赖或上游文件。

### 已确认问题与 build 疑点

Run 003 确认的是 frozen install 元数据一致性问题，已创建 `issues/ISSUE-NCOM-001-frozen-lockfile-mismatch.yaml`，分类为 `developer-experience`、状态为 `confirmed`，适合提交上游。

此前 `@ncom/all` 缺少 build script 的疑点仍为 **Not Verified**：build 没有执行，因此不能提前认定为 framework bug。

## 工作流反馈

Run 002 说明 PATH 中的包管理器版本不能作为唯一依据；可复现实验应支持显式可执行路径绑定。现有 manifest 的 `environment` 允许附加字段，因此 Run 003 已记录 `executable_path`、`resolution_source`、`requested_version` 和 `resolved_version`，无需修改 Schema。后续可评审将这些字段标准化到 framework manifest 或 run record。

## 可复现性结论与下一步

最终状态继续为 **baseline-blocked**。显式固定 pnpm 的工具链阻塞已经解除，但仓库自身的 frozen-lockfile 一致性问题阻止依赖安装，lint、build 和 example 均未验证。当前不具备进入第一个学习切片的条件。

下一步只应由上游确认并修复锁文件一致性问题，再使用同一显式 pnpm `10.26.1` 路径重跑 frozen install。不得使用非 frozen 安装绕过，也不得在 build 实际执行前确认 `@ncom/all` 构建问题或开始 NCom 知识学习。

## 原始日志索引

Run 001：`frameworks/ncom/reports/raw/` 下已有的九份日志，全部保留。

Run 002：

- `raw/run-002/01-preflight.log`
- `raw/run-002/02-install.log`
- `raw/run-002/03-lint.log`
- `raw/run-002/04-typecheck.log`
- `raw/run-002/05-test.log`
- `raw/run-002/06-build.log`
- `raw/run-002/07-example-smoke.log`
- `raw/run-002/08-upstream-status.log`

Run 003：

- `raw/run-003/01-preflight.log`
- `raw/run-003/02-install.log`
- `raw/run-003/03-lint.log`
- `raw/run-003/04-typecheck.log`
- `raw/run-003/05-test.log`
- `raw/run-003/06-build.log`
- `raw/run-003/07-example-smoke.log`
- `raw/run-003/08-upstream-status.log`
