# NCom 八组件测试 Demo 最终报告

## 范围

仅包含 complexttable、layout、colorpicker、popconfirm、checkbox、message、card、watermark，以及同时使用 8 个组件的 integrated-demo。Modal 和其他 NCom 组件不在测试范围。

8 个单组件 Demo 和 integrated-demo 分别位于 9 个独立 TypeScript 文件、注册为 9 个独立自定义元素；`src/index.ts` 仅负责串联首页、导航和路由。每个组件页覆盖官网全部示例，并提供公开属性、枚举、方法、事件和边界输入实验区。

## 创建方式

官网提供 `npx ncom-cli my-app`。无参数命令因当前终端不能响应主题选择而退出；随后使用官网 CLI 的非交互选项成功创建：

```text
npx --yes ncom-cli ncom-official-eight-components --theme white --template minimal --port 4178 --package-manager pnpm --no-install
```

安装、lint、typecheck、build 和 dev 均使用 Framework Lab 固定 pnpm 10.26.1。

## 环境

- Node.js v24.18.0
- npm 11.7.0
- pnpm 10.26.1
- ncom-cli 0.1.0
- @ncom/all 1.0.5
- @ncom/theme 1.0.5
- TypeScript 5.9.3
- Vite 7.3.6
- 对照源码 commit：a350b576bbeae6c6254273037a17d2a8730fb80f

## 自动验证

- 安装：Passed。
- lint：Passed。
- typecheck：Passed，使用 Demo 内 paths 规避已记录的发布类型入口问题。
- build：Passed。
- 构建警告：最终主 chunk 584.90 kB，大于 500 kB；未作为失败隐藏。
- 开发服务器：Passed；Vite 7.3.6 监听 `127.0.0.1:4178`，ready 450ms；本机进程标识未写入公开报告。
- 首页 HTTP：Passed；200、`text/html`、485 bytes，包含应用入口。
- 首页加 9 个测试页面路由：Passed；10 条路由均返回 200 和应用入口。
- 静态资源：`/@vite/client` 返回 200、`text/javascript`。
- 9 个独立 Demo 模块均经 Vite 转换并返回 200；Card 官网图片返回 200、`image/png`。
- 独立 Demo 重构验证复用了已属于该项目的单一 Vite 进程，没有启动重复服务器；本地验证地址为 `http://127.0.0.1:4178/`。

## 问题

- ISSUE-NCOM-001：@ncom/all 1.0.5 exports types 指向缺失文件，confirmed。
- ISSUE-NCOM-002：Checkbox value 文档为 boolean，但示例与类型为 number 0/1/2，confirmed。
- ISSUE-NCOM-003：Card 类型公开 width/height，官网属性表未记录，open。

## 行为状态

Browser Behavior: Awaiting Manual Verification。

以下项目没有被写为通过：点击、Popconfirm 打开/关闭、Message 展示、事件 detail、视觉属性、Watermark 点击遮挡、表格编辑和综合删除流程。

当前环境没有可连接的交互式浏览器，因此真实 DOM 渲染、浏览器控制台和全部交互仍未验证。
自动打开 Windows 默认浏览器的请求也被执行策略阻止；开发服务器仍在运行，可手动打开 `http://127.0.0.1:4178/`。

## 源码边界

Demo 位于独立验证目录；没有修改 NCom 原始 worktree、组件源码或官网文档。没有安装浏览器自动化、后端或数据库。没有 commit 或 push。
