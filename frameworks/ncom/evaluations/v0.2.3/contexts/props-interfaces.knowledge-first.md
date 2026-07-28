# Agent Context: eval-v023-props-interfaces-knowledge-first

## Task

定位 NCom 组件 Props interface 的声明方式，并查找 TourProps、WatermarkProps 与 StatisticProps。

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

- **component: NCTour** — NCTour component; NComponent (score=130, confidence=high, evidence=packages/components/src/tour/index.ts:14)
- **component: NCStatistic** — NCStatistic component; NComponent (score=130, confidence=high, evidence=packages/components/src/statistic/index.ts:26)
- **component: NCWatermark** — NCWatermark component; NComponent (score=130, confidence=high, evidence=packages/components/src/watermark/index.ts:13)

## Validated Knowledge Claims

- @ncom/components 的 package exports 为根入口登记 dist/index.js，并为 types 登记 dist/types/index.d.ts。 [K:ncom-public-import-type-location-workflow:E1] [K:ncom-public-import-type-location-workflow:E2] [K:ncom-public-import-type-location-workflow:E3] [K:ncom-public-import-type-location-workflow:E4]
- TourProps、WatermarkProps 和 StatisticProps 的所给证据片段均以 TypeScript interface 声明可选属性。 [K:ncom-props-declaration-structure:E1] [K:ncom-props-declaration-structure:E2] [K:ncom-props-declaration-structure:E3] [K:ncom-props-declaration-structure:E4]
- Run 009 与 Run 010 对照使用原始和独立候选 worktree，历史证据不得由候选修复覆盖。 [E1]
- 基线依次运行 pnpm install --frozen-lockfile、lint:eslint 和 build。 [E4]
- 受控 Run 使用 win32 10.0.19045 x64、Node v24.18.0、npm 11.7.0 和 pnpm 10.26.1。 [E6]
- Framework Lab 配置中的框架 id 为 ncom，名称为 New Component。 [E7]

## Limitations and Confidence

- 该约束描述 Framework Lab 本次受控工作流，不代表 NCom 上游流程。
- lint 在 Run 009/010 中仍失败并被配置为 allow_failure。
- 该环境记录不证明其他 Windows、Node 或 pnpm 组合等价。
- 本卡不描述未由现有证据验证的 NCom 架构或 API。
- TypeScript semantic analysis is limited by unresolved modules and diagnostics.
- knowledge-first: 2 published units; raw fallback candidates=18

## Evidence Index

- [E1] comparison_report: frameworks/ncom/reports/run-009-vs-run-010-cjk-sass-fix.md; commit=a350b576bbeae6c6254273037a17d2a8730fb80f; sha256=789b3bd546af7c8e8be24a6eed81e73f82ebb79f362d11ec4a1d9999265e01ca
- [E4] framework_config: frameworks/ncom/framework.yaml; commit=a350b576bbeae6c6254273037a17d2a8730fb80f; sha256=f527d5b9c0a28110c597485de3505d46c53cf3c8843c055cde284d620ff76cf1
- [E6] run: frameworks/ncom/runs/run-010/environment.json; run=run-010; commit=a350b576bbeae6c6254273037a17d2a8730fb80f; sha256=3230b372ea0c44d5b804efb33a35ba4f1d1525c8270a23c7174e827a542fe6b5
- [E7] framework_config: frameworks/ncom/framework.yaml; commit=a350b576bbeae6c6254273037a17d2a8730fb80f; sha256=f527d5b9c0a28110c597485de3505d46c53cf3c8843c055cde284d620ff76cf1
- [R1] retrieval: packages/components/src/tour/index.ts:14-257; sha256=5c4134bf872fa7960d5cf67e7878dea781c0ddf0374395c3a2c597a48ba94431
- [R2] retrieval: packages/components/src/statistic/index.ts:26-164; sha256=6111c476da90c9039f1a0c08f2dfe0d23d5c0d4470848d20d21827be2439cde1
- [R3] retrieval: packages/components/src/watermark/index.ts:13-170; sha256=9c5e00d7aeee5184247fa34541d8c0b3fc668b976e68494200f944bd25184a4a
- [R4] retrieval: packages/components/src/tour/types.ts:21-28; sha256=15216d1319acb9aac91137a9b8977a6b7b52f2914de615c01e9cdaadfd32f418
- [R5] retrieval: packages/components/src/watermark/types.ts:4-19; sha256=ffbbeaef05fdcae21471b73c0c72f13d1e51bc0238472043e79f3410fc8dda32
- [R6] retrieval: packages/components/src/statistic/types.ts:2-17; sha256=5531103f8c4996d870526d91ab1786e9ae788e5c8430b46ed69758820034ce45
- [R7] retrieval: packages/components/src/statistic/index.ts:26-164; sha256=6111c476da90c9039f1a0c08f2dfe0d23d5c0d4470848d20d21827be2439cde1
- [R8] retrieval: packages/components/src/tour/index.ts:14-257; sha256=5c4134bf872fa7960d5cf67e7878dea781c0ddf0374395c3a2c597a48ba94431
- [R9] retrieval: packages/components/src/watermark/index.ts:13-170; sha256=9c5e00d7aeee5184247fa34541d8c0b3fc668b976e68494200f944bd25184a4a
- [R10] retrieval: packages/components/src/range/types.ts:13-24; sha256=d5331a0bf12215021bc3462fb29c90728924715294346451dda496b0b528d73b
- [R11] retrieval: packages/components/src/tour/index.ts:14-257; sha256=5c4134bf872fa7960d5cf67e7878dea781c0ddf0374395c3a2c597a48ba94431
- [R12] retrieval: packages/components/src/statistic/index.ts:26-164; sha256=6111c476da90c9039f1a0c08f2dfe0d23d5c0d4470848d20d21827be2439cde1
- [R13] retrieval: packages/components/src/watermark/index.ts:13-170; sha256=9c5e00d7aeee5184247fa34541d8c0b3fc668b976e68494200f944bd25184a4a
- [R14] retrieval: packages/components/src/tour/index.ts:14-257; sha256=5c4134bf872fa7960d5cf67e7878dea781c0ddf0374395c3a2c597a48ba94431
- [R15] retrieval: frameworks/ncom/runs/run-010/environment.json:?-?; sha256=3230b372ea0c44d5b804efb33a35ba4f1d1525c8270a23c7174e827a542fe6b5
- [R16] retrieval: frameworks/ncom/framework.yaml:10-26; sha256=f527d5b9c0a28110c597485de3505d46c53cf3c8843c055cde284d620ff76cf1
- [R17] retrieval: frameworks/ncom/framework.yaml:1-6; sha256=f527d5b9c0a28110c597485de3505d46c53cf3c8843c055cde284d620ff76cf1
- [R18] retrieval: frameworks/ncom/reports/run-009-vs-run-010-cjk-sass-fix.md:1-68; sha256=789b3bd546af7c8e8be24a6eed81e73f82ebb79f362d11ec4a1d9999265e01ca
