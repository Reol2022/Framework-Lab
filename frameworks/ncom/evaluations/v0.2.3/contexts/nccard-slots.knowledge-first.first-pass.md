# Agent Context: eval-v023-nccard-slots-knowledge-first

## Task

使用 NCCard 的 header、default 和 footer slots 组织一个容器示例。

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

- **component: NCCard** — NCCard component; NComponent (score=270, confidence=high, evidence=packages/components/src/card/index.ts:25)
- **symbol: NCCard** — class NCCard extends NComponent (score=259, confidence=high, evidence=packages/components/src/card/index.ts:25)
- **symbol: CardProps** — interface CardProps (score=175, confidence=high, evidence=packages/components/src/card/types.ts:5)

## Validated Knowledge Claims

- createChangeEvent 创建名为 nc-change 的 CustomEvent，并把 ChangeEventDetail 放入 detail。 [K:ncom-event-state-update-workflow:E1] [K:ncom-event-state-update-workflow:E2] [K:ncom-event-state-update-workflow:E3] [K:ncom-event-state-update-workflow:E4] [K:ncom-event-state-update-workflow:E5] [K:ncom-event-state-update-workflow:E6]
- NCSelect 在锁定 Symbol Snapshot 中公共可达，继承 NCBaseInput；登记事件 change，slots 无，文档 1 个，示例文件 9 个。 [K:ncom-ncselect-structure:E1] [K:ncom-ncselect-structure:E2] [K:ncom-ncselect-structure:E3] [K:ncom-ncselect-structure:E4] [K:ncom-ncselect-structure:E5]
- NCAlert 在锁定 Symbol Snapshot 中公共可达，继承 NComponent；登记事件 close，slots 无，文档 1 个，示例文件 7 个。 [K:ncom-ncalert-structure:E1] [K:ncom-ncalert-structure:E2] [K:ncom-ncalert-structure:E3]
- NCTable 在锁定 Symbol Snapshot 中公共可达，继承 NComponent；登记事件 rowclick, rowdblclick，slots default，文档 1 个，示例文件 15 个。 [K:ncom-nctable-structure:E1] [K:ncom-nctable-structure:E2] [K:ncom-nctable-structure:E3] [K:ncom-nctable-structure:E4] [K:ncom-nctable-structure:E5] [K:ncom-nctable-structure:E6]
- NCDrawer 在锁定 Symbol Snapshot 中公共可达，继承 NComponent；登记事件 close, open，slots default，文档 1 个，示例文件 4 个。 [K:ncom-ncdrawer-structure:E1] [K:ncom-ncdrawer-structure:E2] [K:ncom-ncdrawer-structure:E3] [K:ncom-ncdrawer-structure:E4] [K:ncom-ncdrawer-structure:E5] [K:ncom-ncdrawer-structure:E6] [K:ncom-ncdrawer-structure:E7] [K:ncom-ncdrawer-structure:E8]
- NCCheckbox 在锁定 Symbol Snapshot 中公共可达，继承 NCBaseInput；登记事件 change，slots default，文档 1 个，示例文件 6 个。 [K:ncom-nccheckbox-structure:E1] [K:ncom-nccheckbox-structure:E2] [K:ncom-nccheckbox-structure:E3] [K:ncom-nccheckbox-structure:E4] [K:ncom-nccheckbox-structure:E5] [K:ncom-nccheckbox-structure:E6] [K:ncom-nccheckbox-structure:E7] [K:ncom-nccheckbox-structure:E8]
- NCCard 在锁定 Symbol Snapshot 中公共可达，继承 NComponent；登记事件 无，slots default, footer, header，文档 1 个，示例文件 5 个。 [K:ncom-nccard-structure:E1] [K:ncom-nccard-structure:E2] [K:ncom-nccard-structure:E3] [K:ncom-nccard-structure:E4] [K:ncom-nccard-structure:E5] [K:ncom-nccard-structure:E6] [K:ncom-nccard-structure:E7] [K:ncom-nccard-structure:E8]
- Run 009 与 Run 010 对照使用原始和独立候选 worktree，历史证据不得由候选修复覆盖。 [E1]
- 受控 Run 使用 win32 10.0.19045 x64、Node v24.18.0、npm 11.7.0 和 pnpm 10.26.1。 [E5]
- 基线依次运行 pnpm install --frozen-lockfile、lint:eslint 和 build。 [E6]

## Limitations and Confidence

- 该约束描述 Framework Lab 本次受控工作流，不代表 NCom 上游流程。
- 该环境记录不证明其他 Windows、Node 或 pnpm 组合等价。
- lint 在 Run 009/010 中仍失败并被配置为 allow_failure。
- TypeScript semantic analysis is limited by unresolved modules and diagnostics.
- knowledge-first: 7 published units; raw fallback candidates=21

## Evidence Index

