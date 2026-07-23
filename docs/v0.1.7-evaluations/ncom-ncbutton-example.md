# NCButton example 检索评估

- Commit：`a350b576bbeae6c6254273037a17d2a8730fb80f`
- Retrieval：`ncom-ncbutton-example`
- Business hash：`sha256:344ea22363309015a26419fb3c7cc43a41c4f89516ac44e7769b59d9947d4944`
- Initial / expanded candidates：8 / 41
- Retrieval selected / excluded：28 / 21
- Context selected candidates：23
- Selected symbols：12；Context 的 symbol 上限保留前 7 项
- Selected document sections / examples / snippets：3 / 3 / 8
- Estimated Context tokens：3,676
- Context characters：14,703
- Selected source characters：4,269
- 对应 8 个片段所涉及完整文件总字符数：17,262
- Compression ratio：0.2473
- Low-confidence selected：0

## 人工相关性审计

主组件 `NCButton`、`ButtonProps`、`ClickEventDetail`、`createClickEvent`、`NCButton.disabled`、公开导出、按钮文档、真实 example、样式、验证命令和三个修改约束均被召回。CJK Sass issue/patch 未进入 Context。Retrieval 深度扩展产生的 `NCMessage` 和 `MessageOptions` 属于次要噪声，但位于 Context symbol 上限之外；Context 未包含其他组件。

结论：pass。

这里的 compression ratio 仅表示所选 Context 源码片段与对应候选完整源文件正文规模之比，不表示 Codex 或其他 Agent 的真实 Token 节省率。
