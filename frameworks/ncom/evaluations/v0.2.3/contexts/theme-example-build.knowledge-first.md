# Agent Context: eval-v023-theme-example-build-knowledge-first

## Task

说明 NCom 主题、example 和 Framework Lab baseline 的验证链，区分 build 与浏览器行为验证。

## Framework and Version Scope

- Commit: a350b576bbeae6c6254273037a17d2a8730fb80f
- OS: unknown
- Node: unknown
- Package manager: unknown
- Catalog: a350b576bbeae6c6254273037a17d2a8730fb80f / sha256:0dbfa378eedaaef0b31867b679e7932157eb63bb0cc4e3fa0fb0a0d1869c6518
- Symbols: a350b576bbeae6c6254273037a17d2a8730fb80f / sha256:52e4461d185ce375263aca5e412b2d93f402d906867bf0940bffc9807eec6297

## Development Constraints

- Run 009 与 Run 010 对照使用原始和独立候选 worktree，历史证据不得由候选修复覆盖。

## Public API and Components

- **symbol: RouteNode** — type RouteNode = { /** * 路由路径，可以带通配符*，可以带参数 /: */ path: string; /** * 路由对应模块对象或类或模块类名 */ component?: CustomElementConstructor | Function | undefined; /** * 参数名数组 */ params?: string[]; /** * 子路由数组 */ children?: RouteNode[]; /** * 是否缓存，默认 false */ cache?: boolean; /** * 进入路由事件方法 */ onEnter?: (component: NComponent, url: string) => void; /** * 离开路由事件方法 */ onLeave?: (component: NComponent, url: string) => void; } (score=22, confidence=high, evidence=packages/extensions/src/router/types.ts:6)
- **symbol: NComponent** — class NComponent extends HTMLElement (score=14, confidence=high, evidence=packages/core/src/component.ts:18)
- **symbol: Route.path** — path: string | undefined (score=14, confidence=medium, evidence=packages/extensions/src/router/route.ts:24)

## Validated Knowledge Claims

- The bounded evidence contains example-related declarations and package metadata for this commit. [K:ncom-example-workflow:E1]
- 锁定的 Framework Lab 配置把 install、lint、build 作为顺序 baseline steps，并将 build 标记为必需步骤。 [K:ncom-theme-style-verification-structure:E1] [K:ncom-theme-style-verification-structure:E2] [K:ncom-theme-style-verification-structure:E3] [K:ncom-theme-style-verification-structure:E4]
- 当前 baseline 配置以固定 pnpm 执行 install、lint:eslint 和 build；example/package.json 另登记 dev 与 build 脚本。 [K:ncom-theme-example-build-chain-workflow:E1] [K:ncom-theme-example-build-chain-workflow:E2] [K:ncom-theme-example-build-chain-workflow:E3] [K:ncom-theme-example-build-chain-workflow:E4]
- Framework Lab 配置中的框架 id 为 ncom，名称为 New Component。 [E1]
- Run 009 的首个阻塞错误是 Sass “Can't find stylesheet to import.”，位置为 packages/components/src/alert/style.scss:1:1。 [E2]
- 受控 Run 使用 win32 10.0.19045 x64、Node v24.18.0、npm 11.7.0 和 pnpm 10.26.1。 [E3]
- 基线依次运行 pnpm install --frozen-lockfile、lint:eslint 和 build。 [E4]
- 候选补丁只修改 packages/all/build/shared.ts，移除 createStyleConfig 的 additionalData。 [E5]
- Run 010 的 build passed，lint 仍 failed 且最终状态为 partial。 [E6]
- Run 009 与 Run 010 对照使用原始和独立候选 worktree，历史证据不得由候选修复覆盖。 [E7]

## Limitations and Confidence

- 本卡不描述未由现有证据验证的 NCom 架构或 API。
- 只在记录的 Windows 10 环境与该精确 commit 上观察到；不外推到所有 Windows 或 CJK 路径。
- 该环境记录不证明其他 Windows、Node 或 pnpm 组合等价。
- lint 在 Run 009/010 中仍失败并被配置为 allow_failure。
- lint 仍失败。
- 浏览器与功能回归未验证。
- 不声明上游已修复或补丁适用于所有版本。
- 该约束描述 Framework Lab 本次受控工作流，不代表 NCom 上游流程。
- TypeScript semantic analysis is limited by unresolved modules and diagnostics.
- knowledge-first: 3 published units; raw fallback candidates=11

## Evidence Index

