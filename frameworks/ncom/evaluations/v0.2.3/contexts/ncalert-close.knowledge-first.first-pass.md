# Agent Context: eval-v023-ncalert-close-knowledge-first

## Task

实现一个可关闭的 NCAlert 使用示例，定位 close 事件、公共入口、文档和示例。

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

- **component: NCAlert** — NCAlert component; NComponent (score=270, confidence=high, evidence=packages/components/src/alert/index.ts:13)
- **symbol: NCAlert** — class NCAlert extends NComponent (score=259, confidence=high, evidence=packages/components/src/alert/index.ts:13)
- **symbol: AlertProps** — interface AlertProps (score=175, confidence=high, evidence=packages/components/src/alert/types.ts:15)

## Validated Knowledge Claims

- @ncom/components 的 package exports 为根入口登记 dist/index.js，并为 types 登记 dist/types/index.d.ts。 [K:ncom-public-import-type-location-workflow:E1] [K:ncom-public-import-type-location-workflow:E2] [K:ncom-public-import-type-location-workflow:E3] [K:ncom-public-import-type-location-workflow:E4]
- 锁定的 Framework Lab 配置把 install、lint、build 作为顺序 baseline steps，并将 build 标记为必需步骤。 [K:ncom-theme-style-verification-structure:E1] [K:ncom-theme-style-verification-structure:E2] [K:ncom-theme-style-verification-structure:E3] [K:ncom-theme-style-verification-structure:E4]
- createChangeEvent 创建名为 nc-change 的 CustomEvent，并把 ChangeEventDetail 放入 detail。 [K:ncom-event-state-update-workflow:E1] [K:ncom-event-state-update-workflow:E2] [K:ncom-event-state-update-workflow:E3] [K:ncom-event-state-update-workflow:E4] [K:ncom-event-state-update-workflow:E5] [K:ncom-event-state-update-workflow:E6]
- NCAlert、NCDrawer 与 NCModal 在锁定 Symbol Snapshot 中都登记了 close 事件。 [K:ncom-family-closable-feedback-overlay:E1] [K:ncom-family-closable-feedback-overlay:E2] [K:ncom-family-closable-feedback-overlay:E3]
- NCTable 在锁定 Symbol Snapshot 中公共可达，继承 NComponent；登记事件 rowclick, rowdblclick，slots default，文档 1 个，示例文件 15 个。 [K:ncom-nctable-structure:E1] [K:ncom-nctable-structure:E2] [K:ncom-nctable-structure:E3] [K:ncom-nctable-structure:E4] [K:ncom-nctable-structure:E5] [K:ncom-nctable-structure:E6]
- NCSelect 在锁定 Symbol Snapshot 中公共可达，继承 NCBaseInput；登记事件 change，slots 无，文档 1 个，示例文件 9 个。 [K:ncom-ncselect-structure:E1] [K:ncom-ncselect-structure:E2] [K:ncom-ncselect-structure:E3] [K:ncom-ncselect-structure:E4] [K:ncom-ncselect-structure:E5]
- NCCheckbox 在锁定 Symbol Snapshot 中公共可达，继承 NCBaseInput；登记事件 change，slots default，文档 1 个，示例文件 6 个。 [K:ncom-nccheckbox-structure:E1] [K:ncom-nccheckbox-structure:E2] [K:ncom-nccheckbox-structure:E3] [K:ncom-nccheckbox-structure:E4] [K:ncom-nccheckbox-structure:E5] [K:ncom-nccheckbox-structure:E6] [K:ncom-nccheckbox-structure:E7] [K:ncom-nccheckbox-structure:E8]
- NCCard 在锁定 Symbol Snapshot 中公共可达，继承 NComponent；登记事件 无，slots default, footer, header，文档 1 个，示例文件 5 个。 [K:ncom-nccard-structure:E1] [K:ncom-nccard-structure:E2] [K:ncom-nccard-structure:E3] [K:ncom-nccard-structure:E4] [K:ncom-nccard-structure:E5] [K:ncom-nccard-structure:E6] [K:ncom-nccard-structure:E7] [K:ncom-nccard-structure:E8]
- NCDrawer 在锁定 Symbol Snapshot 中公共可达，继承 NComponent；登记事件 close, open，slots default，文档 1 个，示例文件 4 个。 [K:ncom-ncdrawer-structure:E1] [K:ncom-ncdrawer-structure:E2] [K:ncom-ncdrawer-structure:E3] [K:ncom-ncdrawer-structure:E4] [K:ncom-ncdrawer-structure:E5] [K:ncom-ncdrawer-structure:E6] [K:ncom-ncdrawer-structure:E7] [K:ncom-ncdrawer-structure:E8]
- NCAlert 在锁定 Symbol Snapshot 中公共可达，继承 NComponent；登记事件 close，slots 无，文档 1 个，示例文件 7 个。 [K:ncom-ncalert-structure:E1] [K:ncom-ncalert-structure:E2] [K:ncom-ncalert-structure:E3]
- Run 009 与 Run 010 对照使用原始和独立候选 worktree，历史证据不得由候选修复覆盖。 [E1]
- 受控 Run 使用 win32 10.0.19045 x64、Node v24.18.0、npm 11.7.0 和 pnpm 10.26.1。 [E5]
- 基线依次运行 pnpm install --frozen-lockfile、lint:eslint 和 build。 [E6]

