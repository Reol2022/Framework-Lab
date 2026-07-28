# Agent Context: eval-v023-reference-popup-family-knowledge-first

## Task

比较 NCPopmenu 与 NCPopover 的 reference slot，并选择适合锚点内容的公共组件证据。

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

- **component: NCPopover** — NCPopover component; NComponent (score=270, confidence=high, evidence=packages/components/src/popover/index.ts:5)
- **component: NCPopmenu** — NCPopmenu component; NComponent (score=270, confidence=high, evidence=packages/components/src/popmenu/index.ts:41)
- **symbol: NCPopmenu** — class NCPopmenu extends NComponent (score=259, confidence=high, evidence=packages/components/src/popmenu/index.ts:41)

## Validated Knowledge Claims

- NCPopmenu 与 NCPopover 在锁定 Symbol Snapshot 中都登记了 reference slot。 [K:ncom-family-reference-popup:E1] [K:ncom-family-reference-popup:E2] [K:ncom-family-reference-popup:E3] [K:ncom-family-reference-popup:E4] [K:ncom-family-reference-popup:E5] [K:ncom-family-reference-popup:E6] [K:ncom-family-reference-popup:E7]
- Run 009 与 Run 010 对照使用原始和独立候选 worktree，历史证据不得由候选修复覆盖。 [E1]
- 受控 Run 使用 win32 10.0.19045 x64、Node v24.18.0、npm 11.7.0 和 pnpm 10.26.1。 [E3]
- 基线依次运行 pnpm install --frozen-lockfile、lint:eslint 和 build。 [E4]

## Limitations and Confidence

- 该约束描述 Framework Lab 本次受控工作流，不代表 NCom 上游流程。
- 该环境记录不证明其他 Windows、Node 或 pnpm 组合等价。
- lint 在 Run 009/010 中仍失败并被配置为 allow_failure。
- TypeScript semantic analysis is limited by unresolved modules and diagnostics.
- knowledge-first: 1 published units; raw fallback candidates=22

## Evidence Index

- [E1] comparison_report: frameworks/ncom/reports/run-009-vs-run-010-cjk-sass-fix.md; commit=a350b576bbeae6c6254273037a17d2a8730fb80f; sha256=789b3bd546af7c8e8be24a6eed81e73f82ebb79f362d11ec4a1d9999265e01ca
- [E3] run: frameworks/ncom/runs/run-010/environment.json; run=run-010; commit=a350b576bbeae6c6254273037a17d2a8730fb80f; sha256=3230b372ea0c44d5b804efb33a35ba4f1d1525c8270a23c7174e827a542fe6b5
- [E4] framework_config: frameworks/ncom/framework.yaml; commit=a350b576bbeae6c6254273037a17d2a8730fb80f; sha256=f527d5b9c0a28110c597485de3505d46c53cf3c8843c055cde284d620ff76cf1
- [R1] retrieval: packages/components/src/popover/index.ts:5-164; sha256=087686f36f1df42d123ba73c542c551d8923d91bffc1e8bbb9a079f90b0b10a9
- [R2] retrieval: packages/components/src/popmenu/index.ts:41-406; sha256=c1d3870ac0f834a702c2b1d584c4231e63e20b9ad3c2fee97594133adc47246b
- [R3] retrieval: packages/components/src/popmenu/index.ts:41-406; sha256=c1d3870ac0f834a702c2b1d584c4231e63e20b9ad3c2fee97594133adc47246b
- [R4] retrieval: packages/components/src/popover/index.ts:5-164; sha256=087686f36f1df42d123ba73c542c551d8923d91bffc1e8bbb9a079f90b0b10a9
- [R5] retrieval: packages/components/src/popmenu/types.ts:17-30; sha256=2a523a57890068553cb3680e60aa17f665742b1c35bbb4d90c0049f59bba0df8
- [R6] retrieval: packages/components/src/popover/types.ts:4-11; sha256=78d1e92d971525292e1f1db114e22ae0020f930cfae5f330b81f061bf2cd5301
- [R7] retrieval: packages/components/src/popmenu/types.ts:4-15; sha256=2a523a57890068553cb3680e60aa17f665742b1c35bbb4d90c0049f59bba0df8
- [R8] retrieval: packages/core/src/component.ts:18-348; sha256=44590f0a625da3d091abffd8518f6c4998aeae9821fa10834edf61ed51b00240
- [R9] retrieval: packages/components/src/popmenu/index.ts:90-92; sha256=c1d3870ac0f834a702c2b1d584c4231e63e20b9ad3c2fee97594133adc47246b
- [R10] retrieval: packages/components/src/popover/index.ts:5-164; sha256=087686f36f1df42d123ba73c542c551d8923d91bffc1e8bbb9a079f90b0b10a9
- [R11] retrieval: packages/components/src/popmenu/index.ts:41-406; sha256=c1d3870ac0f834a702c2b1d584c4231e63e20b9ad3c2fee97594133adc47246b
- [R12] retrieval: example/component/popover/index.ts:1-40; sha256=7ef5c1771cb356044d59122733d1b38511c80369d7d700dadf165b091770b3b3
- [R13] retrieval: example/component/popover/components/ex4.ts:1-21; sha256=08baf3d8ec7a12947d7725154ccbe9c94fbb877840acea129f4c6972c6a8ec60
- [R14] retrieval: example/component/popmenu/index.ts:1-35; sha256=6b6804e21eb508d900c6428592e66a7963d0ecab92b15d5eef427ad5f12085be
- [R15] retrieval: doc/api/components/popover.md:3-6; sha256=186663532ef0baa0e915b639a9a0fa3f63cffeb59dda1da7d82074f9c7da0c82
- [R16] retrieval: doc/api/components/popover.md:1-35; sha256=186663532ef0baa0e915b639a9a0fa3f63cffeb59dda1da7d82074f9c7da0c82
- [R17] retrieval: doc/api/components/popover.md:7-10; sha256=186663532ef0baa0e915b639a9a0fa3f63cffeb59dda1da7d82074f9c7da0c82
- [R18] retrieval: frameworks/ncom/runs/run-010/environment.json:?-?; sha256=3230b372ea0c44d5b804efb33a35ba4f1d1525c8270a23c7174e827a542fe6b5
- [R19] retrieval: frameworks/ncom/framework.yaml:10-26; sha256=f527d5b9c0a28110c597485de3505d46c53cf3c8843c055cde284d620ff76cf1
- [R20] retrieval: frameworks/ncom/reports/run-009-vs-run-010-cjk-sass-fix.md:1-68; sha256=789b3bd546af7c8e8be24a6eed81e73f82ebb79f362d11ec4a1d9999265e01ca
- [R21] retrieval: packages/components/src/popmenu/style.scss:1-129; sha256=cf93402f2b7dc47fee19898814813b6b9dab0ee246379d27c09045889a3c85cf
- [R22] retrieval: packages/components/src/popover/style.scss:1-74; sha256=3fc9bcedadbc12723549fca45074800330aae11355cfda23bed57da8c10899bc
