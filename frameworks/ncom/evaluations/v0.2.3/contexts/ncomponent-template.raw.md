# Agent Context: eval-v023-ncomponent-template-raw

## Task

阅读 NComponent 的 template、root 与 Shadow DOM 结构，为修改渲染流程准备最小上下文。

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

- **symbol: NComponent** — class NComponent extends HTMLElement (score=219, confidence=high, evidence=packages/core/src/component.ts:18)
- **symbol: TabItemComponentOption** — interface TabItemComponentOption (score=85, confidence=high, evidence=packages/components/src/tabs/types.ts:41)
- **symbol: ComponentLoader** — type ComponentLoader = (() => Promise<ComponentModule>) | Function (score=85, confidence=high, evidence=packages/core/src/utils/types.ts:74)
- **symbol: CardShadow** — type CardShadow = "always" | "hover" | "never" (score=85, confidence=high, evidence=packages/components/src/card/types.ts:1)
- **symbol: DomUtil** — class DomUtil (score=85, confidence=high, evidence=packages/core/src/utils/domutil.ts:5)
- **symbol: RouteNode** — type RouteNode = { /** * 路由路径，可以带通配符*，可以带参数 /: */ path: string; /** * 路由对应模块对象或类或模块类名 */ component?: CustomElementConstructor | Function | undefined; /** * 参数名数组 */ params?: string[]; /** * 子路由数组 */ children?: RouteNode[]; /** * 是否缓存，默认 false */ cache?: boolean; /** * 进入路由事件方法 */ onEnter?: (component: NComponent, url: string) => void; /** * 离开路由事件方法 */ onLeave?: (component: NComponent, url: string) => void; } (score=22, confidence=high, evidence=packages/extensions/src/router/types.ts:6)
- **symbol: ComponentModule** — type ComponentModule = { default: CustomElementConstructor } (score=22, confidence=medium, evidence=packages/core/src/utils/types.ts:70)
- **framework_overview: NCom framework overview** — Framework Lab 当前将 NCom 作为单一真实基线对象。 (score=79, confidence=high, evidence=frameworks/ncom/framework.yaml:1)
- **environment_requirement: NCom supported environment baseline** — Run 009/010 使用的已记录 Windows 与 Node/pnpm 环境。 (score=65, confidence=high, evidence=frameworks/ncom/runs/run-010/environment.json:?)
- **validated_command: NCom validated install and build commands** — 配置驱动的 install、lint 与 build 基线步骤。 (score=65, confidence=high, evidence=frameworks/ncom/framework.yaml:10)
- **workflow_constraint: Isolated worktree and evidence preservation constraint** — 修复候选必须隔离，历史 Run 与原始日志必须保留。 (score=55, confidence=high, evidence=frameworks/ncom/reports/run-009-vs-run-010-cjk-sass-fix.md:1)
- **package: @ncom/components** — packages/components (score=18, confidence=high, evidence=packages/components/package.json:1)
- **package: ncom-example** — example (score=18, confidence=high, evidence=example/package.json:1)
- **package: @ncom/extensions** — packages/extensions (score=18, confidence=high, evidence=packages/extensions/package.json:1)

## Validated Knowledge Claims

- 受控 Run 使用 win32 10.0.19045 x64、Node v24.18.0、npm 11.7.0 和 pnpm 10.26.1。 [E1]
- Run 009 与 Run 010 对照使用原始和独立候选 worktree，历史证据不得由候选修复覆盖。 [E2]
- Framework Lab 配置中的框架 id 为 ncom，名称为 New Component。 [E3]
- 基线依次运行 pnpm install --frozen-lockfile、lint:eslint 和 build。 [E7]

## Limitations and Confidence

- 该环境记录不证明其他 Windows、Node 或 pnpm 组合等价。
- 该约束描述 Framework Lab 本次受控工作流，不代表 NCom 上游流程。
- 本卡不描述未由现有证据验证的 NCom 架构或 API。
- lint 在 Run 009/010 中仍失败并被配置为 allow_failure。
- TypeScript semantic analysis is limited by unresolved modules and diagnostics.