- [E1] comparison_report: frameworks/ncom/reports/run-009-vs-run-010-cjk-sass-fix.md; commit=a350b576bbeae6c6254273037a17d2a8730fb80f; sha256=789b3bd546af7c8e8be24a6eed81e73f82ebb79f362d11ec4a1d9999265e01ca
- [E5] run: frameworks/ncom/runs/run-010/environment.json; run=run-010; commit=a350b576bbeae6c6254273037a17d2a8730fb80f; sha256=3230b372ea0c44d5b804efb33a35ba4f1d1525c8270a23c7174e827a542fe6b5
- [E6] framework_config: frameworks/ncom/framework.yaml; commit=a350b576bbeae6c6254273037a17d2a8730fb80f; sha256=f527d5b9c0a28110c597485de3505d46c53cf3c8843c055cde284d620ff76cf1
- [R1] retrieval: packages/components/src/card/index.ts:25-243; sha256=37cd9d9ede0cc520809dc0c85fe76ba5c3e63e8d53a1cd9cbc1de4c56005dd69
- [R2] retrieval: packages/components/src/card/index.ts:25-243; sha256=37cd9d9ede0cc520809dc0c85fe76ba5c3e63e8d53a1cd9cbc1de4c56005dd69
- [R3] retrieval: packages/components/src/card/types.ts:5-12; sha256=563f74dbdfe0e617a21aa8a607c8a9a4ec24e919a321990cd571db7dcb830892
- [R4] retrieval: packages/components/src/card/types.ts:1-1; sha256=563f74dbdfe0e617a21aa8a607c8a9a4ec24e919a321990cd571db7dcb830892
- [R5] retrieval: packages/core/src/component.ts:18-348; sha256=44590f0a625da3d091abffd8518f6c4998aeae9821fa10834edf61ed51b00240
- [R6] retrieval: packages/components/src/card/index.ts:226-242; sha256=37cd9d9ede0cc520809dc0c85fe76ba5c3e63e8d53a1cd9cbc1de4c56005dd69
- [R7] retrieval: packages/components/src/card/index.ts:43-47; sha256=37cd9d9ede0cc520809dc0c85fe76ba5c3e63e8d53a1cd9cbc1de4c56005dd69
- [R8] retrieval: packages/components/src/card/index.ts:33-35; sha256=37cd9d9ede0cc520809dc0c85fe76ba5c3e63e8d53a1cd9cbc1de4c56005dd69
- [R9] retrieval: packages/components/src/card/index.ts:25-243; sha256=37cd9d9ede0cc520809dc0c85fe76ba5c3e63e8d53a1cd9cbc1de4c56005dd69
- [R10] retrieval: example/component/card/components/ex2.ts:1-20; sha256=5731224f9a353be9bb02666d6c16afd8a1b0e00565c5dd45754035bcc881c0d0
- [R11] retrieval: example/component/card/components/ex4.ts:1-25; sha256=3abc630a20286671d3fd3a50a594dd0e9c761139463b757d094d892ef4441bfd
- [R12] retrieval: example/component/card/index.ts:1-43; sha256=6d4d2d3e064e6e134ed968d5e26cc6502b7155408934753ccf89e202ccbf63aa
- [R13] retrieval: doc/api/components/card.md:3-6; sha256=b6f9d4c259290a5a98e96f110029a9e48621e83241e0f9ab049f7c2b729b0ce4
- [R14] retrieval: doc/api/components/card.md:1-35; sha256=b6f9d4c259290a5a98e96f110029a9e48621e83241e0f9ab049f7c2b729b0ce4
- [R15] retrieval: doc/api/components/card.md:7-10; sha256=b6f9d4c259290a5a98e96f110029a9e48621e83241e0f9ab049f7c2b729b0ce4
- [R16] retrieval: frameworks/ncom/runs/run-010/environment.json:?-?; sha256=3230b372ea0c44d5b804efb33a35ba4f1d1525c8270a23c7174e827a542fe6b5
- [R17] retrieval: frameworks/ncom/reports/run-009-vs-run-010-cjk-sass-fix.md:1-68; sha256=789b3bd546af7c8e8be24a6eed81e73f82ebb79f362d11ec4a1d9999265e01ca
- [R18] retrieval: frameworks/ncom/framework.yaml:10-26; sha256=f527d5b9c0a28110c597485de3505d46c53cf3c8843c055cde284d620ff76cf1
- [R19] retrieval: packages/components/src/card/style.scss:1-78; sha256=e275a668d9c736e76049a51f34cd5f3cef58749c703b739f415b28914b81eeb6
- [R20] retrieval: packages/components/package.json:1-47; sha256=a8c3d4e7c64b268795242aa0dd463c12b7eb495218507f5bbb9527c1201ae0f1
- [R21] retrieval: packages/core/package.json:1-31; sha256=9567549c72deaf29b9292be557c3aaef35eb9d5acc948a18fd414bb8acc615fa