## Limitations and Confidence

- 该约束描述 Framework Lab 本次受控工作流，不代表 NCom 上游流程。
- 该环境记录不证明其他 Windows、Node 或 pnpm 组合等价。
- lint 在 Run 009/010 中仍失败并被配置为 allow_failure。
- TypeScript semantic analysis is limited by unresolved modules and diagnostics.
- knowledge-first: 10 published units; raw fallback candidates=20

## Evidence Index

- [E1] comparison_report: frameworks/ncom/reports/run-009-vs-run-010-cjk-sass-fix.md; commit=a350b576bbeae6c6254273037a17d2a8730fb80f; sha256=789b3bd546af7c8e8be24a6eed81e73f82ebb79f362d11ec4a1d9999265e01ca
- [E5] run: frameworks/ncom/runs/run-010/environment.json; run=run-010; commit=a350b576bbeae6c6254273037a17d2a8730fb80f; sha256=3230b372ea0c44d5b804efb33a35ba4f1d1525c8270a23c7174e827a542fe6b5
- [E6] framework_config: frameworks/ncom/framework.yaml; commit=a350b576bbeae6c6254273037a17d2a8730fb80f; sha256=f527d5b9c0a28110c597485de3505d46c53cf3c8843c055cde284d620ff76cf1
- [R1] retrieval: packages/components/src/alert/index.ts:13-186; sha256=11a6fc230fa24a22d47bb7d4c59da203e699afd5be00146f98d6f7f6fc676857
- [R2] retrieval: packages/components/src/alert/index.ts:13-186; sha256=11a6fc230fa24a22d47bb7d4c59da203e699afd5be00146f98d6f7f6fc676857
- [R3] retrieval: packages/components/src/alert/types.ts:15-20; sha256=54afa07e10e9646d1f5eb2482a8e823ab17c71c2129931079aaa504f208bc073
- [R4] retrieval: packages/components/src/alert/types.ts:2-2; sha256=54afa07e10e9646d1f5eb2482a8e823ab17c71c2129931079aaa504f208bc073
- [R5] retrieval: packages/components/src/message/index.ts:8-176; sha256=1693eb9da91d921f8b247a21839c34569809b67e71031918dd7d24e58d81d7b6
- [R6] retrieval: packages/components/src/message/types.ts:4-15; sha256=42f45ebec532677af0a07f32c57ed81a6c3df61b4e0dc0ffe0d64581c452ef0d
- [R7] retrieval: packages/components/src/alert/index.ts:34-36; sha256=11a6fc230fa24a22d47bb7d4c59da203e699afd5be00146f98d6f7f6fc676857
- [R8] retrieval: packages/components/src/alert/index.ts:177-185; sha256=11a6fc230fa24a22d47bb7d4c59da203e699afd5be00146f98d6f7f6fc676857
- [R9] retrieval: packages/components/src/alert/index.ts:13-186; sha256=11a6fc230fa24a22d47bb7d4c59da203e699afd5be00146f98d6f7f6fc676857
- [R10] retrieval: packages/components/src/alert/index.ts:13-186; sha256=11a6fc230fa24a22d47bb7d4c59da203e699afd5be00146f98d6f7f6fc676857
- [R11] retrieval: example/component/alert/components/ex2.ts:1-14; sha256=92cdda485e1c702ca0aabab3777a8b62eb9250204634f8c2ff9ea1e749620ac8
- [R12] retrieval: example/component/alert/components/ex6.ts:1-20; sha256=ffb2b664c2f89e8e6da9416296f393df3b6758199a808b81939559d09d5c23fb
- [R13] retrieval: example/component/alert/index.ts:1-44; sha256=e4204aec8b84234f73695f8972a8154c7c3b4501ee50265b17a1b122cfa0ab68
- [R14] retrieval: doc/api/components/alert.md:3-6; sha256=ba114be53766a93b1e0f9b0b489fd4e4b516bb03142cff2f4c02b45b4474260e
- [R15] retrieval: doc/api/components/alert.md:1-53; sha256=ba114be53766a93b1e0f9b0b489fd4e4b516bb03142cff2f4c02b45b4474260e
- [R16] retrieval: doc/api/components/alert.md:7-10; sha256=ba114be53766a93b1e0f9b0b489fd4e4b516bb03142cff2f4c02b45b4474260e
- [R17] retrieval: frameworks/ncom/runs/run-010/environment.json:?-?; sha256=3230b372ea0c44d5b804efb33a35ba4f1d1525c8270a23c7174e827a542fe6b5
- [R18] retrieval: frameworks/ncom/framework.yaml:10-26; sha256=f527d5b9c0a28110c597485de3505d46c53cf3c8843c055cde284d620ff76cf1
- [R19] retrieval: frameworks/ncom/reports/run-009-vs-run-010-cjk-sass-fix.md:1-68; sha256=789b3bd546af7c8e8be24a6eed81e73f82ebb79f362d11ec4a1d9999265e01ca
- [R20] retrieval: packages/components/src/alert/style.scss:1-157; sha256=07dbd71b714ef3f41c44750cf5a04048ebaf1f7569f126ced80808fc2fe09a82
