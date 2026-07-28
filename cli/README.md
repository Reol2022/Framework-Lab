# CLI

## v0.2.3 覆盖、质量与评测

```text
framework-lab learn gaps <framework-id>
framework-lab learn prioritize <framework-id>
framework-lab learn families <framework-id>
framework-lab learn review-family <framework-id> <family-id>
  --decision <approved|rejected> --name <name> --reviewer <reviewer>
  [--component <component-id>]... [--add-limitation <text>]...
framework-lab learn quality <framework-id>
framework-lab learn conflicts <framework-id>
framework-lab learn validate-evaluation <framework-id>
framework-lab learn evaluate <framework-id>
framework-lab learn economics <framework-id>
```

`families` 只从 Symbol Snapshot 的 base/event/slot 结构信号生成候选；`review-family` 才保存明确名称和成员范围。`conflicts` 只报告精确结构化值冲突，不做文本语义猜测。`evaluate` 使用固定任务集生成 Raw 与 Knowledge-first Context，并明确把 tokens 标为字符启发式估计。

## Symbols

```text
framework-lab symbols extract <framework-id> [--catalog-snapshot <id>] [--source-dir <path>]
  [--snapshot-id <id>] [--syntax-only] [--include-internal] [--dry-run]
  [--force] [--max-diagnostics <number>]
framework-lab symbols validate <framework-id>
framework-lab symbols list <framework-id>
framework-lab symbols query <framework-id> [--name <text>] [--kind <kind>]
  [--package <name-or-id>] [--module <path>] [--exported-only] [--public-only]
  [--component-only] [--limit <number>] [--json]
framework-lab symbols diff <framework-id> <from-snapshot> <to-snapshot> [--force]
```

提取前必须先通过 Catalog 校验并确认源码 HEAD/clean 状态。语义诊断不会抹除语法级结果；blocking 诊断不会更新 `current.json`。

## Catalog

```text
framework-lab catalog scan <framework-id> [--source-dir <path>] [--snapshot-id <id>]
  [--allow-dirty] [--dry-run] [--force] [--max-file-size <bytes>]
  [--include <glob>]... [--exclude <glob>]...
framework-lab catalog validate <framework-id>
framework-lab catalog list <framework-id>
framework-lab catalog diff <framework-id> <from-snapshot> <to-snapshot> [--force]
```

`scan` 默认只读取 Git 跟踪文件，并拒绝 tracked dirty worktree。干净 worktree 的默认 snapshot id 是完整 commit；`--allow-dirty` 生成带内容 fingerprint 的 dirty id。输出先写入临时目录，通过 Schema 后原子移动。`--force` 只覆盖 Catalog 派生产物，不修改源码。

`diff` 只使用路径、SHA256、分类和 package 归属；rename 必须是一对一的完全相同哈希，不做模糊推断。

## 执行基线

```text
pnpm framework-lab baseline run <framework-id> [options]
```

- `--run-id <id>`：指定编号，拒绝覆盖已有 Run。
- `--source-dir <dir>`：覆盖源码目录，相对路径从仓库根目录解析。
- `--dry-run`：只预览，不执行步骤或创建 Run。

非 dry-run 运行会自动生成 `errors.json`，并在新 `run.json` 和 `report.md` 中引用结构化错误摘要。

## 回放错误日志

```text
pnpm framework-lab errors parse <framework-id> <run-id> [--force]
```

命令只读取既有 `run.json`、`source.json` 和步骤日志。默认不覆盖 `errors.json`；`--force` 只覆盖派生的 `errors.json`，不修改原始日志、步骤结果、`run.json` 或 `report.md`。

未知 Run、非法 `run.json`、缺失日志和非显式覆盖均返回非零退出码。

## 退出状态

- baseline 最终状态 `failed`：非零。
- baseline 最终状态 `passed` 或 `partial`：零。
- errors parse 成功：零；输入或证据错误：非零。

Windows `.cmd`/`.bat` 使用显式 `cmd.exe /d /s /c` 适配并保持 Node `spawn` 的 `shell:false`。

## 知识与上下文

