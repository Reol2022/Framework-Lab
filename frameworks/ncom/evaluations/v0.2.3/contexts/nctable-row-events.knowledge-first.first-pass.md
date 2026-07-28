# Agent Context: eval-v023-nctable-row-events-knowledge-first

## Task

实现 NCTable 行点击交互，定位 rowclick、rowdblclick、default slot 和现有示例。

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

- **component: NCTable** — NCTable component; NComponent (score=270, confidence=high, evidence=packages/components/src/table/index.ts:27)
- **component: NCComplextTable** — NCComplextTable component; NComponent (score=130, confidence=high, evidence=packages/components/src/complexttable/index.ts:39)
- **symbol: NCTable** — class NCTable extends NComponent (score=259, confidence=high, evidence=packages/components/src/table/index.ts:27)

## Validated Knowledge Claims

- @ncom/components 的 package exports 为根入口登记 dist/index.js，并为 types 登记 dist/types/index.d.ts。 [K:ncom-public-import-type-location-workflow:E1] [K:ncom-public-import-type-location-workflow:E2] [K:ncom-public-import-type-location-workflow:E3] [K:ncom-public-import-type-location-workflow:E4]
- 锁定的 Framework Lab 配置把 install、lint、build 作为顺序 baseline steps，并将 build 标记为必需步骤。 [K:ncom-theme-style-verification-structure:E1] [K:ncom-theme-style-verification-structure:E2] [K:ncom-theme-style-verification-structure:E3] [K:ncom-theme-style-verification-structure:E4]
- NCPopmenu 与 NCPopover 在锁定 Symbol Snapshot 中都登记了 reference slot。 [K:ncom-family-reference-popup:E1] [K:ncom-family-reference-popup:E2] [K:ncom-family-reference-popup:E3] [K:ncom-family-reference-popup:E4] [K:ncom-family-reference-popup:E5] [K:ncom-family-reference-popup:E6] [K:ncom-family-reference-popup:E7]
- NCSelect 在锁定 Symbol Snapshot 中公共可达，继承 NCBaseInput；登记事件 change，slots 无，文档 1 个，示例文件 9 个。 [K:ncom-ncselect-structure:E1] [K:ncom-ncselect-structure:E2] [K:ncom-ncselect-structure:E3] [K:ncom-ncselect-structure:E4] [K:ncom-ncselect-structure:E5]
- NCAlert 在锁定 Symbol Snapshot 中公共可达，继承 NComponent；登记事件 close，slots 无，文档 1 个，示例文件 7 个。 [K:ncom-ncalert-structure:E1] [K:ncom-ncalert-structure:E2] [K:ncom-ncalert-structure:E3]
- NCDrawer 在锁定 Symbol Snapshot 中公共可达，继承 NComponent；登记事件 close, open，slots default，文档 1 个，示例文件 4 个。 [K:ncom-ncdrawer-structure:E1] [K:ncom-ncdrawer-structure:E2] [K:ncom-ncdrawer-structure:E3] [K:ncom-ncdrawer-structure:E4] [K:ncom-ncdrawer-structure:E5] [K:ncom-ncdrawer-structure:E6] [K:ncom-ncdrawer-structure:E7] [K:ncom-ncdrawer-structure:E8]
- NCCheckbox 在锁定 Symbol Snapshot 中公共可达，继承 NCBaseInput；登记事件 change，slots default，文档 1 个，示例文件 6 个。 [K:ncom-nccheckbox-structure:E1] [K:ncom-nccheckbox-structure:E2] [K:ncom-nccheckbox-structure:E3] [K:ncom-nccheckbox-structure:E4] [K:ncom-nccheckbox-structure:E5] [K:ncom-nccheckbox-structure:E6] [K:ncom-nccheckbox-structure:E7] [K:ncom-nccheckbox-structure:E8]
- NCCard 在锁定 Symbol Snapshot 中公共可达，继承 NComponent；登记事件 无，slots default, footer, header，文档 1 个，示例文件 5 个。 [K:ncom-nccard-structure:E1] [K:ncom-nccard-structure:E2] [K:ncom-nccard-structure:E3] [K:ncom-nccard-structure:E4] [K:ncom-nccard-structure:E5] [K:ncom-nccard-structure:E6] [K:ncom-nccard-structure:E7] [K:ncom-nccard-structure:E8]
- NCTable 在锁定 Symbol Snapshot 中公共可达，继承 NComponent；登记事件 rowclick, rowdblclick，slots default，文档 1 个，示例文件 15 个。 [K:ncom-nctable-structure:E1] [K:ncom-nctable-structure:E2] [K:ncom-nctable-structure:E3] [K:ncom-nctable-structure:E4] [K:ncom-nctable-structure:E5] [K:ncom-nctable-structure:E6]
- 基线依次运行 pnpm install --frozen-lockfile、lint:eslint 和 build。 [E1]
- 受控 Run 使用 win32 10.0.19045 x64、Node v24.18.0、npm 11.7.0 和 pnpm 10.26.1。 [E2]
- Run 009 与 Run 010 对照使用原始和独立候选 worktree，历史证据不得由候选修复覆盖。 [E3]

## Limitations and Confidence

- lint 在 Run 009/010 中仍失败并被配置为 allow_failure。
- 该环境记录不证明其他 Windows、Node 或 pnpm 组合等价。
- 该约束描述 Framework Lab 本次受控工作流，不代表 NCom 上游流程。
- TypeScript semantic analysis is limited by unresolved modules and diagnostics.
- knowledge-first: 9 published units; raw fallback candidates=23

