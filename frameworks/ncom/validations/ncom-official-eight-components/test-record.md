# NCom 八组件官网 API 测试记录

## 证据范围

- 官网入口：`http://ncom.lab209.com/doc/component/overview`
- 官网组件路由：`http://ncom.lab209.com/doc/component/<route>`
- 官网 API chunk 与 source map：2026-07-27 成功读取。
- 发布包：`@ncom/all` 1.0.5、`@ncom/theme` 1.0.5。
- 对照源码 commit：`a350b576bbeae6c6254273037a17d2a8730fb80f`，仅用于位置和差异核对。

推荐导入：

```ts
import "@ncom/theme/white";
import { Message, NCComplextTable, NComponent, defineComponent } from "@ncom/all";
```

## ComplexTable

- 官网分类：数据展示。
- 官网名称：复杂表格-complexttable。
- 官网路由：`/doc/component/complexttable`。
- 标签：`nc-complexttable`。
- 导入方式：从 `@ncom/all` 导入 `NCComplextTable` 和 `ComplextTableColumn`；导入包也会注册标签。
- 属性：`keyname:string=key`；`data-source:Record<string, unknown>[]`；`items:ComplextTableColumn[]`；`sub-items`；`children-key=children`；`expandable`；`grid-line=rows|cols|both`；`row-alt`；`header-style`；`checkable`；`single`；`editable`。
- 列配置：`label`、`name` 必填；可选 `width`、`type`、`sort`、`html`、`render`、`editable`、`editor=input|select|datepicker|treeselect`、`dataSource`。
- 方法：`insertRow`、`updateRow`、`updateCell`、`removeRow`、`setRecords`、`getRecords`、`getSelectedRows`、`selectRow`、`setRowStyle`、`setCellStyle`、`expandRow`、`collapseRow`、`toggleExpand`、`setChildren`、`startEdit`、`saveEdit`、`cancelEdit`、`isEditing`、`getEditingKey`、`setColDataSource`。
- 事件：`nc-rowclick`、`nc-rowdblclick`、`nc-expand`、`nc-collapse`、`nc-editstart`、`nc-change`、`nc-cancel`。行事件 detail 包含 `data`、`dom`；保存事件 detail 包含 `oldValue`、`value`、`dom`。
- 插槽：官网未列出业务插槽。
- 官网示例：基础数据与列；展开子表；行内编辑；动态 `setChildren`。
- 官网未列出：pagination、loading、固定列、复杂表头。Demo 不猜测这些 API。
- 源码位置：`packages/components/src/complexttable/index.ts`、`types.ts`。
- 类型位置：`node_modules/@ncom/all/dist/types/components/src/complexttable/`。
- 当前状态：Awaiting Manual Verification。

## Layout

- 官网分类：布局。
- 官网名称：布局-Layout。
- 官网路由：`/doc/component/layout`。
- 标签：`nc-layout`。
- 导入方式：`NCLayout` from `@ncom/all`。
- 属性：`splitter`；`min-size:number=48`；原生 `style`。
- 方法：官网没有公开方法。
- 事件：`nc-change`，拖拽结束 detail 为 `{ oldValue: 区域名, value: 新尺寸 }`。
- 插槽：`north`、`south`、`west`、`east`、`center`。
- 官网示例：五区域布局、仅 center、Header/Content/Footer、侧栏、嵌套 Layout、splitter 拖拽。
- 源码位置：`packages/components/src/layout/index.ts`。
- 类型位置：`node_modules/@ncom/all/dist/types/components/src/layout/index.d.ts`。
- 当前状态：Awaiting Manual Verification。

## ColorPicker

- 官网分类：数据录入。
- 官网名称：颜色选择器-ColorPicker。
- 官网路由：`/doc/component/colorpicker`。
- 标签：`nc-colorpicker`。
- 导入方式：`NCColorPicker` from `@ncom/all`。
- 属性：`value:string=#409eff`；`disabled`；`show-presets:boolean=true`；`presets:string[]=内置色板`。
- 方法：类型公开 `setPresets(presets:string[])`；另有 value/disabled/showPresets property。
- 事件：`nc-change`，detail 为 `{ oldValue:string, value:string }`，value 为 hex。
- 插槽：无。
- 官网示例：初始颜色、预设色、变更事件。
- 官网未列出：透明度、颜色格式切换。
- 源码位置：`packages/components/src/colorpicker/index.ts`、`types.ts`。
- 类型位置：`node_modules/@ncom/all/dist/types/components/src/colorpicker/`。
- 当前状态：Awaiting Manual Verification。

## Popconfirm

