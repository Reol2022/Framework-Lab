# NCom 八组件测试 Demo 人工验收清单

启动项目后打开 `http://127.0.0.1:4178/`。每完成一步再勾选；发现异常时记录页面、操作、预期、实际结果和控制台错误，并在 `issues/` 新建 Issue。

## 首页

- [ ] 首页显示 8 个组件入口和综合 Demo 入口。
- [ ] 每个入口均标记“等待人工验收”。
- [ ] 依次打开全部导航，无空白页。
- [ ] 每条路由显示其独立自定义元素，而不是重复的同一页面内容。
- [ ] 浏览器控制台没有阻塞页面的红色错误。

## complexttable

- [ ] 官网基础表格显示表头和 3 行数据。
- [ ] 网格线、交替行和复选框列可见。
- [ ] 点击排序按钮后数据顺序变化。
- [ ] 点击行后页面事件区显示 `nc-rowclick` 及 detail。
- [ ] 双击 editable 表格行后进入编辑。
- [ ] 保存编辑后显示 `nc-change`。
- [ ] 取消编辑后显示 `nc-cancel`。
- [ ] 点击展开图标或“expandRow”后子表显示。
- [ ] 点击“collapseRow”后子表关闭。
- [ ] 点击“insertRow”后出现新行。
- [ ] 点击“updateCell”后第一行名称变为“单元格更新”。
- [ ] 点击“selectRow”后第一行选中。
- [ ] 点击“getSelectedRows”后页面显示选中数据。
- [ ] 点击“removeRow”后 id=2 行删除。
- [ ] 点击“setRecords”后基础数据恢复。
- [ ] 20 个公开方法按钮均可调用，返回值在事件区可见。
- [ ] 空数据示例不报错。
- [ ] 控制台无阻塞错误。

## Layout

- [ ] 五插槽示例显示 north、south、west、east、center。
- [ ] 嵌套 Layout 正常显示。
- [ ] 拖拽 west/east 分隔条可改变宽度。
- [ ] 拖拽结束后事件区显示 `nc-change`。
- [ ] detail 中包含区域名和新尺寸。
- [ ] 小窗口下内容仍可操作。
- [ ] 控制台无错误。

## ColorPicker

- [ ] 默认颜色显示为 `#409eff`。
- [ ] disabled 示例不能选择颜色。
- [ ] `show-presets=false` 示例不显示色板。
- [ ] 主选择器选择颜色后预览背景与文本同步。
- [ ] 事件区显示 `nc-change`。
- [ ] detail 包含 oldValue 和 value。
- [ ] 点击动态 value 按钮后颜色更新为 `#dc2626`。
- [ ] 切换 disabled 后交互状态变化。
- [ ] 设置 presets 后出现指定四种预设色。
- [ ] 控制台无错误。

## Popconfirm

- [ ] top 触发按钮能打开确认框。
- [ ] right、bottom、left 位置分别正确。
- [ ] 点击确认后正常关闭。
- [ ] 点击取消后正常关闭。
- [ ] 确认事件区显示 `ok`。
- [ ] 取消事件区显示 `cancel`。
- [ ] 点击外部后确认框能关闭。
- [ ] 同一触发按钮连续打开至少 3 次均正常。
- [ ] 自定义标题和按钮文字正确。
- [ ] top、right、bottom、left 四个 placement 均已检查。
- [ ] 控制台无错误。

## Checkbox

- [ ] value=0 显示未选。
- [ ] value=1 显示选中。
- [ ] value=2 显示半选。
- [ ] disabled 且选中的示例不可操作。
- [ ] 点击主 Checkbox 在状态间切换。
- [ ] 页面当前值与视觉状态一致。
- [ ] `nc-change` detail 包含 oldValue 和 value。
- [ ] value=0/1/2 三个按钮均能动态修改。
- [ ] 切换 disabled 后交互状态正确。
- [ ] 控制台无错误。

## Message

- [ ] info 消息显示并自动关闭。
- [ ] success 消息样式正确。
- [ ] warning 消息样式正确。
- [ ] danger 消息样式正确。
- [ ] closable 消息有关闭按钮。
- [ ] duration=0 消息不会自动关闭。
- [ ] 点击“调用 close”后持久消息关闭。
- [ ] `hideIcon` 的 user 图标消息显示 `nc-icon-user`，且没有默认类型图标。
- [ ] loading 消息显示 `nc-loading` 与文字，并保持到手动关闭。
- [ ] 连续显示 3 条消息时布局正常。
- [ ] 页面显示最后调用的方法和参数。
- [ ] 控制台无错误。

## Card

- [ ] header 具名插槽显示。
- [ ] footer 具名插槽显示。
- [ ] 默认内容正常。
- [ ] `body-style` 背景和 padding 生效。
- [ ] `shadow=always` 始终有阴影。
- [ ] `shadow=hover` 仅 hover 时出现阴影。
- [ ] `shadow=never` 无阴影。
- [ ] 动态卡片可在 always、hover、never 三种 shadow 间切换。
- [ ] 控制台无错误。

## Watermark

- [ ] 默认水印文字显示并重复平铺。
- [ ] 颜色、字号和旋转角度符合标注。
- [ ] 水印下方 6 个属性按钮均可点击，水印不遮挡交互。
- [ ] 修改文字后水印刷新。
- [ ] 修改 rotate 后角度刷新。
- [ ] gap-x/gap-y=40 后水印明显更密集。
- [ ] 修改颜色后水印刷新。
- [ ] 水印只覆盖组件内容范围。
- [ ] 控制台无错误。

## 综合 Demo

- [ ] Layout Header、Sider、Content、Footer 均正常。
- [ ] Watermark 覆盖主内容但不阻止点击。
- [ ] 两个 Card 区域显示正常。
- [ ] ColorPicker 修改后综合页水印颜色变化。
- [ ] Checkbox 开启后只显示 status=待处理的数据。
- [ ] Checkbox 关闭后恢复全部数据。
- [ ] ComplexTable 能选择一行。
- [ ] 未选择行时确认删除会显示 warning Message。
- [ ] 选择行后打开 Popconfirm。
- [ ] 点击取消后数据不变并正常关闭。
- [ ] 点击确认后选中行删除。
- [ ] 删除成功后 Message 显示。
- [ ] 点击新增任务后表格出现新行。
- [ ] 事件结果区记录最近操作。
- [ ] 控制台无阻塞错误。

## 总体结论

- [ ] 8 个单组件页面均已完成。
- [ ] 综合 Demo 已完成。
- [ ] Network 中首页和主要静态资源没有 404。
- [ ] 刷新任一路由后页面仍正常显示。
- [ ] 所有异常已记录到 issues 目录。
