# Templates 总览

`templates/` 只放可复制出去的模板工程与分类入口，不承载 workspace 核心源码。

## 目录结构

```text
templates/
  backend/
    shared/
      openrpc/
        authority.openrpc.json
        schemas/
    python-openrpc-authority-template/
  node/
    README.md
  widget/
    README.md
  misc/
    browser-node-widget-plugin-template/
    backend-node-package-template/
```

## 模板矩阵

| 路径 | 主要用途 | 默认端口 | 启动/构建命令 | 核心契约 |
| --- | --- | --- | --- | --- |
| `templates/backend/python-openrpc-authority-template` | 精简 OpenRPC-first Python authority 模板，默认只含 document authority 与最小可执行运行时 | `5503` | `uv run --project templates/backend/python-openrpc-authority-template python -m leafergraph_python_openrpc_authority_template.entry` | `GET /health` + `WS /authority` + JSON-RPC 2.0 + 按需生成的 `_generated/` models/client |
| `templates/misc/browser-node-widget-plugin-template` | 浏览器侧 node/widget/demo 插件模板 | 无固定端口 | `bun run --cwd templates/misc/browser-node-widget-plugin-template build` | bundle manifest + `registerBundle(...)` |
| `templates/misc/backend-node-package-template` | 后端驱动节点包模板 | 无固定端口 | 作为目录模板被 authority runtime 热加载 | package manifest + `authority.frontendBundlesSync` |

## 固定决策

- authority 协议真源固定为 `templates/backend/shared/openrpc/authority.openrpc.json`。
- 协议说明入口固定为 `templates/backend/shared/openrpc/README.md`。
- OpenRPC 接入踩雷说明固定见 `templates/backend/shared/openrpc/openrpc-adaptation-pitfalls.md`。
- `WS /authority` 固定走 JSON-RPC 2.0。
- `rpc.discover` 固定返回完整 OpenRPC 文档本体。
- `GET /health` 保持独立 HTTP 健康检查入口，不并入 JSON-RPC。
- notification 固定使用 `authority.document`、`authority.runtimeFeedback`、`authority.frontendBundlesSync`。

## 分类边界

### `backend/`

- 放 authority 后端模板和共享协议文档。
- 当前仓库内默认的 authority 后端模板是 `python-openrpc-authority-template`。
- 若需要 schema 驱动的 Python 入站校验与 generated client，优先使用 `python-openrpc-authority-template`。
- 这份 OpenRPC 模板是精简版，重点是协议真源、类型生成和最小运行闭环。
- 这里是“后端协议与运行时模板”，不是节点/Widget 作者目录。

### `node/`

- 放纯节点模板分类说明与未来节点作者入口。
- 本轮先保留 README 作为正式分类占位，不强塞旧模板。

### `widget/`

- 放纯 Widget 模板分类说明与未来 Widget 作者入口。
- 本轮先保留 README 作为正式分类占位，不强塞旧模板。

### `misc/`

- 放不属于“纯后端模板 / 纯节点模板 / 纯 Widget 模板”的混合型模板。
- 当前包括：
  - 浏览器插件模板
  - 后端驱动节点包模板

## 需要改

- 业务节点、业务 widget、业务 demo、业务执行器。
- 默认 authority 名称、日志前缀、示例文档内容。
- 模板 README 里的业务接入说明。

## 不要改

- `GET /health` 与 `WS /authority` 的稳定路径语义。
- OpenRPC 真源路径与 JSON-RPC 2.0 基本约束。
- `authority.document / authority.runtimeFeedback / authority.frontendBundlesSync` 这些正式 method 名。