## Evidence Index

- [E1] run: frameworks/ncom/runs/run-010/environment.json; run=run-010; commit=a350b576bbeae6c6254273037a17d2a8730fb80f; sha256=3230b372ea0c44d5b804efb33a35ba4f1d1525c8270a23c7174e827a542fe6b5
- [E2] comparison_report: frameworks/ncom/reports/run-009-vs-run-010-cjk-sass-fix.md; commit=a350b576bbeae6c6254273037a17d2a8730fb80f; sha256=789b3bd546af7c8e8be24a6eed81e73f82ebb79f362d11ec4a1d9999265e01ca
- [E3] framework_config: frameworks/ncom/framework.yaml; commit=a350b576bbeae6c6254273037a17d2a8730fb80f; sha256=f527d5b9c0a28110c597485de3505d46c53cf3c8843c055cde284d620ff76cf1
- [E7] framework_config: frameworks/ncom/framework.yaml; commit=a350b576bbeae6c6254273037a17d2a8730fb80f; sha256=f527d5b9c0a28110c597485de3505d46c53cf3c8843c055cde284d620ff76cf1
- [R1] retrieval: packages/core/src/component.ts:18-348; sha256=44590f0a625da3d091abffd8518f6c4998aeae9821fa10834edf61ed51b00240
- [R2] retrieval: packages/components/src/tabs/types.ts:41-56; sha256=ca9a872feb5a973a9e3c874393f871ce5aa3ce1313046096c2d3e5cd048aa09c
- [R3] retrieval: packages/core/src/utils/types.ts:74-74; sha256=2519a0ef8db152696a6b3a27f099b3ebecd408aade23c3e2fba9a855a379a5a3
- [R4] retrieval: packages/components/src/card/types.ts:1-1; sha256=563f74dbdfe0e617a21aa8a607c8a9a4ec24e919a321990cd571db7dcb830892
- [R5] retrieval: packages/core/src/utils/domutil.ts:5-148; sha256=8f660c3924f7e5066bdefec8eeb4bb11bd079dc8e79932f6c17cca12aa665f78
- [R6] retrieval: packages/extensions/src/router/types.ts:6-41; sha256=00039519ef59c32d00faa9037be545e03e8bc1f79565e868ea9893864f6afdca
- [R7] retrieval: packages/core/src/utils/types.ts:70-70; sha256=2519a0ef8db152696a6b3a27f099b3ebecd408aade23c3e2fba9a855a379a5a3
- [R8] retrieval: frameworks/ncom/framework.yaml:1-6; sha256=f527d5b9c0a28110c597485de3505d46c53cf3c8843c055cde284d620ff76cf1
- [R9] retrieval: frameworks/ncom/runs/run-010/environment.json:?-?; sha256=3230b372ea0c44d5b804efb33a35ba4f1d1525c8270a23c7174e827a542fe6b5
- [R10] retrieval: frameworks/ncom/framework.yaml:10-26; sha256=f527d5b9c0a28110c597485de3505d46c53cf3c8843c055cde284d620ff76cf1
- [R11] retrieval: frameworks/ncom/reports/run-009-vs-run-010-cjk-sass-fix.md:1-68; sha256=789b3bd546af7c8e8be24a6eed81e73f82ebb79f362d11ec4a1d9999265e01ca
- [R12] retrieval: packages/components/package.json:1-47; sha256=a8c3d4e7c64b268795242aa0dd463c12b7eb495218507f5bbb9527c1201ae0f1
- [R13] retrieval: example/package.json:1-24; sha256=4f1b5385cf646425beb34e7f99d5d9602d25660d0696278443a6c3696c0321c0
- [R14] retrieval: packages/extensions/package.json:1-34; sha256=c3c9f1aae8b2defb334d034b4eb884038c8aa1bb7b57430ae22e58806e8b040b