```text
framework-lab knowledge validate <framework-id>
framework-lab knowledge index <framework-id>
framework-lab context create <framework-id> --task <text> [options]
```

context 支持 `--source-commit`、`--run-id`、`--os`、`--node-version`、`--package-manager-version`、`--budget`、`--context-id`、重复的 `--include-card/--exclude-card`、`--dry-run` 和 `--force`。显式参数优先于 Run 推导环境。

v0.1.7 新增 `--retrieval-id`、`--with-framework-knowledge`、`--without-framework-knowledge`、`--include-source-snippets`、`--max-snippet-lines`、`--max-symbols`、`--max-doc-sections`、`--max-examples`、`--max-source-snippets` 和 `--explain-selection`。没有有效 Catalog/Symbol Snapshot 时自动回退到 v0.1.4 卡片上下文。

## Retrieval

```text
framework-lab retrieval query <framework-id> --task <text>
  [--source-commit <sha>] [--run-id <id>]
  [--catalog-snapshot <id>] [--symbol-snapshot <id>]
  [--package <name-or-id>]... [--symbol <name>]... [--component <name>]...
  [--include-internal] [--max-depth <n>] [--limit <n>]
  [--retrieval-id <id>] [--dry-run] [--force] [--json]
framework-lab retrieval validate <framework-id> <retrieval-id>
framework-lab retrieval explain <framework-id> <retrieval-id>
```

检索不调用 LLM、embedding 或外部服务；候选按精确标识符、公共可达性、任务意图、图距离、Scope、证据完整度和诊断完整度透明计分。
# v0.2.0 受控任务命令

## v0.2.1 学习命令

```text
pnpm framework-lab learn plan <framework-id>
pnpm framework-lab learn bundle <framework-id> <topic-id>
pnpm framework-lab learn handoff <framework-id> <bundle-id>
pnpm framework-lab learn import <framework-id> <bundle-id> --input <file>
pnpm framework-lab learn validate|review|publish|supersede <framework-id> <knowledge-id>
pnpm framework-lab learn coverage|list <framework-id>
pnpm framework-lab learn show <framework-id> <knowledge-id>
```

学习 Bundle 与 Draft 默认保持本地；`publish` 只在 Schema、Evidence 和人工 review 都通过后写入可复用知识单元。

```text
pnpm framework-lab task create <framework-id> --task <text> [options]
pnpm framework-lab task validate <framework-id> <task-id>
pnpm framework-lab task prepare <framework-id> <task-id>
pnpm framework-lab task handoff <framework-id> <task-id>
pnpm framework-lab task inspect <framework-id> <task-id>
pnpm framework-lab task verify <framework-id> <task-id>
pnpm framework-lab task compare <framework-id> <task-id>
pnpm framework-lab task status <framework-id> <task-id>
pnpm framework-lab task close <framework-id> <task-id> --outcome <accepted|rejected|archived>
pnpm framework-lab task list <framework-id>
```

`create` 只生成任务包；`prepare` 才创建 detached worktree；`handoff` 只输出说明，不启动 Agent。Agent 完成后由 `inspect` 与 `verify` 独立采集 Git 和运行证据。`--force` 只刷新允许重算的派生产物，不覆盖历史状态记录。
# v0.2.2 版本与新鲜度命令

```text
framework-lab version create <framework-id> [--version-id <id>] [--catalog-snapshot <id>] [--symbol-snapshot <id>] [--tag <tag>] [--branch <branch>]
framework-lab version validate <framework-id> <version-id>
framework-lab version list <framework-id>
framework-lab version diff <framework-id> <from-version> <to-version>
framework-lab knowledge impact <framework-id> <version-diff-id>
framework-lab knowledge freshness <framework-id> [--target-version <version-id>]
framework-lab learn refresh-plan <framework-id> <impact-id>
framework-lab learn refresh-bundle <framework-id> <refresh-id> <refresh-topic-id>
framework-lab learn carry-forward <framework-id> <knowledge-id>
framework-lab learn retire <framework-id> <knowledge-id>
```

`version diff` 只组合已有 Catalog 与 Symbol Diff，不执行源码。`learn import --dry-run` 只做 Draft 预校验，不写入草稿。
