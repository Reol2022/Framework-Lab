# 官方文档采集

## 配置

配置既可放在 `framework.yaml` 的可选 `docs.sources`，也可放在不会改变既有框架配置证据哈希的 `frameworks/<id>/docs.yaml`：

```yaml
schema_version: 1.0.0
sources:
    - id: official-site
      mode: auto
      baseUrl: https://example.test/doc
      entryPages:
        - /component/overview
      sourceType: official-doc
    - id: repository-docs
      mode: file
      basePath: .framework-sources/example/doc/api/components
      entryPages:
        - card.md
      sourceType: official-doc
```

所有相对路径从 Framework Lab 仓库根目录解析。file provider 会拒绝越过 `basePath` 的路径。

## Provider

- `http` 使用 Fetch，15 秒超时，保存状态码、Content-Type、正文和警告。
- `browser` 接受显式 `BrowserRenderer` 适配器；CLI 默认使用 `FRAMEWORK_LAB_BROWSER` 或探测本机 Edge/Chrome，以独立临时 profile、`shell=false` 和 20 秒上限执行 headless 渲染。
- `file` 读取本地 HTML，并兼容固定源码内的 Markdown 官方文档。
- `auto` 对 HTTP 结果先做结构化质量判断，仅在 `empty` 或 `failed` 时回退 browser。

## 质量

每页记录 attributes、events、methods、slots、examples、codeBlocks 数量、缺失章节和解析警告。状态为：

- `complete`：五类章节均存在且提取到有效组件数据。
- `partial`：存在有效组件数据，但章节不完整。
- `empty`：只有导航、应用壳或没有任何组件数据。
- `failed`：请求、文件读取或浏览器渲染失败。

## 快照与开源边界

原始正文位于 `frameworks/<id>/docs/snapshots/`，默认被 Git 忽略。快照使用新 collection id 和排他写入，不覆盖旧数据。可提交内容只包括相对路径、哈希、状态、结构化解析结果与脱敏报告；不得提交 Cookie、Token、浏览器会话、机器绝对路径或未授权网站全文。
