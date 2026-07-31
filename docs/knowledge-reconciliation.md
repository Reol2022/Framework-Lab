# 多来源知识校验

## 来源

统一来源枚举为 `official-doc`、`type-definition`、`source-code`、`official-example`、`test` 和 `runtime-record`。每项必须携带来源类型、相对路径或 URL、行号、SHA256 和 commit。

## 状态

- `verified`：至少两个独立来源一致，或存在运行时记录。
- `documented`：只有官方文档证据。
- `inferred`：只有类型或源码证据。
- `conflict`：来源间类型、默认值或 commit 不一致。
- `missing`：明确预期存在但没有找到。
- `unverified`：已有非源码材料但尚未完成独立验证。

名称对齐只做透明的格式归一化：属性的 camelCase/kebab-case 等价，事件允许 `nc-` 前缀差异。不会进行模糊语义猜测。

## 冲突

当前检测类型差异、默认值差异、commit 差异、文档项未在类型/源码中发现、类型/源码公开项未在文档中发现。示例 API 有效性只有在能确定引用时才报告；本轮没有静态确定的项就不生成猜测。

`suggestedAction` 只要求人工核对证据，不自动选择胜出来源，不推断根因，也不生成修复建议。

## 输出

`frameworks/<id>/knowledge/reconciled/` 包含：

- `component-knowledge.json`
- `knowledge-conflicts.json` / `.md`
- `documentation-coverage.json` / `.md`

所有 JSON 在写入前通过对应 Schema。
