# NCInput value change 检索评估

- Commit：`a350b576bbeae6c6254273037a17d2a8730fb80f`
- Retrieval：`ncom-ncinput-change`
- Business hash：`sha256:66c3c98d15f50a5d027a8745222e6d616840975e75e21da1f38cb980711046b4`
- Initial / expanded candidates：8 / 47
- Retrieval selected / excluded：30 / 25
- Context selected candidates：23
- Selected symbols：12；Context 的 symbol 上限保留前 7 项
- Selected document sections / examples / snippets：3 / 3 / 8
- Estimated Context tokens：3,979
- Context characters：15,914
- Selected source characters：5,259
- 对应 8 个片段所涉及完整文件总字符数：23,421
- Compression ratio：0.2245
- Low-confidence selected：0

## 人工相关性审计

召回 `NCInput`、`NCBaseInput` 继承关系、`ChangeEventDetail`、`createChangeEvent`、value 成员、公开导出、Input 文档和现有示例。`RangeChangeEventDetail` 与 `RangeValue` 是关系扩展得到的外围类型，相关度低于核心输入类型，并在 Context 的 7 个 symbol 预算边界处受到限制；没有拉入大量其他输入组件。

结论：pass。

这里的 compression ratio 仅表示所选 Context 源码片段与对应候选完整源文件正文规模之比，不表示真实 Agent Token 节省率。
