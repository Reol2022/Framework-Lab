# ISSUE-NCOM-003：Card 类型声明的 width/height 未出现在官网属性表

## 组件

Card

## 问题类型

documentation / type

## 问题描述

发布包 `CardProps` 声明 `width` 和 `height`，官网 Card 属性表只列出 header、footer、body-style、shadow。

## 复现步骤

1. 打开官网 `/doc/component/card`。
2. 查看 Card 属性表。
3. 对照发布包 CardProps。

## 最小复现代码

```ts
interface CardProps {
  width?: string;
  height?: string;
}
```

## 预期结果

如果 width/height 是公开 API，官网应记录；若不是，公开类型不应暴露或应说明边界。

## 实际结果

类型公开但官网属性表未记录。

## 官网记录

官网 Card 属性表仅列 4 项。

## 类型或源码记录

`node_modules/@ncom/all/dist/types/components/src/card/types.d.ts`

## 环境

@ncom/all 1.0.5；官网读取日期 2026-07-27。

## 当前状态

open。尚未通过人工运行确认 width/height 行为。
