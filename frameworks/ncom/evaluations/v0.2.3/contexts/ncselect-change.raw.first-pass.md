# Agent Context: eval-v023-ncselect-change-raw

## Task

使用 NCSelect 实现选择值变化，并定位 change 事件、公共组件入口和现有示例。

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

- **component: NCSelect** — NCSelect component; NCBaseInput (score=270, confidence=high, evidence=packages/components/src/select/index.ts:7)
- **component: NCTreeSelect** — NCTreeSelect component; NCBaseInput (score=130, confidence=high, evidence=packages/components/src/treeselect/index.ts:19)
- **symbol: NCSelect** — class NCSelect extends NCBaseInput (score=259, confidence=high, evidence=packages/components/src/select/index.ts:7)
- **symbol: TreeSelectProps** — interface TreeSelectProps (score=175, confidence=high, evidence=packages/components/src/treeselect/types.ts:5)
- **symbol: NCTreeSelect** — class NCTreeSelect extends NCBaseInput (score=139, confidence=high, evidence=packages/components/src/treeselect/index.ts:19)
- **symbol: createChangeEvent** — export function createChangeEvent(detail: ChangeEventDetail = { oldValue: undefined, value: undefined }): ChangeEvent (score=85, confidence=high, evidence=packages/components/src/base/events.ts:16)
- **symbol: SelectItemOption** — interface SelectItemOption (score=85, confidence=high, evidence=packages/components/src/select/types.ts:4)
- **symbol: RangeChangeEventDetail** — interface RangeChangeEventDetail (score=85, confidence=high, evidence=packages/components/src/range/types.ts:5)
- **symbol: ChangeEventDetail** — interface ChangeEventDetail (score=85, confidence=high, evidence=packages/components/src/base/events.ts:3)
- **public_export: NCSelect public export** — @ncom/all, @ncom/components exports NCSelect (score=70, confidence=high, evidence=packages/components/src/select/index.ts:7)
- **public_export: NCTreeSelect public export** — @ncom/all, @ncom/components exports NCTreeSelect (score=70, confidence=high, evidence=packages/components/src/treeselect/index.ts:19)
- **public_export: NCTreeSelect events** — change (score=55, confidence=high, evidence=packages/components/src/treeselect/index.ts:19)
- **public_export: NCSelect events** — change (score=55, confidence=high, evidence=packages/components/src/select/index.ts:7)
- **document_section: doc/api/components/treeselect.md#组件名** — 组件名 (score=42, confidence=high, evidence=doc/api/components/treeselect.md:3)
- **document_section: doc/api/components/treeselect.md#TreeSelect（nc-treeselect）** — TreeSelect（nc-treeselect） (score=42, confidence=high, evidence=doc/api/components/treeselect.md:1)
- **document_section: doc/api/components/treeselect.md#组件描述** — 组件描述 (score=42, confidence=high, evidence=doc/api/components/treeselect.md:7)
- **environment_requirement: NCom supported environment baseline** — Run 009/010 使用的已记录 Windows 与 Node/pnpm 环境。 (score=83, confidence=high, evidence=frameworks/ncom/runs/run-010/environment.json:?)
- **workflow_constraint: Isolated worktree and evidence preservation constraint** — 修复候选必须隔离，历史 Run 与原始日志必须保留。 (score=73, confidence=high, evidence=frameworks/ncom/reports/run-009-vs-run-010-cjk-sass-fix.md:1)
- **validated_command: NCom validated install and build commands** — 配置驱动的 install、lint 与 build 基线步骤。 (score=65, confidence=high, evidence=frameworks/ncom/framework.yaml:10)

## Validated Knowledge Claims

- Run 009 与 Run 010 对照使用原始和独立候选 worktree，历史证据不得由候选修复覆盖。 [E3]
- 受控 Run 使用 win32 10.0.19045 x64、Node v24.18.0、npm 11.7.0 和 pnpm 10.26.1。 [E4]
- 基线依次运行 pnpm install --frozen-lockfile、lint:eslint 和 build。 [E6]

## Limitations and Confidence

- 该约束描述 Framework Lab 本次受控工作流，不代表 NCom 上游流程。
- 该环境记录不证明其他 Windows、Node 或 pnpm 组合等价。
- lint 在 Run 009/010 中仍失败并被配置为 allow_failure。
- TypeScript semantic analysis is limited by unresolved modules and diagnostics.

## Evidence Index

