# NCom 八组件测试 Demo 验证记录

## 目的

对照 NCom 官网正式文档，在独立项目中复现 8 个组件及综合场景，保存环境、实现、问题和人工验收清单。

Demo 源码位于：

```text
.framework-sources/validation/ncom-official-eight-components
```

## 测试范围

| 分类 | 官网组件 | 本地路由 |
| --- | --- | --- |
| 数据展示 | complexttable | `/complex-table` |
| 布局 | layout | `/layout` |
| 数据录入 | colorpicker | `/color-picker` |
| 反馈 | popconfirm | `/popconfirm` |
| 数据录入 | checkbox | `/checkbox` |
| 反馈 | message | `/message` |
| 数据展示 | card | `/card` |
| 数据展示 | watermark | `/watermark` |

另有 `/integrated-demo`。

## 记录

- `test-record.md`：官网 API、示例、源码和类型位置。
- `development-log.md`：CLI、依赖、构建和运行问题。
- `issues/`：实际发现的组件、文档、类型或发布问题。
- `manual-checklist.md`：用户无需阅读源码即可执行的人工步骤。
- `final-report.md`：自动验证和人工验证边界。

当前所有行为结论均为 `Awaiting Manual Verification`。
