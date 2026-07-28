# Agent Context: eval-v023-ncdrawer-events-knowledge-first

## Task

创建 NCDrawer 示例并处理 open 与 close 事件，同时使用 default slot。

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

- **component: NCDrawer** — NCDrawer component; NComponent (score=270, confidence=high, evidence=packages/components/src/drawer/index.ts:7)
- **symbol: NCDrawer** — class NCDrawer extends NComponent (score=259, confidence=high, evidence=packages/components/src/drawer/index.ts:7)
- **symbol: DrawerDirection** — type DrawerDirection = "left" | "right" | "top" | "bottom" (score=85, confidence=high, evidence=packages/components/src/drawer/types.ts:1)

## Validated Knowledge Claims

- NComponent 声明 _templateFrag、_mounted 和 root 成员，构造阶段创建 open ShadowRoot。 [K:ncom-template-rendering-structure:E1] [K:ncom-template-rendering-structure:E2] [K:ncom-template-rendering-structure:E3] [K:ncom-template-rendering-structure:E4] [K:ncom-template-rendering-structure:E5] [K:ncom-template-rendering-structure:E6]
- NComponent extends HTMLElement；所给构造函数片段创建 EventManager 并以 open 模式 attachShadow。 [K:ncom-lifecycle-callback-structure:E1] [K:ncom-lifecycle-callback-structure:E2] [K:ncom-lifecycle-callback-structure:E3] [K:ncom-lifecycle-callback-structure:E4] [K:ncom-lifecycle-callback-structure:E5] [K:ncom-lifecycle-callback-structure:E6]
- NCAlert、NCDrawer 与 NCModal 在锁定 Symbol Snapshot 中都登记了 close 事件。 [K:ncom-family-closable-feedback-overlay:E1] [K:ncom-family-closable-feedback-overlay:E2] [K:ncom-family-closable-feedback-overlay:E3]
- NCDrawer 在锁定 Symbol Snapshot 中公共可达，继承 NComponent；登记事件 close, open，slots default，文档 1 个，示例文件 4 个。 [K:ncom-ncdrawer-structure:E1] [K:ncom-ncdrawer-structure:E2] [K:ncom-ncdrawer-structure:E3] [K:ncom-ncdrawer-structure:E4] [K:ncom-ncdrawer-structure:E5] [K:ncom-ncdrawer-structure:E6] [K:ncom-ncdrawer-structure:E7] [K:ncom-ncdrawer-structure:E8]
- Run 009 与 Run 010 对照使用原始和独立候选 worktree，历史证据不得由候选修复覆盖。 [E1]
- 受控 Run 使用 win32 10.0.19045 x64、Node v24.18.0、npm 11.7.0 和 pnpm 10.26.1。 [E2]
- 基线依次运行 pnpm install --frozen-lockfile、lint:eslint 和 build。 [E3]

## Limitations and Confidence

- 该约束描述 Framework Lab 本次受控工作流，不代表 NCom 上游流程。
- 该环境记录不证明其他 Windows、Node 或 pnpm 组合等价。
- lint 在 Run 009/010 中仍失败并被配置为 allow_failure。
- TypeScript semantic analysis is limited by unresolved modules and diagnostics.
- knowledge-first: 4 published units; raw fallback candidates=20

## Evidence Index

