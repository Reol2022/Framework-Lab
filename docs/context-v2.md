# Agent Context v2

`context build` 从已经校验的 ComponentKnowledge 生成指定组件的最小开发上下文：

```powershell
pnpm framework-lab context build ncom --components NCCard,NCPopconfirm
```

输出优先包含固定 commit、公共导入、属性/类型/默认值、事件、方法、插槽、一段有界官方示例、证据状态、冲突、限制和 install/build/baseline 命令。

Context v2 不默认包含大段内部实现、无关符号、整文件、无来源摘要、重复片段或未标记的不确定项。示例最多读取一个 Catalog/Symbol 已登记的官方入口并限制为 80 行；每项未解析值写作 `unresolved`。`runtimeVerified=false` 不得解释为行为已经通过。

Context v2 使用独立 `context-v2.schema.json`，不会改变旧 `context create` 及 Context v1 的格式。
