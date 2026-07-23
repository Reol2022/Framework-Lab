# NCom 问题记录

此目录保存有最小复现和证据的问题报告。问题必须区分框架、文档、知识、提示、测试、示例和实现责任。

当前问题记录：

- `ISSUE-NCOM-001-frozen-lockfile-mismatch.yaml`：固定 pnpm 10.26.1 的 frozen install 在旧 commit 因 `packages/all` 清单与锁文件不一致而失败；后续 commit 已验证解决。
- `ISSUE-NCOM-002-theme-build-entry-missing.yaml`：`faf42ba` 的 theme build script 指向不存在的 `packages/theme/scripts/build.mjs`，构建以 `MODULE_NOT_FOUND` 失败。

ISSUE-NCOM-001 仍保留旧 commit 的真实问题记录；其状态已根据 `faf42ba` 的 frozen install 成功更新为后续提交已解决。
