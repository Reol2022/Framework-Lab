# Agent Context: eval-v023-input-family-selection-knowledge-first

## Task

选择一个继承 NCBaseInput 的 NCom 输入组件，并比较 NCSelect、NCCheckbox 与 NCInput 的可用证据。

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
- **component: NCCheckbox** — NCCheckbox component; NCBaseInput (score=270, confidence=high, evidence=packages/components/src/checkbox/index.ts:12)
- **component: NCInput** — NCInput component; NCBaseInput (score=270, confidence=high, evidence=packages/components/src/input/index.ts:22)

## Validated Knowledge Claims

- 复核成员在锁定 Symbol Snapshot 中共享 base:NCBaseInput 结构信号。 [K:ncom-family-input-controls:E1] [K:ncom-family-input-controls:E2] [K:ncom-family-input-controls:E3] [K:ncom-family-input-controls:E4] [K:ncom-family-input-controls:E5] [K:ncom-family-input-controls:E6]
- NCInput-related declarations occur in the bounded evidence for the locked commit. [K:ncom-ncinput-events:E1]
- NCSelect 在锁定 Symbol Snapshot 中公共可达，继承 NCBaseInput；登记事件 change，slots 无，文档 1 个，示例文件 9 个。 [K:ncom-ncselect-structure:E1] [K:ncom-ncselect-structure:E2] [K:ncom-ncselect-structure:E3] [K:ncom-ncselect-structure:E4] [K:ncom-ncselect-structure:E5]
- NCCheckbox 在锁定 Symbol Snapshot 中公共可达，继承 NCBaseInput；登记事件 change，slots default，文档 1 个，示例文件 6 个。 [K:ncom-nccheckbox-structure:E1] [K:ncom-nccheckbox-structure:E2] [K:ncom-nccheckbox-structure:E3] [K:ncom-nccheckbox-structure:E4] [K:ncom-nccheckbox-structure:E5] [K:ncom-nccheckbox-structure:E6] [K:ncom-nccheckbox-structure:E7] [K:ncom-nccheckbox-structure:E8]
- 受控 Run 使用 win32 10.0.19045 x64、Node v24.18.0、npm 11.7.0 和 pnpm 10.26.1。 [E1]
- 基线依次运行 pnpm install --frozen-lockfile、lint:eslint 和 build。 [E5]
- Run 009 与 Run 010 对照使用原始和独立候选 worktree，历史证据不得由候选修复覆盖。 [E6]
- Framework Lab 配置中的框架 id 为 ncom，名称为 New Component。 [E7]

## Limitations and Confidence

- 该环境记录不证明其他 Windows、Node 或 pnpm 组合等价。
- lint 在 Run 009/010 中仍失败并被配置为 allow_failure。
- 该约束描述 Framework Lab 本次受控工作流，不代表 NCom 上游流程。
- 本卡不描述未由现有证据验证的 NCom 架构或 API。
- TypeScript semantic analysis is limited by unresolved modules and diagnostics.
- knowledge-first: 4 published units; raw fallback candidates=21

## Evidence Index

