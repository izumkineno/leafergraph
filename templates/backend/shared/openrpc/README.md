# Authority OpenRPC 协议说明

这份目录保存 LeaferGraph authority 通信的唯一协议真源。

## 深入文档

- [`CROSS_LANGUAGE_CONFORMANCE.md`](./CROSS_LANGUAGE_CONFORMANCE.md)
  解释 authority 协议怎样被任意语言后端实现，以及 Core / Advanced 分层验收边界。
- [`OPENRPC_JSON_REFERENCE.md`](./OPENRPC_JSON_REFERENCE.md)
  逐个解释 `shared/openrpc` 下全部 31 个 JSON 真源与 schema 文件，适合查目录、查引用和查边界。
- [`APIFOX_TEST_PLAYBOOK.md`](./APIFOX_TEST_PLAYBOOK.md)
  面向测试和联调的 Apifox 操作手册，说明怎样在 Apifox 中调试 `GET /health` 与 `WS /authority`。
- [`PYTHON_BACKEND_INTEGRATION.md`](./PYTHON_BACKEND_INTEGRATION.md)
  结合 Python OpenRPC backend 的生成链、service 编排、transport 发包、document diff 与测试证据的完整说明。
- [`openrpc-adaptation-pitfalls.md`](./openrpc-adaptation-pitfalls.md)
  适配这套 authority 协议时最容易踩雷的边界与建议做法。

## 文档入口

- [`authority.openrpc.json`](./authority.openrpc.json)
  正式 OpenRPC 文档本体。
- [`schemas/`](./schemas/)
  共享 JSON Schema 拆分目录。
- [`conformance/`](./conformance/)
  跨语言接入的共享一致性场景、fixtures 和 runner 入口说明。
- [`openrpc-adaptation-pitfalls.md`](./openrpc-adaptation-pitfalls.md)
  适配这套 authority 协议时最容易踩雷的边界与建议做法。

## 它描述什么

- `GET /health` 之外的 authority 正式 RPC 能力
- `WS /authority` 上的 JSON-RPC 2.0 method / result / notification 名称
- Node、Python、editor 三端共享的最小传输结构
- `rpc.discover` 返回给外部宿主和测试的正式协议文档

## 它不描述什么

- authority 运行时内部如何执行节点
- editor 如何把协议结果投影到 UI
- Python / Node 的具体 HTTP 框架细节
- `meta`、节点 `data`、运行时 `payload` 这类刻意保留扩展性的业务负载内部结构

## 通道模型

- `GET /health`
  用于健康检查，不并入 OpenRPC。
- `WS /authority`
  用于正式 authority 通道，固定走 JSON-RPC 2.0。
- `rpc.discover`
  返回完整 `authority.openrpc.json` 文档本体，供测试、宿主和桥接方发现能力。

## 正式 methods

- `rpc.discover`
  返回当前 authority 的完整 OpenRPC 文档。
- `authority.getDocument`
  返回当前 authoritative `GraphDocument`。
- `authority.submitOperation`
  提交一条正式 `GraphOperation`，返回 authority 确认结果。
- `authority.replaceDocument`
  以整图方式替换 authority 当前文档。
- `authority.controlRuntime`
  驱动 `node.play / graph.play / graph.step / graph.stop`。

## 正式 notifications

- `authority.document`
  authority 主动推送最新权威图文档。
- `authority.documentDiff`
  authority 在已知连接 baseline 时优先推送增量 diff。
- `authority.runtimeFeedback`
  authority 主动推送统一运行反馈事件。
- `authority.frontendBundlesSync`
  authority 主动推送前端 bundle 目录变更。

## 共享 schema 说明

- `graph_document.schema.json`
  正式图文档和最小节点/连线传输形状。
- `graph_operation.schema.json`
  当前 authority 支持的正式图操作联合。
- `runtime_control_request.schema.json`
  当前 authority 支持的运行控制请求联合。
- `runtime_control_result.schema.json`
  运行控制结果与图级执行状态快照。
- `runtime_feedback_event.schema.json`
  统一运行反馈事件联合。
- `frontend_bundles_sync_event.schema.json`
  远端前端 bundle 目录同步事件。
- 其余子 schema
  只负责给以上正式 schema 拆分复用字段，避免单文件持续膨胀。

## 当前代码入口的对应关系

- Python OpenRPC 模板协议常量：
  `templates/backend/python-openrpc-authority-template/src/leafergraph_python_openrpc_authority_template/core/protocol.py`
- Python OpenRPC 模板 generated 常量：
  `templates/backend/python-openrpc-authority-template/src/leafergraph_python_openrpc_authority_template/_generated/`
- editor 协议常量：
  `packages/editor/src/session/authority_openrpc/`
  正式生成入口是 `authority_openrpc/_generated/` 与 `authority_openrpc/runtime.ts`

当前仓库里所有 authority 入口都必须和这份 OpenRPC 文档保持同一组 method / notification 名称，不能再定义平行真源。

`APIFOX_TEST_PLAYBOOK.md` 只是测试消费文档，不是新的协议真源；正式真源仍然只有 `authority.openrpc.json + schemas/*.json`。

`CROSS_LANGUAGE_CONFORMANCE.md` 与 `conformance/` 只定义跨语言接入规范与验收资产，不是新的协议真源，也不替代现有 OpenRPC / JSON Schema 文档。

当前第一位共享 conformance 参考消费者是 Python OpenRPC 模板，对应测试入口为：

- `templates/backend/python-openrpc-authority-template/tests/test_conformance_assets.py`
- `templates/backend/python-openrpc-authority-template/tests/test_conformance_runner.py`

从仓库根目录的可见 PowerShell 中可直接执行：

```powershell
uv run --project templates/backend/python-openrpc-authority-template pytest templates/backend/python-openrpc-authority-template/tests/test_conformance_assets.py
uv run --project templates/backend/python-openrpc-authority-template pytest templates/backend/python-openrpc-authority-template/tests/test_conformance_runner.py
```

## Editor 生成链维护

- editor 侧 authority OpenRPC 生成器：
  `packages/editor/tools/generate_from_openrpc.ts`
- editor 手动生成命令：
  `bun run --filter leafergraph-editor generate:authority-openrpc`
- editor stale 校验命令：
  `bun run --filter leafergraph-editor check:authority-openrpc`

若共享 `authority.openrpc.json` 或 `schemas/*.schema.json` 改动后 `check:authority-openrpc` 失败，默认修复方式就是重新执行一次生成命令，再回跑 editor build / authority 相关测试。

## 稳定字段与保留扩展字段

- 已作为稳定契约建模的字段：
  method 名、notification 名、`GraphDocument` 顶层结构、`GraphOperation` 判别字段、图级执行状态、frontend bundle 同步事件基础结构。
- 仍刻意保留宽松表达的字段：
  `meta`
  节点 `properties`
  节点 `data`
  property/widget `options`
  runtime `payload`

这些字段当前保留宽松 schema 是有意设计，表示它们是跨语言扩展口，不代表协议漏建模。

## 修改协议时必须同步更新

- `templates/backend/shared/openrpc/authority.openrpc.json`
- `templates/backend/shared/openrpc/schemas/*.schema.json`
- Node 协议常量与 discover 读取逻辑
- Python 协议常量与 discover 读取逻辑
- editor 协议常量、MessagePort host、transport 解析
  当前 editor 侧的正式协议生成入口已经收口到 `packages/editor/src/session/authority_openrpc/`
- 远端 demo fixture 与相关测试

如果协议已改而上述任一侧没同步，当前仓库里的 discover / 常量一致性测试应直接失败。
