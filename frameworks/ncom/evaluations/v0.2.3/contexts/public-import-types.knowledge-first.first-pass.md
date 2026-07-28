# Agent Context: eval-v023-public-import-types-knowledge-first

## Task

定位 @ncom/components 的公共导入入口和 Props 类型声明入口，说明查找顺序。

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

- **symbol: TourProps** — interface TourProps (score=85, confidence=high, evidence=packages/components/src/tour/types.ts:21)
- **symbol: WatermarkProps** — interface WatermarkProps (score=85, confidence=high, evidence=packages/components/src/watermark/types.ts:4)
- **symbol: StatisticProps** — interface StatisticProps (score=85, confidence=high, evidence=packages/components/src/statistic/types.ts:2)

## Validated Knowledge Claims

- The bounded catalog evidence records a package or export reference for the locked commit. [K:ncom-package-public-exports:E1]
- 当前 baseline 配置以固定 pnpm 执行 install、lint:eslint 和 build；example/package.json 另登记 dev 与 build 脚本。 [K:ncom-theme-example-build-chain-workflow:E1] [K:ncom-theme-example-build-chain-workflow:E2] [K:ncom-theme-example-build-chain-workflow:E3] [K:ncom-theme-example-build-chain-workflow:E4]
- The bounded evidence contains example-related declarations and package metadata for this commit. [K:ncom-example-workflow:E1]
- @ncom/components 的 package exports 为根入口登记 dist/index.js，并为 types 登记 dist/types/index.d.ts。 [K:ncom-public-import-type-location-workflow:E1] [K:ncom-public-import-type-location-workflow:E2] [K:ncom-public-import-type-location-workflow:E3] [K:ncom-public-import-type-location-workflow:E4]
- NComponent 声明 _templateFrag、_mounted 和 root 成员，构造阶段创建 open ShadowRoot。 [K:ncom-template-rendering-structure:E1] [K:ncom-template-rendering-structure:E2] [K:ncom-template-rendering-structure:E3] [K:ncom-template-rendering-structure:E4] [K:ncom-template-rendering-structure:E5] [K:ncom-template-rendering-structure:E6]
- NComponent extends HTMLElement；所给构造函数片段创建 EventManager 并以 open 模式 attachShadow。 [K:ncom-lifecycle-callback-structure:E1] [K:ncom-lifecycle-callback-structure:E2] [K:ncom-lifecycle-callback-structure:E3] [K:ncom-lifecycle-callback-structure:E4] [K:ncom-lifecycle-callback-structure:E5] [K:ncom-lifecycle-callback-structure:E6]
- ClickEventDetail is present in the bounded event-system evidence for this commit. [K:ncom-event-system:E1]
- createChangeEvent 创建名为 nc-change 的 CustomEvent，并把 ChangeEventDetail 放入 detail。 [K:ncom-event-state-update-workflow:E1] [K:ncom-event-state-update-workflow:E2] [K:ncom-event-state-update-workflow:E3] [K:ncom-event-state-update-workflow:E4] [K:ncom-event-state-update-workflow:E5] [K:ncom-event-state-update-workflow:E6]
- The bounded evidence contains the NComponent and defineComponent declarations for this commit. [K:ncom-component-base-model:E1]
- 锁定的 Framework Lab 配置把 install、lint、build 作为顺序 baseline steps，并将 build 标记为必需步骤。 [K:ncom-theme-style-verification-structure:E1] [K:ncom-theme-style-verification-structure:E2] [K:ncom-theme-style-verification-structure:E3] [K:ncom-theme-style-verification-structure:E4]
- TourProps、WatermarkProps 和 StatisticProps 的所给证据片段均以 TypeScript interface 声明可选属性。 [K:ncom-props-declaration-structure:E1] [K:ncom-props-declaration-structure:E2] [K:ncom-props-declaration-structure:E3] [K:ncom-props-declaration-structure:E4]
- NCPopmenu 与 NCPopover 在锁定 Symbol Snapshot 中都登记了 reference slot。 [K:ncom-family-reference-popup:E1] [K:ncom-family-reference-popup:E2] [K:ncom-family-reference-popup:E3] [K:ncom-family-reference-popup:E4] [K:ncom-family-reference-popup:E5] [K:ncom-family-reference-popup:E6] [K:ncom-family-reference-popup:E7]
- 复核成员在锁定 Symbol Snapshot 中共享 base:NCBaseInput 结构信号。 [K:ncom-family-input-controls:E1] [K:ncom-family-input-controls:E2] [K:ncom-family-input-controls:E3] [K:ncom-family-input-controls:E4] [K:ncom-family-input-controls:E5] [K:ncom-family-input-controls:E6]
- NCAlert、NCDrawer 与 NCModal 在锁定 Symbol Snapshot 中都登记了 close 事件。 [K:ncom-family-closable-feedback-overlay:E1] [K:ncom-family-closable-feedback-overlay:E2] [K:ncom-family-closable-feedback-overlay:E3]
- NCTable 在锁定 Symbol Snapshot 中公共可达，继承 NComponent；登记事件 rowclick, rowdblclick，slots default，文档 1 个，示例文件 15 个。 [K:ncom-nctable-structure:E1] [K:ncom-nctable-structure:E2] [K:ncom-nctable-structure:E3] [K:ncom-nctable-structure:E4] [K:ncom-nctable-structure:E5] [K:ncom-nctable-structure:E6]
- NCSelect 在锁定 Symbol Snapshot 中公共可达，继承 NCBaseInput；登记事件 change，slots 无，文档 1 个，示例文件 9 个。 [K:ncom-ncselect-structure:E1] [K:ncom-ncselect-structure:E2] [K:ncom-ncselect-structure:E3] [K:ncom-ncselect-structure:E4] [K:ncom-ncselect-structure:E5]
- NCInput-related declarations occur in the bounded evidence for the locked commit. [K:ncom-ncinput-events:E1]
- NCDrawer 在锁定 Symbol Snapshot 中公共可达，继承 NComponent；登记事件 close, open，slots default，文档 1 个，示例文件 4 个。 [K:ncom-ncdrawer-structure:E1] [K:ncom-ncdrawer-structure:E2] [K:ncom-ncdrawer-structure:E3] [K:ncom-ncdrawer-structure:E4] [K:ncom-ncdrawer-structure:E5] [K:ncom-ncdrawer-structure:E6] [K:ncom-ncdrawer-structure:E7] [K:ncom-ncdrawer-structure:E8]
- NCCheckbox 在锁定 Symbol Snapshot 中公共可达，继承 NCBaseInput；登记事件 change，slots default，文档 1 个，示例文件 6 个。 [K:ncom-nccheckbox-structure:E1] [K:ncom-nccheckbox-structure:E2] [K:ncom-nccheckbox-structure:E3] [K:ncom-nccheckbox-structure:E4] [K:ncom-nccheckbox-structure:E5] [K:ncom-nccheckbox-structure:E6] [K:ncom-nccheckbox-structure:E7] [K:ncom-nccheckbox-structure:E8]
- NCCard 在锁定 Symbol Snapshot 中公共可达，继承 NComponent；登记事件 无，slots default, footer, header，文档 1 个，示例文件 5 个。 [K:ncom-nccard-structure:E1] [K:ncom-nccard-structure:E2] [K:ncom-nccard-structure:E3] [K:ncom-nccard-structure:E4] [K:ncom-nccard-structure:E5] [K:ncom-nccard-structure:E6] [K:ncom-nccard-structure:E7] [K:ncom-nccard-structure:E8]
- NCAlert 在锁定 Symbol Snapshot 中公共可达，继承 NComponent；登记事件 close，slots 无，文档 1 个，示例文件 7 个。 [K:ncom-ncalert-structure:E1] [K:ncom-ncalert-structure:E2] [K:ncom-ncalert-structure:E3]
- NCButton, ButtonProps and ClickEventDetail occur in this bounded bundle for the locked commit. [K:ncom-ncbutton-api:E1] [K:ncom-ncbutton-api:E2] [K:ncom-ncbutton-api:E3]
- 受控 Run 使用 win32 10.0.19045 x64、Node v24.18.0、npm 11.7.0 和 pnpm 10.26.1。 [E1]
- Framework Lab 配置中的框架 id 为 ncom，名称为 New Component。 [E3]
- Run 009 与 Run 010 对照使用原始和独立候选 worktree，历史证据不得由候选修复覆盖。 [E4]
- 基线依次运行 pnpm install --frozen-lockfile、lint:eslint 和 build。 [E5]