- 官网分类：反馈。
- 官网名称：气泡确认框-Popconfirm。
- 官网路由：`/doc/component/popconfirm`。
- 标签：`nc-popconfirm`。
- 导入方式：`NCPopconfirm` from `@ncom/all`。
- 属性：`title:string=确定进行此操作吗？`；`placement=top|right|bottom|left`，默认 bottom；`width=auto`；`cancel-text=取消`；`ok-text=确定`；`cancel-type=danger`；`confirm-type=primary`。
- 方法：官网与类型均未公开 open/close。
- 事件：`ok`、`cancel`，未声明 detail。触发元素需能派发 NCom 的 `nc-click`；官网示例使用 `nc-button`。
- 插槽：默认插槽为触发元素。
- 官网示例：基础绑定、标题、按钮文字、按钮类型、宽度、四方向和事件处理。
- 官网未列出：disabled。
- 源码位置：`packages/components/src/popconfirm/index.ts`、`types.ts`。
- 类型位置：`node_modules/@ncom/all/dist/types/components/src/popconfirm/`。
- 当前状态：Awaiting Manual Verification。

## Checkbox

- 官网分类：数据录入。
- 官网名称：复选框-Checkbox。
- 官网路由：`/doc/component/checkbox`。
- 标签：`nc-checkbox`。
- 导入方式：`NCCheckbox` from `@ncom/all`。
- 属性表：`value:boolean=false`、`disabled`。
- 示例和类型实际约定：`value=0` 未选、`1` 选中、`2` 半选；类型为 number。
- 方法：无具名方法；公开 property 为 value、disabled。
- 事件：`nc-change`，运行实现填充 `oldValue`、`value`。
- 插槽：默认插槽为标签内容。
- 官网示例：未选、选中、半选、禁用、动态设置和取值。
- 官网未列出：CheckboxGroup。
- 源码位置：`packages/components/src/checkbox/index.ts`。
- 类型位置：`node_modules/@ncom/all/dist/types/components/src/checkbox/index.d.ts`。
- 当前状态：文档/类型差异已记录；行为 Awaiting Manual Verification。

## Message

- 官网分类：反馈。
- 官网名称：消息-Message。
- 官网路由：`/doc/component/message`。
- 标签：运行实例为 `nc-message`，推荐通过 `Message` 静态方法创建。
- 导入方式：`Message`、`NCMessage` from `@ncom/all`。
- 属性/选项：`type=success|warning|info|danger`；`closable=false`；`duration=3000`，0 表示不自动关闭；`hide-icon=false`；`content`。
- 方法：`Message.info/success/warning/danger`；返回 `NCMessage`；实例 `close()`。
- 事件：官网没有公开事件。
- 插槽：无公开插槽。
- 官网示例：四类型、closable、自定义 duration、自定义图标/loading HTML、持久消息和手动 close。
- 官网未声明 loading 为 MessageType；示例通过 HTML 内容模拟。
- 源码位置：`packages/components/src/message/index.ts`、`message.ts`、`types.ts`。
- 类型位置：`node_modules/@ncom/all/dist/types/components/src/message/`。
- 当前状态：Awaiting Manual Verification。

## Card

- 官网分类：数据展示。
- 官网名称：卡片-Card。
- 官网路由：`/doc/component/card`。
- 标签：`nc-card`。
- 导入方式：`NCCard` from `@ncom/all`。
- 官网属性：`header:string`；`footer:string`；`body-style:string`；`shadow=always|hover|never`，默认 always。
- 类型额外声明：`width`、`height`，官网属性表未列出。
- 方法：无公开方法。
- 事件：无公开事件。
- 插槽：默认内容、`header`、`footer`。
- 官网示例：带头尾卡片、纯内容、图片和 body-style、三种 shadow。
- 源码位置：`packages/components/src/card/index.ts`、`types.ts`。
- 类型位置：`node_modules/@ncom/all/dist/types/components/src/card/`。
- 当前状态：文档/类型差异已记录；行为 Awaiting Manual Verification。

## Watermark

- 官网分类：数据展示。
- 官网名称：水印-Watermark。
- 官网路由：`/doc/component/watermark`。
- 标签：`nc-watermark`。
- 导入方式：`NCWatermark` from `@ncom/all`。
- 属性：`content=NCOM`；`rotate=-22`；`font-size=14`；`color=rgba(0,0,0,0.12)`；`gap-x=160`；`gap-y=120`；`z-index=10`。
- 方法：无具名方法；公开 property 可动态修改上述值。
- 事件：无公开事件。
- 插槽：默认插槽为被覆盖内容。
- 官网示例：基本文字水印、旋转/颜色/字号、密集间距。
- 官网未列出：多行或多文本数组。
- 源码位置：`packages/components/src/watermark/index.ts`、`types.ts`。
- 类型位置：`node_modules/@ncom/all/dist/types/components/src/watermark/`。
- 当前状态：Awaiting Manual Verification。