- [E1] run: frameworks/ncom/runs/run-010/environment.json; run=run-010; commit=a350b576bbeae6c6254273037a17d2a8730fb80f; sha256=3230b372ea0c44d5b804efb33a35ba4f1d1525c8270a23c7174e827a542fe6b5
- [E5] framework_config: frameworks/ncom/framework.yaml; commit=a350b576bbeae6c6254273037a17d2a8730fb80f; sha256=f527d5b9c0a28110c597485de3505d46c53cf3c8843c055cde284d620ff76cf1
- [E6] comparison_report: frameworks/ncom/reports/run-009-vs-run-010-cjk-sass-fix.md; commit=a350b576bbeae6c6254273037a17d2a8730fb80f; sha256=789b3bd546af7c8e8be24a6eed81e73f82ebb79f362d11ec4a1d9999265e01ca
- [E7] framework_config: frameworks/ncom/framework.yaml; commit=a350b576bbeae6c6254273037a17d2a8730fb80f; sha256=f527d5b9c0a28110c597485de3505d46c53cf3c8843c055cde284d620ff76cf1
- [R1] retrieval: packages/components/src/select/index.ts:7-485; sha256=f900aa02f249d9cfbbe4a2d52064511a8a36bead062fd726b181d6123a1fb719
- [R2] retrieval: packages/components/src/checkbox/index.ts:12-156; sha256=982a003822f54de1f742f2180aa64e18ac17d69dd62e528311f0cd1b599b4ef5
- [R3] retrieval: packages/components/src/input/index.ts:22-569; sha256=0891cc9cc6197cda760d13ef94ec27b41d1bc696139e53ace106eea99e65cf68
- [R4] retrieval: packages/components/src/form/baseinput.ts:7-46; sha256=01d9576e5f3976e060d7b12e6ed6b87f182f6474f79785d61e2f9e3002088d89
- [R5] retrieval: packages/components/src/form/baseinput.ts:7-46; sha256=01d9576e5f3976e060d7b12e6ed6b87f182f6474f79785d61e2f9e3002088d89
- [R6] retrieval: packages/components/src/checkbox/index.ts:12-156; sha256=982a003822f54de1f742f2180aa64e18ac17d69dd62e528311f0cd1b599b4ef5
- [R7] retrieval: packages/components/src/select/index.ts:7-485; sha256=f900aa02f249d9cfbbe4a2d52064511a8a36bead062fd726b181d6123a1fb719
- [R8] retrieval: packages/components/src/input/index.ts:22-569; sha256=0891cc9cc6197cda760d13ef94ec27b41d1bc696139e53ace106eea99e65cf68
- [R9] retrieval: packages/components/src/treeselect/types.ts:5-24; sha256=8494c1c38a7942f71a69ae9a8bc56871d6e44a8fd3eb8a7dd3f4eb85cc6a11d4
- [R10] retrieval: packages/components/src/treeselect/index.ts:19-710; sha256=449262245d3425b7ba58dcd273d99d4441b1ceba9082bc7794c19b322699c62e
- [R11] retrieval: packages/components/src/select/types.ts:4-24; sha256=08f859e6e0c0d2b549a46acfb72f19f40c65d8c47a85ad7c0b326ae70025db64
- [R12] retrieval: packages/components/src/select/index.ts:7-485; sha256=f900aa02f249d9cfbbe4a2d52064511a8a36bead062fd726b181d6123a1fb719
- [R13] retrieval: packages/components/src/form/baseinput.ts:7-46; sha256=01d9576e5f3976e060d7b12e6ed6b87f182f6474f79785d61e2f9e3002088d89
- [R14] retrieval: packages/components/src/checkbox/index.ts:12-156; sha256=982a003822f54de1f742f2180aa64e18ac17d69dd62e528311f0cd1b599b4ef5
- [R15] retrieval: packages/components/src/input/index.ts:22-569; sha256=0891cc9cc6197cda760d13ef94ec27b41d1bc696139e53ace106eea99e65cf68
- [R16] retrieval: packages/components/src/treeselect/index.ts:19-710; sha256=449262245d3425b7ba58dcd273d99d4441b1ceba9082bc7794c19b322699c62e
- [R17] retrieval: doc/api/components/treeselect.md:3-6; sha256=10db7633e7ea17838c047a1fe21faa092248f151d86aa7a49a02cfd6e7b2a6ac
- [R18] retrieval: frameworks/ncom/runs/run-010/environment.json:?-?; sha256=3230b372ea0c44d5b804efb33a35ba4f1d1525c8270a23c7174e827a542fe6b5
- [R19] retrieval: frameworks/ncom/framework.yaml:10-26; sha256=f527d5b9c0a28110c597485de3505d46c53cf3c8843c055cde284d620ff76cf1
- [R20] retrieval: frameworks/ncom/framework.yaml:1-6; sha256=f527d5b9c0a28110c597485de3505d46c53cf3c8843c055cde284d620ff76cf1
- [R21] retrieval: frameworks/ncom/reports/run-009-vs-run-010-cjk-sass-fix.md:1-68; sha256=789b3bd546af7c8e8be24a6eed81e73f82ebb79f362d11ec4a1d9999265e01ca
