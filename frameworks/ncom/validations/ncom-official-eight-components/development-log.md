# 开发问题日志

## 环境

- 日期：2026-07-27
- Node.js：v24.18.0
- npm：11.7.0
- 固定 pnpm：10.26.1
- 官网 CLI：ncom-cli 0.1.0
- 发布包：@ncom/all 1.0.5、@ncom/theme 1.0.5
- 对照源码 commit：a350b576bbeae6c6254273037a17d2a8730fb80f

## 官网访问

- 交互式浏览器连接不可用，未伪造浏览器读取结果。
- `http://ncom.lab209.com/doc/component/overview` 返回 HTTP 200。
- 页面是 Vite 客户端应用；通过其公开 JS chunk/source map 读取 8 个组件的属性、事件、方法和示例源。
- HTTPS 请求在当前环境超时；官网给定 HTTP 地址可访问。
- 官网正式路由确认包含 `/complexttable`，未改写为其他拼写。

## 创建过程

首次命令：

```text
npx --yes ncom-cli ncom-official-eight-components
```

结果：CLI 进入主题交互选择；当前非交互终端无法回答，提示 `User force closed the prompt`。这属于执行环境/CLI 交互问题，不是组件 Bug。

查看 `--help` 后使用：

```text
npx --yes ncom-cli ncom-official-eight-components --theme white --template minimal --port 4178 --package-manager pnpm --no-install
```

结果：创建成功。

安装使用 Framework Lab 固定 pnpm 10.26.1。安装期间镜像请求发生 ECONNRESET 重试，但最终成功。

## 依赖与类型

- CLI 生成 `@ncom/all:^1.0.1`，安装时解析到 1.0.5；为保证复现，已将 Demo 依赖固定为 1.0.5。
- 原始脚手架执行 `tsc --noEmit` 触发 TS7016。详见 ISSUE-NCOM-001。
- Demo 只在 `tsconfig.json` 使用 paths 指向包内已存在的 `dist/types/index.d.mts`，没有修改 node_modules。

## 构建

- lint：通过。
- typecheck：通过。
- build：通过。
- Vite 报告主 chunk 571.93 kB，大于 500 kB。这是全量 `@ncom/all` 导入下的体积警告，不是构建失败，本轮不做拆包优化。

## 开发服务器与 HTTP

- Vite 7.3.6 在 `127.0.0.1:4178` 启动，ready 时间 450ms。
- 监听进程：验证时存在单一 Vite 监听进程；本机进程标识不进入公开记录。
- 首页及 `/complex-table`、`/layout`、`/color-picker`、`/popconfirm`、`/checkbox`、`/message`、`/card`、`/watermark`、`/integrated-demo` 均返回 HTTP 200、`text/html`。
- 每个 HTML 响应都包含 `/src/index.ts` 和 `nc-official-eight-demo` 入口。
- `/@vite/client` 返回 HTTP 200、`text/javascript`。
- 当前环境没有可连接的交互式浏览器，未执行点击和浏览器控制台检查。
- HTTP 验证完成后已停止临时进程，确认端口 4178 不再监听；人工验收时按 README 重新启动。

## 2026-07-28 独立 Demo 重构

- 根据人工反馈，将原先集中在单个入口组件中的案例拆成 9 个独立自定义元素文件：8 个单组件 Demo 和 1 个综合 Demo。
- `src/index.ts` 只保留首页、导航、路由与组件导入，不再包含各组件案例实现。
- 每个单组件 Demo 按官网示例逐节呈现，并增加公开属性、枚举、方法、事件、动态修改和边界输入实验；未公开 API 仍明确排除。
- ComplexTable 页面列出并可分别调用 20 个公开方法，记录 7 类公开事件。
- 修正 ColorPicker 标签为发布包实际注册的 `nc-colorpicker`；Popconfirm placement 只保留类型声明的 `top|right|bottom|left`。
- 固定 pnpm 10.26.1 下 lint、typecheck、build 再次通过。最终构建主 chunk 584.90 kB，仍有大于 500 kB 的非阻塞警告。
- 源码核对发现 Popconfirm 实际派发 `ok/cancel` 且依赖触发元素的 `nc-click`，因此所有 Popconfirm 示例改用 `nc-button`；ColorPicker presets 改为数组表达式。相关测试记录和人工清单同步修正。
- 10 条路由均返回 HTTP 200，入口模块返回 `text/javascript`；9 个自定义元素标签各有且仅有一个独立定义文件。
- 10 个 Demo 模块经开发服务器逐一转换并返回 HTTP 200；Card 官网示例图片返回 HTTP 200、`image/png`。
- 检查时发现已有属于本项目的 Vite 进程监听 4178，按“禁止重复服务器”规则复用，没有再启动第二个服务器。
- 浏览器连接仍不可用，因此没有把渲染、点击、事件和视觉表现写成 Passed。
- `Start-Process "http://127.0.0.1:4178/"` 被当前执行策略阻止；服务器保持运行，用户可复制地址或点击报告中的链接打开。

## 额外人工反馈

Modal 曾出现打开后无法关闭的问题，尚未在本轮测试环境复现和确认。