## Limitations and Confidence

- 该环境记录不证明其他 Windows、Node 或 pnpm 组合等价。
- 本卡不描述未由现有证据验证的 NCom 架构或 API。
- 该约束描述 Framework Lab 本次受控工作流，不代表 NCom 上游流程。
- lint 在 Run 009/010 中仍失败并被配置为 allow_failure。
- TypeScript semantic analysis is limited by unresolved modules and diagnostics.
- knowledge-first: 22 published units; raw fallback candidates=12

## Evidence Index

- [E1] run: frameworks/ncom/runs/run-010/environment.json; run=run-010; commit=a350b576bbeae6c6254273037a17d2a8730fb80f; sha256=3230b372ea0c44d5b804efb33a35ba4f1d1525c8270a23c7174e827a542fe6b5
- [E3] framework_config: frameworks/ncom/framework.yaml; commit=a350b576bbeae6c6254273037a17d2a8730fb80f; sha256=f527d5b9c0a28110c597485de3505d46c53cf3c8843c055cde284d620ff76cf1
- [E4] comparison_report: frameworks/ncom/reports/run-009-vs-run-010-cjk-sass-fix.md; commit=a350b576bbeae6c6254273037a17d2a8730fb80f; sha256=789b3bd546af7c8e8be24a6eed81e73f82ebb79f362d11ec4a1d9999265e01ca
- [E5] framework_config: frameworks/ncom/framework.yaml; commit=a350b576bbeae6c6254273037a17d2a8730fb80f; sha256=f527d5b9c0a28110c597485de3505d46c53cf3c8843c055cde284d620ff76cf1
- [R1] retrieval: packages/components/src/tour/types.ts:21-28; sha256=15216d1319acb9aac91137a9b8977a6b7b52f2914de615c01e9cdaadfd32f418
- [R2] retrieval: packages/components/src/watermark/types.ts:4-19; sha256=ffbbeaef05fdcae21471b73c0c72f13d1e51bc0238472043e79f3410fc8dda32
- [R3] retrieval: packages/components/src/statistic/types.ts:2-17; sha256=5531103f8c4996d870526d91ab1786e9ae788e5c8430b46ed69758820034ce45
- [R4] retrieval: packages/components/src/range/types.ts:13-24; sha256=d5331a0bf12215021bc3462fb29c90728924715294346451dda496b0b528d73b
- [R5] retrieval: packages/components/src/alert/types.ts:15-20; sha256=54afa07e10e9646d1f5eb2482a8e823ab17c71c2129931079aaa504f208bc073
- [R6] retrieval: packages/components/src/tag/types.ts:16-25; sha256=c0c6910c8b5b30949867d354e8b75225a25a66cba5e0b64d8fdc442b2f77a4da
- [R7] retrieval: packages/components/src/button/types.ts:15-21; sha256=7697dc9f5972531b10e63c31edea7a6c7ed4f23c2c2764b2912d5f1ee5e29f0c
- [R8] retrieval: frameworks/ncom/runs/run-010/environment.json:?-?; sha256=3230b372ea0c44d5b804efb33a35ba4f1d1525c8270a23c7174e827a542fe6b5
- [R9] retrieval: frameworks/ncom/framework.yaml:10-26; sha256=f527d5b9c0a28110c597485de3505d46c53cf3c8843c055cde284d620ff76cf1
- [R10] retrieval: frameworks/ncom/framework.yaml:1-6; sha256=f527d5b9c0a28110c597485de3505d46c53cf3c8843c055cde284d620ff76cf1
- [R11] retrieval: frameworks/ncom/reports/run-009-vs-run-010-cjk-sass-fix.md:1-68; sha256=789b3bd546af7c8e8be24a6eed81e73f82ebb79f362d11ec4a1d9999265e01ca
- [R12] retrieval: packages/components/package.json:1-47; sha256=a8c3d4e7c64b268795242aa0dd463c12b7eb495218507f5bbb9527c1201ae0f1