- [E1] comparison_report: frameworks/ncom/reports/run-009-vs-run-010-cjk-sass-fix.md; commit=a350b576bbeae6c6254273037a17d2a8730fb80f; sha256=789b3bd546af7c8e8be24a6eed81e73f82ebb79f362d11ec4a1d9999265e01ca
- [E2] run: frameworks/ncom/runs/run-010/environment.json; run=run-010; commit=a350b576bbeae6c6254273037a17d2a8730fb80f; sha256=3230b372ea0c44d5b804efb33a35ba4f1d1525c8270a23c7174e827a542fe6b5
- [E3] framework_config: frameworks/ncom/framework.yaml; commit=a350b576bbeae6c6254273037a17d2a8730fb80f; sha256=f527d5b9c0a28110c597485de3505d46c53cf3c8843c055cde284d620ff76cf1
- [R1] retrieval: packages/components/src/drawer/index.ts:7-259; sha256=d68a73bcd4262952a6789e72dd8ec484c3d27c99c36a2792ce23246f44b9c4c5
- [R2] retrieval: packages/components/src/drawer/index.ts:7-259; sha256=d68a73bcd4262952a6789e72dd8ec484c3d27c99c36a2792ce23246f44b9c4c5
- [R3] retrieval: packages/components/src/drawer/types.ts:1-1; sha256=f1235e2d12417cfe4e969e2da835f106aaac63930ea541b2118a6d1098f35652
- [R4] retrieval: packages/core/src/component.ts:18-348; sha256=44590f0a625da3d091abffd8518f6c4998aeae9821fa10834edf61ed51b00240
- [R5] retrieval: packages/components/src/drawer/index.ts:68-74; sha256=d68a73bcd4262952a6789e72dd8ec484c3d27c99c36a2792ce23246f44b9c4c5
- [R6] retrieval: packages/components/src/drawer/index.ts:242-258; sha256=d68a73bcd4262952a6789e72dd8ec484c3d27c99c36a2792ce23246f44b9c4c5
- [R7] retrieval: packages/components/src/drawer/index.ts:211-213; sha256=d68a73bcd4262952a6789e72dd8ec484c3d27c99c36a2792ce23246f44b9c4c5
- [R8] retrieval: packages/components/src/drawer/index.ts:56-62; sha256=d68a73bcd4262952a6789e72dd8ec484c3d27c99c36a2792ce23246f44b9c4c5
- [R9] retrieval: packages/components/src/drawer/index.ts:7-259; sha256=d68a73bcd4262952a6789e72dd8ec484c3d27c99c36a2792ce23246f44b9c4c5
- [R10] retrieval: packages/components/src/drawer/index.ts:7-259; sha256=d68a73bcd4262952a6789e72dd8ec484c3d27c99c36a2792ce23246f44b9c4c5
- [R11] retrieval: example/component/drawer/components/ex2.ts:1-52; sha256=cdf86e3223f4d5ad99989b8a7276c1980d3df4f74d2e60f2d3f1250037b73b63
- [R12] retrieval: example/component/drawer/components/ex1.ts:1-61; sha256=dbbad73f9b3d57247ee0ebc79d2537ed15ede418ff3ec2674f23e1dda3eb43d0
- [R13] retrieval: example/component/drawer/components/ex3.ts:1-105; sha256=0b1cac500b3aa8f17b1fe12602e9203593a08632057b74bdd55f816a5201e2d0
- [R14] retrieval: doc/api/components/drawer.md:3-6; sha256=ffdfa9c11cf54c38c477aae1eb85b5e637cd9fd2cceb215607b8d45e9e52837b
- [R15] retrieval: doc/api/components/drawer.md:1-61; sha256=ffdfa9c11cf54c38c477aae1eb85b5e637cd9fd2cceb215607b8d45e9e52837b
- [R16] retrieval: doc/api/components/drawer.md:7-10; sha256=ffdfa9c11cf54c38c477aae1eb85b5e637cd9fd2cceb215607b8d45e9e52837b
- [R17] retrieval: frameworks/ncom/runs/run-010/environment.json:?-?; sha256=3230b372ea0c44d5b804efb33a35ba4f1d1525c8270a23c7174e827a542fe6b5
- [R18] retrieval: frameworks/ncom/framework.yaml:10-26; sha256=f527d5b9c0a28110c597485de3505d46c53cf3c8843c055cde284d620ff76cf1
- [R19] retrieval: frameworks/ncom/reports/run-009-vs-run-010-cjk-sass-fix.md:1-68; sha256=789b3bd546af7c8e8be24a6eed81e73f82ebb79f362d11ec4a1d9999265e01ca
- [R20] retrieval: packages/components/src/drawer/style.scss:1-225; sha256=ebf27f62367a50dd62caac11ef291a1d0af2901c26da7525a4d96c6df9fd20f0