## Evidence Index

- [E1] framework_config: frameworks/ncom/framework.yaml; commit=a350b576bbeae6c6254273037a17d2a8730fb80f; sha256=f527d5b9c0a28110c597485de3505d46c53cf3c8843c055cde284d620ff76cf1
- [E2] run: frameworks/ncom/runs/run-010/environment.json; run=run-010; commit=a350b576bbeae6c6254273037a17d2a8730fb80f; sha256=3230b372ea0c44d5b804efb33a35ba4f1d1525c8270a23c7174e827a542fe6b5
- [E3] comparison_report: frameworks/ncom/reports/run-009-vs-run-010-cjk-sass-fix.md; commit=a350b576bbeae6c6254273037a17d2a8730fb80f; sha256=789b3bd546af7c8e8be24a6eed81e73f82ebb79f362d11ec4a1d9999265e01ca
- [R1] retrieval: packages/components/src/table/index.ts:27-872; sha256=50e0d9ea2e13d7ad45c469c29a1a722d100d44e3b6db604c35616df73f4e6f6a
- [R2] retrieval: packages/components/src/complexttable/index.ts:39-1612; sha256=bd1956fee692259392e9fb1d50e9931256e6f4566e2b4e1215e83f385e408535
- [R3] retrieval: packages/components/src/table/index.ts:27-872; sha256=50e0d9ea2e13d7ad45c469c29a1a722d100d44e3b6db604c35616df73f4e6f6a
- [R4] retrieval: packages/components/src/complexttable/index.ts:39-1612; sha256=bd1956fee692259392e9fb1d50e9931256e6f4566e2b4e1215e83f385e408535
- [R5] retrieval: packages/components/src/base/events.ts:66-71; sha256=d99ef33be78a104dd93c0bfce68794c55abf921e94c1f8e1b05c6cf4f4ae9d46
- [R6] retrieval: packages/components/src/base/events.ts:76-83; sha256=d99ef33be78a104dd93c0bfce68794c55abf921e94c1f8e1b05c6cf4f4ae9d46
- [R7] retrieval: packages/components/src/complexttable/types.ts:20-72; sha256=1b3899dbb4669c14c5c2853b0d9e8b056c629da1bc7921b83b4259e9b6d2dbdc
- [R8] retrieval: packages/components/src/table/types.ts:9-44; sha256=fbf485a9cc3401704ea66359751e4e3a34bdb7f6ad23a5d2260729262566daea
- [R9] retrieval: packages/core/src/component.ts:18-348; sha256=44590f0a625da3d091abffd8518f6c4998aeae9821fa10834edf61ed51b00240
- [R10] retrieval: packages/components/src/table/index.ts:27-872; sha256=50e0d9ea2e13d7ad45c469c29a1a722d100d44e3b6db604c35616df73f4e6f6a
- [R11] retrieval: packages/components/src/complexttable/index.ts:39-1612; sha256=bd1956fee692259392e9fb1d50e9931256e6f4566e2b4e1215e83f385e408535
- [R12] retrieval: packages/components/src/table/index.ts:27-872; sha256=50e0d9ea2e13d7ad45c469c29a1a722d100d44e3b6db604c35616df73f4e6f6a
- [R13] retrieval: packages/components/src/complexttable/index.ts:39-1612; sha256=bd1956fee692259392e9fb1d50e9931256e6f4566e2b4e1215e83f385e408535
- [R14] retrieval: example/component/table/components/ex2.ts:1-24; sha256=45dd628764c6488a0245db0ddfc398891000af973ac9f7d9e6f92e73b4368b2c
- [R15] retrieval: example/component/complexttable/components/ex1.ts:1-20; sha256=c68815be827ae5a1822518d9648ded5e4c795f9413cdb791906639f706f87add
- [R16] retrieval: example/component/complexttable/data/tabledata.ts:1-72; sha256=34bc35f503657410052e0a5ff899a403997ce0f6cbd6e2c3f3d85923106d2a14
- [R17] retrieval: doc/api/components/table.md:3-6; sha256=478d08d342791af580f0ddb6a69fa26c5efeaad9bedda24e137bdbd35e626c6f
- [R18] retrieval: doc/api/components/table.md:1-161; sha256=478d08d342791af580f0ddb6a69fa26c5efeaad9bedda24e137bdbd35e626c6f
- [R19] retrieval: doc/api/components/table.md:7-12; sha256=478d08d342791af580f0ddb6a69fa26c5efeaad9bedda24e137bdbd35e626c6f
- [R20] retrieval: frameworks/ncom/runs/run-010/environment.json:?-?; sha256=3230b372ea0c44d5b804efb33a35ba4f1d1525c8270a23c7174e827a542fe6b5
- [R21] retrieval: frameworks/ncom/framework.yaml:10-26; sha256=f527d5b9c0a28110c597485de3505d46c53cf3c8843c055cde284d620ff76cf1
- [R22] retrieval: frameworks/ncom/reports/run-009-vs-run-010-cjk-sass-fix.md:1-68; sha256=789b3bd546af7c8e8be24a6eed81e73f82ebb79f362d11ec4a1d9999265e01ca
- [R23] retrieval: packages/components/src/complexttable/style.scss:1-357; sha256=2ea4c194cbd112ad1d8e828854f3fdfc721f4cb865dce29764f0e92a7464fa1a
