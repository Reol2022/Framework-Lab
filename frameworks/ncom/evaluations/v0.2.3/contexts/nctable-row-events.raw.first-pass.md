# Agent Context: eval-v023-nctable-row-events-raw

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
- **symbol: NCComplextTable** — class NCComplextTable extends NComponent (score=139, confidence=high, evidence=packages/components/src/complexttable/index.ts:39)
- **symbol: ClickEventDetail** — interface ClickEventDetail (score=121, confidence=high, evidence=packages/components/src/base/events.ts:66)
- **symbol: createClickEvent** — export function createClickEvent(detail: ClickEventDetail = { dom: undefined }): ClickEvent (score=85, confidence=high, evidence=packages/components/src/base/events.ts:76)
- **symbol: ComplextTableColumn** — interface ComplextTableColumn (score=85, confidence=high, evidence=packages/components/src/complexttable/types.ts:20)
- **symbol: TableColumn** — interface TableColumn (score=85, confidence=high, evidence=packages/components/src/table/types.ts:9)
- **symbol: NComponent** — class NComponent extends HTMLElement (score=44, confidence=high, evidence=packages/core/src/component.ts:18)
- **public_export: NCTable public export** — @ncom/all, @ncom/components exports NCTable (score=70, confidence=high, evidence=packages/components/src/table/index.ts:27)
- **public_export: NCComplextTable public export** — @ncom/all, @ncom/components exports NCComplextTable (score=70, confidence=high, evidence=packages/components/src/complexttable/index.ts:39)
- **public_export: NCTable events** — rowclick, rowdblclick (score=55, confidence=high, evidence=packages/components/src/table/index.ts:27)
- **public_export: NCComplextTable events** — cancel, change, collapse, editstart, expand, rowclick, rowdblclick (score=55, confidence=high, evidence=packages/components/src/complexttable/index.ts:39)
- **example: example** — example/component/table/components/ex2.ts (score=28, confidence=high, evidence=example/component/table/components/ex2.ts:1)
- **example: example** — example/component/complexttable/components/ex1.ts (score=28, confidence=high, evidence=example/component/complexttable/components/ex1.ts:1)
- **example: example** — example/component/complexttable/data/tabledata.ts (score=28, confidence=high, evidence=example/component/complexttable/data/tabledata.ts:1)
- **document_section: doc/api/components/table.md#组件名** — 组件名 (score=42, confidence=high, evidence=doc/api/components/table.md:3)
- **document_section: doc/api/components/table.md#Table（nc-table）** — Table（nc-table） (score=42, confidence=high, evidence=doc/api/components/table.md:1)
- **document_section: doc/api/components/table.md#组件描述** — 组件描述 (score=42, confidence=high, evidence=doc/api/components/table.md:7)
- **environment_requirement: NCom supported environment baseline** — Run 009/010 使用的已记录 Windows 与 Node/pnpm 环境。 (score=65, confidence=high, evidence=frameworks/ncom/runs/run-010/environment.json:?)
- **validated_command: NCom validated install and build commands** — 配置驱动的 install、lint 与 build 基线步骤。 (score=65, confidence=high, evidence=frameworks/ncom/framework.yaml:10)
- **workflow_constraint: Isolated worktree and evidence preservation constraint** — 修复候选必须隔离，历史 Run 与原始日志必须保留。 (score=55, confidence=high, evidence=frameworks/ncom/reports/run-009-vs-run-010-cjk-sass-fix.md:1)
- **style: packages/components/src/complexttable/style.scss** — packages/components/src/complexttable/style.scss (score=24, confidence=high, evidence=packages/components/src/complexttable/style.scss:1)

## Validated Knowledge Claims

- 基线依次运行 pnpm install --frozen-lockfile、lint:eslint 和 build。 [E1]
- 受控 Run 使用 win32 10.0.19045 x64、Node v24.18.0、npm 11.7.0 和 pnpm 10.26.1。 [E2]
- Run 009 与 Run 010 对照使用原始和独立候选 worktree，历史证据不得由候选修复覆盖。 [E3]

## Limitations and Confidence

- lint 在 Run 009/010 中仍失败并被配置为 allow_failure。
- 该环境记录不证明其他 Windows、Node 或 pnpm 组合等价。
- 该约束描述 Framework Lab 本次受控工作流，不代表 NCom 上游流程。
- TypeScript semantic analysis is limited by unresolved modules and diagnostics.

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