- [E3] comparison_report: frameworks/ncom/reports/run-009-vs-run-010-cjk-sass-fix.md; commit=a350b576bbeae6c6254273037a17d2a8730fb80f; sha256=789b3bd546af7c8e8be24a6eed81e73f82ebb79f362d11ec4a1d9999265e01ca
- [E4] run: frameworks/ncom/runs/run-010/environment.json; run=run-010; commit=a350b576bbeae6c6254273037a17d2a8730fb80f; sha256=3230b372ea0c44d5b804efb33a35ba4f1d1525c8270a23c7174e827a542fe6b5
- [E6] framework_config: frameworks/ncom/framework.yaml; commit=a350b576bbeae6c6254273037a17d2a8730fb80f; sha256=f527d5b9c0a28110c597485de3505d46c53cf3c8843c055cde284d620ff76cf1
- [R1] retrieval: packages/components/src/select/index.ts:7-485; sha256=f900aa02f249d9cfbbe4a2d52064511a8a36bead062fd726b181d6123a1fb719
- [R2] retrieval: packages/components/src/treeselect/index.ts:19-710; sha256=449262245d3425b7ba58dcd273d99d4441b1ceba9082bc7794c19b322699c62e
- [R3] retrieval: packages/components/src/select/index.ts:7-485; sha256=f900aa02f249d9cfbbe4a2d52064511a8a36bead062fd726b181d6123a1fb719
- [R4] retrieval: packages/components/src/treeselect/types.ts:5-24; sha256=8494c1c38a7942f71a69ae9a8bc56871d6e44a8fd3eb8a7dd3f4eb85cc6a11d4
- [R5] retrieval: packages/components/src/treeselect/index.ts:19-710; sha256=449262245d3425b7ba58dcd273d99d4441b1ceba9082bc7794c19b322699c62e
- [R6] retrieval: packages/components/src/base/events.ts:16-23; sha256=d99ef33be78a104dd93c0bfce68794c55abf921e94c1f8e1b05c6cf4f4ae9d46
- [R7] retrieval: packages/components/src/select/types.ts:4-24; sha256=08f859e6e0c0d2b549a46acfb72f19f40c65d8c47a85ad7c0b326ae70025db64
- [R8] retrieval: packages/components/src/range/types.ts:5-10; sha256=d5331a0bf12215021bc3462fb29c90728924715294346451dda496b0b528d73b
- [R9] retrieval: packages/components/src/base/events.ts:3-10; sha256=d99ef33be78a104dd93c0bfce68794c55abf921e94c1f8e1b05c6cf4f4ae9d46
- [R10] retrieval: packages/components/src/select/index.ts:7-485; sha256=f900aa02f249d9cfbbe4a2d52064511a8a36bead062fd726b181d6123a1fb719
- [R11] retrieval: packages/components/src/treeselect/index.ts:19-710; sha256=449262245d3425b7ba58dcd273d99d4441b1ceba9082bc7794c19b322699c62e
- [R12] retrieval: packages/components/src/treeselect/index.ts:19-710; sha256=449262245d3425b7ba58dcd273d99d4441b1ceba9082bc7794c19b322699c62e
- [R13] retrieval: packages/components/src/select/index.ts:7-485; sha256=f900aa02f249d9cfbbe4a2d52064511a8a36bead062fd726b181d6123a1fb719
- [R14] retrieval: doc/api/components/treeselect.md:3-6; sha256=10db7633e7ea17838c047a1fe21faa092248f151d86aa7a49a02cfd6e7b2a6ac
- [R15] retrieval: doc/api/components/treeselect.md:1-44; sha256=10db7633e7ea17838c047a1fe21faa092248f151d86aa7a49a02cfd6e7b2a6ac
- [R16] retrieval: doc/api/components/treeselect.md:7-10; sha256=10db7633e7ea17838c047a1fe21faa092248f151d86aa7a49a02cfd6e7b2a6ac
- [R17] retrieval: frameworks/ncom/runs/run-010/environment.json:?-?; sha256=3230b372ea0c44d5b804efb33a35ba4f1d1525c8270a23c7174e827a542fe6b5
- [R18] retrieval: frameworks/ncom/reports/run-009-vs-run-010-cjk-sass-fix.md:1-68; sha256=789b3bd546af7c8e8be24a6eed81e73f82ebb79f362d11ec4a1d9999265e01ca
- [R19] retrieval: frameworks/ncom/framework.yaml:10-26; sha256=f527d5b9c0a28110c597485de3505d46c53cf3c8843c055cde284d620ff76cf1
