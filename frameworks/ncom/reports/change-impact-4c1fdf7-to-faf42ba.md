# NCom 版本影响：4c1fdf7 到 faf42ba

## Commit 范围与规模

- 范围：`4c1fdf745afe1d08c1c00c3de3b11feb9d5b71ac..faf42ba101975befb79629c63d92e962194e4abe`
- Git diff：222 files changed，10631 insertions，1660 deletions。
- 顶层分布：`.changeset/` 3、`doc/` 4、`example/` 93、`packages/` 119，另有根 `README.md`、`package.json`、`pnpm-lock.yaml` 各 1。

## Package 与发布结构

该范围新增 Changesets 配置，重设 package 版本/发布元数据，并调整根与各 workspace package manifests。`packages/all/package.json` 从没有 scripts 变为提供聚合构建、主题复制、workspace、ES 和 UMD 构建入口；因此旧 commit 上“`@ncom/all` 缺少 build script”的疑点不适用于 `faf42ba`。

`packages/theme/package.json` 在新 commit 中声明 `build: node scripts/build.mjs`，但同一 Git tree 没有该文件。这一变化使 build 可以进入 theme workspace，却以已确认的 `MODULE_NOT_FOUND` 失败。

## 组件、示例与文档

组件源码和样式发生大范围变化，并新增 breadcrumb、calendar、collapse、colorpicker、complexttable、divider、skeleton、splitpanel、statistic、tooltip、tour、treeselect、waterfall、watermark 等路径。示例目录同步增加相应页面和组件，并修改导航、路由、Vite 配置与若干既有示例。文档变化集中于组件 API 索引及 complexttable、table、tree 文档。

这些是路径级 Git diff 事实，不代表上述组件行为已经验证。

## Lockfile

`pnpm-lock.yaml` 被修改，范围统计为 520 行变化。`faf42ba` 在 Node v24.18.0 与固定 pnpm 10.26.1 下的 frozen install 已成功，因此 ISSUE-NCOM-001 的旧 commit 阻塞在后续 commit 不再复现。不能由此推断所有依赖行为或兼容性均已验证。

## 对任务、示例与未来知识卡的影响

- L0 基线必须切换到 `faf42ba` 并重新记录 install、lint、build；旧日志仍保留为历史证据。
- 示例路径和 Vite 配置变化较大，下一轮 example/浏览器冒烟必须绑定 `faf42ba`，不能复用旧 commit 的未执行结论。
- 未来知识卡若涉及新增组件、路由、主题、package 入口或发布结构，必须从新 commit 重新取证。
- 当前没有 verified NCom 知识卡，因此暂无知识迁移成本；本报告也不创建知识卡。

## faf42ba 到 0eddf72

范围 `faf42ba101975befb79629c63d92e962194e4abe..0eddf72d37579c3670770c0f73d22ffc769d3a12` 包含 1 个 commit、15 个文件、286 insertions、23 deletions。尽管提交标题为“修改readme”，实际 diff 还包括 `.changeset/`、六个 package CHANGELOG、六个 package.json 和 `packages/all/README.md`，所以明确判定为 **not README-only**。该 commit 仍未增加 `packages/theme/scripts/build.mjs`。
