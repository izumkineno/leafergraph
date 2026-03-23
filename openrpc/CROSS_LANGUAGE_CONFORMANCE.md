# Authority 跨语言规范与分层一致性

这份文档面向要用 **任意语言** 实现 LeaferGraph authority 后端的人。

它不修改现有 `authority.openrpc.json` 和 `schemas/*.json`，而是补两类信息：

1. 当前 wire 协议里哪些行为是跨语言接入时必须成立的硬要求。
2. 怎样用 `openrpc/conformance/` 里的场景资产，把一个后端验收到 `Core` 或 `Advanced` 兼容层级。

---

## 1. 协议定位

当前 authority 协议的真源仍然只有：

- `authority.openrpc.json`
- `schemas/*.schema.json`

当前目录位置与路径契约固定为：

- 正式真源目录：`openrpc/`
- 环境变量覆盖：`LEAFERGRAPH_OPENRPC_ROOT`
- 未设置环境变量时，消费者默认回退到仓库根 `openrpc/`
- 不再支持旧 `templates/backend/shared/openrpc` 路径

这套协议的组成是：

- `GET /health`
- `WS /authority`
- `JSON-RPC 2.0` request / response / notification
- `OpenRPC` 方法与通知文档
- `JSON Schema` 约束的 params / result / payload

它本质上是语言无关的，后端可以用 Python、Node.js、Go、Rust、Java、C# 或其他语言实现。

但“语言无关”不等于“自动代码生成就能完整接入”。跨语言实现时真正需要对齐的是：

- wire 上的 envelope 语义
- discover 返回规则
- 标准错误码边界
- 文档同步与 notification 行为
- 多连接下的 baseline / diff 语义

---

## 2. 固定通道模型

### `GET /health`

- 只用于健康检查。
- 不属于 OpenRPC methods。
- 允许返回部署态、authority 名称、当前文档身份、连接数等辅助信息。

### `WS /authority`

- 是正式 authority 协议通道。
- 只承载 JSON-RPC 2.0 request / response / notification。
- 所有正式 method 名和 notification 名都必须来自 `authority.openrpc.json`。

---

## 3. 跨语言硬约束

### Discover 规则

- `rpc.discover` 必须直接返回共享 OpenRPC 文档本体。
- 不允许自定义 wrapper，例如：
  - `{ "document": ... }`
  - `{ "openrpcDocument": ... }`
  - `{ "methods": ..., "notifications": ... }`

### Wire 规则

- request 的动作名由 JSON-RPC `method` 直接表达。
- notification 的事件名也由 JSON-RPC `method` 直接表达。
- `params` 只放当前动作自己的业务参数，不再包旧式 `type/payload` 外壳。

### 错误码规则

协议层错误必须走 JSON-RPC `error`：

- `-32700` parse error
- `-32600` invalid request
- `-32601` method not found
- `-32602` invalid params
- `-32603` internal error

业务拒绝必须走合法 `result`，例如：

- `accepted=false`
- `changed=false`
- `reason="..."`

### 真源规则

- `authority.openrpc.json + schemas/*.json` 是唯一协议真源。
- `_generated/`、typed client、transport 常量、editor runtime 常量都只能是消费者。
- conformance 文档和 fixture 只是验收资产，不是新的协议真源。

---

## 4. Core / Advanced 分层

`Core` 和 `Advanced` 是 **验收分层**，不是新的 wire capability negotiation。

本轮不新增 `capabilityProfile` 字段扩展，也不在 OpenRPC schema 里声明等级。

### Core

`Core` 表示“最小互通可用”，至少应满足：

- `GET /health` 可用
- `rpc.discover` 返回共享 OpenRPC 文档本体
- 5 个正式 methods 可用
- 4 个客户端侧标准错误码场景成立
- `authority.document` 全量文档通知可用
- `authority.controlRuntime` 可对参考 runtime fixture 成功执行 `graph.step`

### Advanced

`Advanced` 表示“追齐当前参考模板的高级体验”，至少应满足：

- `authority.documentDiff` 的 per-connection baseline 语义
- 无 baseline 时从 diff 回退到 full document
- `authority.runtimeFeedback` 的 4 类事件可观察
- `authority.frontendBundlesSync` 初始 full snapshot
- 同连接 response 已带 document 时的回声抑制
- observer 连接能稳定观测到 diff 场景

---

## 5. 哪些是协议硬要求，哪些是模板策略

### 协议硬要求

- method / notification 名称
- `rpc.discover` 返回共享文档本体
- request / response / notification envelope 形状
- 标准错误码边界
- schema 判别字段，如 `type`、`mode`、`format`

### 参考模板策略

下面这些行为当前由 Python 参考模板实现，但不代表所有语言都必须逐字照抄内部做法：

- 何时把运行中文档先缓存到 `_pending_runtime_document`
- 何时 flush 到 `DocumentStore`
- 怎样在 service 内部划分 `structural` / `live-safe`
- typed model 的具体生成方式
- 具体 runtime controller 的内部调度实现

真正要对齐的是 **可观察结果**，不是内部类图。

---

## 6. Conformance 资产怎么用

`openrpc/conformance/` 目录提供三类资产：

- `README.md`
  说明目录目的、分层和执行方式。
- `manifest.json`
  机器可读的场景清单。
- `fixtures/`
  请求、预置文档、预期 response / notification 断言。

推荐接入顺序：

1. 先把后端做到能通过 `Core`。
2. 再补 `Advanced`。
3. 新语言后端复用同一套 manifest / fixtures，不要再复制一份平行场景说明。

---

## 7. 参考 runtime fixture 的边界

`control_runtime.graph_step` 和 `runtime_feedback.step_chain` 这类场景，不只是“协议通了”，还隐含要求：

- 后端支持参考 conformance fixture 中的可执行图文档
- 后端能理解该 fixture 里的节点类型和运行时语义

这意味着：

- `Core` 里的 runtime 场景已经带有“参考 authority 模板能力”的假设
- `Advanced` 里的 runtime feedback 场景更偏“参考模板兼容”

如果某门语言的后端只想先实现文档 authority，不想先实现参考 runtime，可以先对 `Core` 中非 runtime 项目做自检，但它不能宣称自己已经通过完整 `Core`。

---

## 8. 对新语言实现者的最低建议

如果你要做第二门语言模板，建议按这个顺序推进：

1. 先对齐 `rpc.discover`
2. 再对齐 `getDocument / replaceDocument / submitOperation`
3. 再补 `authority.document`
4. 再补错误码边界
5. 最后再做 diff、runtime feedback、bundle sync

这样最容易先拿到一个可联调、可被 editor 吃进去的 authority。

---

## 9. 验收结论怎么理解

### 通过 `Core`

表示这个后端已经是“可被 editor / 测试 /宿主以最小方式消费的 authority”。

### 通过 `Advanced`

表示这个后端已经追齐当前参考模板的大部分高级交互体验，包括：

- diff
- runtime feedback
- 初始 bundle snapshot
- 多连接观察语义

---

## 10. 和其他文档的关系

- `README.md`
  说明 `openrpc/` 是真源。
- `OPENRPC_JSON_REFERENCE.md`
  解释全部 JSON 文件。
- `PYTHON_BACKEND_INTEGRATION.md`
  解释 Python 模板怎样消费这些真源。
- `openrpc-adaptation-pitfalls.md`
  记录最容易踩雷的接入误区。
- `conformance/README.md`
  解释具体 conformance 资产和 runner 使用方式。