- [E1] framework_config: frameworks/ncom/framework.yaml; commit=a350b576bbeae6c6254273037a17d2a8730fb80f; sha256=f527d5b9c0a28110c597485de3505d46c53cf3c8843c055cde284d620ff76cf1
- [E2] run_error: frameworks/ncom/runs/run-009/errors.json; run=run-009; step=build; event=error-3505c778db1c; commit=a350b576bbeae6c6254273037a17d2a8730fb80f; sha256=954792c91f94bf29c6af8ca1c26d27c376e8f16e535b83bcf23f7620ad8b5fe4
- [E3] run: frameworks/ncom/runs/run-010/environment.json; run=run-010; commit=a350b576bbeae6c6254273037a17d2a8730fb80f; sha256=3230b372ea0c44d5b804efb33a35ba4f1d1525c8270a23c7174e827a542fe6b5
- [E4] framework_config: frameworks/ncom/framework.yaml; commit=a350b576bbeae6c6254273037a17d2a8730fb80f; sha256=f527d5b9c0a28110c597485de3505d46c53cf3c8843c055cde284d620ff76cf1
- [E5] patch: frameworks/ncom/patches/ISSUE-NCOM-CJK-SASS-001.patch; commit=a350b576bbeae6c6254273037a17d2a8730fb80f; sha256=e4c0112fd30ac7ca2e701fa2793cbe55f1e641dbf75bb07cf57a00e1c7f3b81d
- [E6] run: frameworks/ncom/runs/run-010/run.json; run=run-010; step=build; commit=a350b576bbeae6c6254273037a17d2a8730fb80f; sha256=3fc675efc6117ec5b96b03846ed4f5f6632826f13b0d46d824dd786e4a037617
- [E7] comparison_report: frameworks/ncom/reports/run-009-vs-run-010-cjk-sass-fix.md; commit=a350b576bbeae6c6254273037a17d2a8730fb80f; sha256=789b3bd546af7c8e8be24a6eed81e73f82ebb79f362d11ec4a1d9999265e01ca
- [R1] retrieval: packages/extensions/src/router/types.ts:6-41; sha256=00039519ef59c32d00faa9037be545e03e8bc1f79565e868ea9893864f6afdca
- [R2] retrieval: packages/core/src/component.ts:18-348; sha256=44590f0a625da3d091abffd8518f6c4998aeae9821fa10834edf61ed51b00240
- [R3] retrieval: packages/extensions/src/router/route.ts:24-24; sha256=a364d6bf21c7a4c6b6d465f2b02509b4756e02d79ef2d86762ebfacbc8bb824c
- [R4] retrieval: frameworks/ncom/runs/run-010/environment.json:?-?; sha256=3230b372ea0c44d5b804efb33a35ba4f1d1525c8270a23c7174e827a542fe6b5
- [R5] retrieval: frameworks/ncom/framework.yaml:10-26; sha256=f527d5b9c0a28110c597485de3505d46c53cf3c8843c055cde284d620ff76cf1
- [R6] retrieval: frameworks/ncom/framework.yaml:1-6; sha256=f527d5b9c0a28110c597485de3505d46c53cf3c8843c055cde284d620ff76cf1
- [R7] retrieval: frameworks/ncom/runs/run-009/errors.json:?-?; sha256=954792c91f94bf29c6af8ca1c26d27c376e8f16e535b83bcf23f7620ad8b5fe4
- [R8] retrieval: frameworks/ncom/patches/ISSUE-NCOM-CJK-SASS-001.patch:1-28; sha256=e4c0112fd30ac7ca2e701fa2793cbe55f1e641dbf75bb07cf57a00e1c7f3b81d
- [R9] retrieval: frameworks/ncom/runs/run-010/run.json:?-?; sha256=3fc675efc6117ec5b96b03846ed4f5f6632826f13b0d46d824dd786e4a037617
- [R10] retrieval: frameworks/ncom/reports/run-009-vs-run-010-cjk-sass-fix.md:1-68; sha256=789b3bd546af7c8e8be24a6eed81e73f82ebb79f362d11ec4a1d9999265e01ca
- [R11] retrieval: packages/extensions/package.json:1-34; sha256=c3c9f1aae8b2defb334d034b4eb884038c8aa1bb7b57430ae22e58806e8b040b
- [R12] retrieval: packages/core/package.json:1-31; sha256=9567549c72deaf29b9292be557c3aaef35eb9d5acc948a18fd414bb8acc615fa
