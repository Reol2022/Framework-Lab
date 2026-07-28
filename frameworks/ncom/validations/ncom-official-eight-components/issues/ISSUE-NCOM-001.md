# ISSUE-NCOM-001：@ncom/all 1.0.5 exports types 指向不存在文件

## 组件

公共包 `@ncom/all`，影响八组件 TypeScript 导入。

## 问题类型

type / export / build

## 问题描述

发布包 `package.json` 的 `exports["."].types` 指向 `./dist/es/index.d.ts`，但包内不存在该文件；实际存在 `./dist/types/index.d.mts`。官方 CLI 新建项目执行 `tsc --noEmit` 时出现 TS7016。

## 复现步骤

1. 使用 `ncom-cli` 0.1.0 创建 minimal 项目。
2. 安装 `@ncom/all` 1.0.5。
3. 在 TypeScript 中从 `@ncom/all` 导入 `NComponent`。
4. 执行 `tsc --noEmit`。

## 最小复现代码

```ts
import { NComponent } from "@ncom/all";
```

## 预期结果

TypeScript 通过 exports 找到公开声明文件。

## 实际结果

TS7016，并明确提示存在 `dist/types/index.d.mts`，但在尊重 package exports 时无法解析。

## 官网记录

官网推荐从 `@ncom/all` 导入。

## 类型或源码记录

- `node_modules/@ncom/all/package.json`
- `node_modules/@ncom/all/dist/types/index.d.mts`
- 缺失：`node_modules/@ncom/all/dist/es/index.d.ts`

## 环境

Node v24.18.0；pnpm 10.26.1；TypeScript 5.9.3；@ncom/all 1.0.5。

## 当前状态

confirmed。Demo 内使用 tsconfig paths 临时规避；未修改 NCom 包。
