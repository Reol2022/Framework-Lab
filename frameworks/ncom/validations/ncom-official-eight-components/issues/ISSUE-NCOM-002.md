# ISSUE-NCOM-002：Checkbox 官网 value 类型与示例及类型声明不一致

## 组件

Checkbox

## 问题类型

documentation / example / type

## 问题描述

官网属性表把 `value` 写为 `boolean`，默认 `false`；同一官网的示例使用 0、1、2 表示未选、选中、半选，发布包声明也为 number。

## 复现步骤

1. 打开官网 `/doc/component/checkbox`。
2. 查看属性表中的 value。
3. 查看选中、半选和交互示例。
4. 对照发布包 `NCCheckbox.value` 类型。

## 最小复现代码

```html
<nc-checkbox value="2">半选</nc-checkbox>
```

## 预期结果

属性表、示例和类型声明使用同一类型及状态语义。

## 实际结果

属性表为 boolean；示例和类型为 number 0/1/2。

## 官网记录

官网 Checkbox props source map 与 ex2/ex3/ex5 示例。

## 类型或源码记录

`node_modules/@ncom/all/dist/types/components/src/checkbox/index.d.ts`

## 环境

@ncom/all 1.0.5；官网读取日期 2026-07-27。

## 当前状态

confirmed。运行行为仍待人工复核。
