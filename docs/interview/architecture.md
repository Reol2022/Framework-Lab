# Framework Lab 架构说明

## 分层

```text
Git worktree
  → Catalog（跟踪文件、package、doc、example、config）
  → Symbol Snapshot（声明、导出、组件结构）
  → Retrieval（确定性候选、关系和评分）
  → Evidence Bundle
  → Draft / Review / Published Knowledge
  → Knowledge-first Context
  → 外部 Coding Agent
  → isolated worktree / policy / verification
```

## Evidence 与 Scope

每个 Published Knowledge 绑定 source commit、Catalog rootHash、Symbol rootHash、Bundle 和 Evidence id。路径保持仓库相对形式；绝对路径、node_modules 和 dist 不进入公开知识。

## 生命周期

- Topic：学习目标，不是事实。
- Bundle：有限证据与预算。
- Draft：外部 Agent 或人工规范化输出。
- Validate：Schema、Scope、Symbol/Component id、Evidence SHA。
- Review：显式批准/拒绝 Claim。
- Publish：不可静默覆盖。
- Version Impact：精确 hash/reference 传播，未命中则保持 current。

## 组件族

自动阶段只生成共享 base/event/slot 候选。家族名称、成员范围和限制需要显式复核。家族知识不能替代具体组件 API。

## Agent 闭环

Framework Lab 创建 Context 与受控任务材料，但不启动 Agent。实施者在独立 worktree 启动外部 Agent，随后用 policy、diff、lint/build 和必要的行为验证独立验收。

## 开源边界

可开源：CLI、Schema、选择规则、脱敏 metrics、通用报告、公开源码的脱敏 patch。

保持本地：框架 worktree、完整 Catalog/Symbol、Bundle 源码片段、Agent Draft/session、机器路径、node_modules/dist。
