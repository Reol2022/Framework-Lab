# Agent Context: eval-v023-public-import-types-raw

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
- **symbol: RangeProps** — interface RangeProps (score=85, confidence=high, evidence=packages/components/src/range/types.ts:13)
- **symbol: AlertProps** — interface AlertProps (score=85, confidence=high, evidence=packages/components/src/alert/types.ts:15)
- **symbol: TagProps** — interface TagProps (score=85, confidence=high, evidence=packages/components/src/tag/types.ts:16)
- **symbol: ButtonProps** — interface ButtonProps (score=85, confidence=high, evidence=packages/components/src/button/types.ts:15)
- **environment_requirement: NCom supported environment baseline** — Run 009/010 使用的已记录 Windows 与 Node/pnpm 环境。 (score=83, confidence=high, evidence=frameworks/ncom/runs/run-010/environment.json:?)
- **validated_command: NCom validated install and build commands** — 配置驱动的 install、lint 与 build 基线步骤。 (score=83, confidence=high, evidence=frameworks/ncom/framework.yaml:10)
- **framework_overview: NCom framework overview** — Framework Lab 当前将 NCom 作为单一真实基线对象。 (score=61, confidence=high, evidence=frameworks/ncom/framework.yaml:1)
- **workflow_constraint: Isolated worktree and evidence preservation constraint** — 修复候选必须隔离，历史 Run 与原始日志必须保留。 (score=55, confidence=high, evidence=frameworks/ncom/reports/run-009-vs-run-010-cjk-sass-fix.md:1)
- **package: @ncom/components** — packages/components (score=18, confidence=high, evidence=packages/components/package.json:1)

## Validated Knowledge Claims

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
