# Authority 协议 Apifox 测试手册

这份手册面向需要在 Apifox 中手工联调 `openrpc/` 协议的工程师。

它的目标不是替代 `authority.openrpc.json`，而是把当前 authority 协议翻译成“在 Apifox 中怎么建接口、怎么连 WebSocket、怎么发消息、怎么判断结果”的操作说明。

---

## 为什么这轮不是“OpenRPC 一键导入 Apifox”

当前 `openrpc/` 的正式真源是：

- `authority.openrpc.json`
- `schemas/*.schema.json`

当前目录位置与路径契约固定为：

- 正式真源目录：`openrpc/`
- 环境变量覆盖：`LEAFERGRAPH_OPENRPC_ROOT`
- 未设置环境变量时，消费者默认回退到仓库根 `openrpc/`
- 不再支持旧 `templates/backend/shared/openrpc` 路径

但当前协议形态是 **`OpenRPC + JSON Schema + WebSocket JSON-RPC 2.0 + notifications`**，而不是传统 `OpenAPI HTTP REST`。

因此这轮选择“Apifox 测试手册”而不是“伪造一份 OpenAPI 导入稿”，原因有 3 个：

1. 这样不会引入第二份平行真源。
2. 可以忠实保留 `WS /authority`、JSON-RPC `id`、request / response / notification 的真实交互模型。
3. 可以直接复用当前 Python authority 模板测试里已经验证过的消息形状。

Apifox 官方资料参考：

- [导入 OpenAPI/Swagger](https://docs.apifox.com/import-openapi-swagger)
- [导入导出数据](https://docs.apifox.com/import-and-export)
- [WebSocket 调试](https://docs.apifox.com/5220190m0)

### 真源与测试手册的边界

- `authority.openrpc.json + schemas/*.json`
  仍然是正式协议真源。
- 本文
  只是“怎样在 Apifox 里消费这套协议”的测试文档。

---

## Apifox 项目初始化

### 推荐环境变量

> 以下默认值以 **Python OpenRPC authority 模板** 为准。

| 变量 | 默认值 | 用途 |
| :--- | :--- | :--- |
| `authorityHttpBaseUrl` | `http://127.0.0.1:5503` | 调试 `GET /health` |
| `authorityWsUrl` | `ws://127.0.0.1:5503/authority` | 调试 `WS /authority` |
| `requestId` | `req-001` | JSON-RPC 请求 `id` |
| `nodeId` | `apifox-node-1` | `node.create` 示例节点 ID |
| `observerNodeId` | `apifox-node-2` | 第二次操作或 observer 场景可选节点 ID |

### 端口说明

- `authority.openrpc.json` 的 `servers[0].url` 当前写的是共享示例地址。
- Python 模板真实默认端口来自 `core/protocol.py`，默认是 **`5503`**。
- 所以在 Apifox 联调 Python 模板时，优先使用：
  - `GET {{authorityHttpBaseUrl}}/health`
  - `WS {{authorityWsUrl}}`

### 建议的 Apifox 项目结构

1. 新建一个 authority 联调项目。
2. 在环境变量中写入上表变量。
3. 创建一个 HTTP 接口：
   - 名称：`health`
   - 方法：`GET`
   - URL：`{{authorityHttpBaseUrl}}/health`
4. 创建一个 WebSocket 接口：
   - 名称：`authority`
   - URL：`{{authorityWsUrl}}`
5. 为了观察 `authority.documentDiff`，建议额外再开一个 WebSocket 会话页，命名为：
   - `authority-origin`
   - `authority-observer`

---

## `GET /health` 调试步骤

### 请求

- 方法：`GET`
- URL：`{{authorityHttpBaseUrl}}/health`

### 预期结果

成功时应返回一个普通 HTTP JSON 对象，至少包含：

```json
{
  "ok": true,
  "authorityName": "python-openrpc-authority-template",
  "documentId": "python-openrpc-document",
  "revision": 0,
  "connectionCount": 0
}
```

### 你应该检查什么

- `ok` 为 `true`
- `documentId` 与当前 authority 文档一致
- `revision` 能随着整图变化或操作变化递增
- `connectionCount` 会反映当前 WebSocket 连接数量

---

## `WS /authority` 建连与消息发送步骤

### 建连后第一件事

连接 `{{authorityWsUrl}}` 后，不用先发任何 request，默认应先收到一条 `authority.frontendBundlesSync` notification。

默认 Python 模板下，首包通常类似：

```json
{
  "jsonrpc": "2.0",
  "method": "authority.frontendBundlesSync",
  "params": {
    "type": "frontendBundles.sync",
    "mode": "full",
    "packages": [],
    "emittedAt": 1710000000000
  }
}
```

这条消息说明：

- WebSocket authority 通道已接通
- 这是 notification，不带 `id`
- 默认静态 bundle provider 会先发一份 full snapshot

### 消息发送规则

- 所有 method 调用都走 JSON-RPC 2.0 request envelope：

```json
{
  "jsonrpc": "2.0",
  "id": "{{requestId}}",
  "method": "authority.getDocument"
}
```

- 成功响应必须带同一个 `id` 和 `result`
- 失败响应必须带同一个 `id` 和 `error`
- notification 没有 `id`

---

## 成功场景

### 1. `rpc.discover`

#### 请求

```json
{
  "jsonrpc": "2.0",
  "id": "{{requestId}}",
  "method": "rpc.discover"
}
```

#### 预期

- 返回 `result`
- `result.openrpc` 等于 `1.3.2`
- `result.methods` 包含 5 个 methods
- `result.x-notifications` 包含 4 个 notifications

---

### 2. `authority.getDocument`

#### 请求

```json
{
  "jsonrpc": "2.0",
  "id": "{{requestId}}",
  "method": "authority.getDocument"
}
```

#### 预期

默认空文档下，返回值通常类似：

```json
{
  "jsonrpc": "2.0",
  "id": "{{requestId}}",
  "result": {
    "documentId": "python-openrpc-document",
    "revision": 0,
    "appKind": "leafergraph",
    "nodes": [],
    "links": []
  }
}
```

这个结果建议保存下来，后面的 `submitOperation` 和 `replaceDocument` 都会拿它当 `currentDocument` baseline。

---

### 3. `authority.submitOperation`

#### 适用目标

验证 `GraphOperation`、`operation_context`、`operation_result` 三件事同时成立。

#### 请求

下面的示例基于默认空文档，执行一次 `node.create`：

```json
{
  "jsonrpc": "2.0",
  "id": "{{requestId}}",
  "method": "authority.submitOperation",
  "params": {
    "operation": {
      "operationId": "submit-{{nodeId}}",
      "timestamp": 1,
      "source": "apifox",
      "type": "node.create",
      "input": {
        "id": "{{nodeId}}",
        "type": "demo/node",
        "title": "Apifox Node",
        "x": 120,
        "y": 80
      }
    },
    "context": {
      "currentDocument": {
        "documentId": "python-openrpc-document",
        "revision": 0,
        "appKind": "leafergraph",
        "nodes": [],
        "links": []
      },
      "pendingOperationIds": []
    }
  }
}
```

#### 预期

- `result.accepted` 为 `true`
- `result.changed` 为 `true`
- `result.revision` 变成 `1`
- `result.document.nodes[0].id` 为 `{{nodeId}}`

#### 额外观察

- 同一个连接上，这次 response 已经直接带回了新文档，所以通常不会再看到同连接的重复 `authority.document` 回声。

---

### 4. `authority.replaceDocument`

#### 适用目标

验证 authority 能整图替换文档，并返回新的 authoritative 文档。

#### 请求

下面的示例仍基于默认空文档，只把 `appKind` 从 `leafergraph` 改成 `remote-demo`：

```json
{
  "jsonrpc": "2.0",
  "id": "{{requestId}}",
  "method": "authority.replaceDocument",
  "params": {
    "document": {
      "documentId": "python-openrpc-document",
      "revision": 0,
      "appKind": "remote-demo",
      "nodes": [],
      "links": []
    },
    "context": {
      "currentDocument": {
        "documentId": "python-openrpc-document",
        "revision": 0,
        "appKind": "leafergraph",
        "nodes": [],
        "links": []
      }
    }
  }
}
```

#### 预期

- `result.appKind` 为 `remote-demo`
- `result.revision` 增加到 `1`
- 若之后再发一次 `authority.getDocument`，应读回同样的 `appKind`

---

### 5. `authority.controlRuntime`

#### 适用目标

验证 runtime request / result 和 runtime feedback 通道一起工作。

#### 前置

先用 `authority.replaceDocument` 把图替换成可执行 fixture。建议直接使用下面这份来自当前 Python runtime 测试的最小执行图。

#### 预置文档

```json
{
  "documentId": "openrpc-runtime-doc",
  "revision": 1,
  "appKind": "python-openrpc-demo",
  "nodes": [
    {
      "id": "on-play",
      "type": "system/on-play",
      "title": "On Play",
      "layout": {
        "x": 0,
        "y": 0,
        "width": 220,
        "height": 120
      },
      "outputs": [
        {
          "name": "Event",
          "type": "event"
        }
      ]
    },
    {
      "id": "counter",
      "type": "template/execute-counter",
      "title": "Counter Source",
      "layout": {
        "x": 280,
        "y": 0,
        "width": 288,
        "height": 184
      },
      "properties": {
        "subtitle": "等待起跑",
        "status": "READY",
        "count": 0
      },
      "inputs": [
        {
          "name": "Start",
          "type": "event"
        }
      ],
      "outputs": [
        {
          "name": "Count",
          "type": "number"
        }
      ]
    },
    {
      "id": "display",
      "type": "template/execute-display",
      "title": "Display",
      "layout": {
        "x": 620,
        "y": 0,
        "width": 288,
        "height": 184
      },
      "properties": {
        "subtitle": "等待上游执行传播",
        "status": "WAITING"
      },
      "inputs": [
        {
          "name": "Value",
          "type": "number"
        }
      ]
    }
  ],
  "links": [
    {
      "id": "link:on-play->counter",
      "source": {
        "nodeId": "on-play",
        "slot": 0
      },
      "target": {
        "nodeId": "counter",
        "slot": 0
      }
    },
    {
      "id": "link:counter->display",
      "source": {
        "nodeId": "counter",
        "slot": 0
      },
      "target": {
        "nodeId": "display",
        "slot": 0
      }
    }
  ],
  "meta": {
    "source": "apifox"
  }
}
```

#### Runtime 请求

把上面的预置文档通过 `authority.replaceDocument` 写进去后，再发送：

```json
{
  "jsonrpc": "2.0",
  "id": "{{requestId}}",
  "method": "authority.controlRuntime",
  "params": {
    "request": {
      "type": "graph.step"
    }
  }
}
```

#### 预期

- `result.accepted` 为 `true`
- `result.changed` 为 `true`
- `result.state.status` 最终回到 `idle`
- 连接上能陆续观察到：
  - `authority.runtimeFeedback`
  - `authority.documentDiff` 或 `authority.document`

---

## Notification 观察点

### `authority.frontendBundlesSync`

#### 出现时机

- WebSocket 建连后首包

#### 观察点

- `method` 为 `authority.frontendBundlesSync`
- `params.type` 为 `frontendBundles.sync`
- 默认 Python 模板里 `mode` 为 `full`
- 默认 Python 模板里 `packages` 为空数组

---

### `authority.document`

#### 出现时机

- 连接还没有 baseline 文档
- 或 diff 无法安全构造时回退为 full document

#### 观察点

- `method` 为 `authority.document`
- `params.documentId`、`params.revision`、`params.nodes`、`params.links` 结构完整

---

### `authority.documentDiff`

#### 最稳定的观察方式

1. 开两个 WebSocket 连接：
   - `authority-origin`
   - `authority-observer`
2. 两边都先发一次 `authority.getDocument`，建立 baseline。
3. 在 `authority-origin` 发 `authority.submitOperation` 的 `node.create`。
4. 到 `authority-observer` 观察通知。

#### 观察点

- `method` 为 `authority.documentDiff`
- `params.baseRevision` 是旧 revision
- `params.revision` 是新 revision
- `params.operations` 里至少包含一条 `node.create`

#### 注意

当前 transport 会跳过“同连接 response 已带 document 的重复回声”，所以要验证 `documentDiff`，**observer 连接** 比单连接更稳定。

---

### `authority.runtimeFeedback`

#### 出现时机

- `authority.controlRuntime` 执行期间

#### 观察点

- `method` 为 `authority.runtimeFeedback`
- `params.type` 会落在 4 类之一：
  - `graph.execution`
  - `node.execution`
  - `node.state`
  - `link.propagation`

---

## 错误路径测试

### 1. 非法 JSON -> `-32700`

#### 发送内容

这条不是 JSON 对象，而是原始文本：

```text
{
```

#### 预期

返回：

```json
{
  "jsonrpc": "2.0",
  "id": null,
  "error": {
    "code": -32700
  }
}
```

---

### 2. 非法 envelope -> `-32600`

#### 发送内容

```json
{
  "jsonrpc": "2.0",
  "method": "authority.getDocument"
}
```

#### 预期

- 返回 `error.code = -32600`
- 原因是缺少合法 request envelope 所需字段

---

### 3. 未知 method -> `-32601`

#### 发送内容

```json
{
  "jsonrpc": "2.0",
  "id": "{{requestId}}",
  "method": "authority.unknown"
}
```

#### 预期

- 返回 `error.code = -32601`

---

### 4. 非法 params -> `-32602`

#### 发送内容

```json
{
  "jsonrpc": "2.0",
  "id": "{{requestId}}",
  "method": "authority.controlRuntime",
  "params": {
    "request": {
      "type": "graph.play",
      "unexpected": true
    }
  }
}
```

#### 预期

- 返回 `error.code = -32602`
- 说明 generated params 校验已生效

---

## 真实测试矩阵

| 场景 | 入口 | 前置条件 | 发送内容 | 预期结果 |
| :--- | :--- | :--- | :--- | :--- |
| 能力发现 | `WS /authority` | 已建连 | `rpc.discover` | 返回完整 OpenRPC 文档 |
| 读取文档 | `WS /authority` | 已建连 | `authority.getDocument` | 返回当前 authoritative 文档 |
| 图操作提交 | `WS /authority` | 有 `currentDocument` baseline | `authority.submitOperation` | 返回 `accepted/changed/revision/document` |
| 整图替换 | `WS /authority` | 有 `currentDocument` baseline | `authority.replaceDocument` | 返回新文档或 `null` |
| 运行控制 | `WS /authority` | 已载入可执行 fixture | `authority.controlRuntime` | 返回运行结果，并伴随 runtime feedback |
| 首包同步 | `WS /authority` | 建连成功 | 无需发请求 | 收到 `authority.frontendBundlesSync` |
| 增量文档同步 | `WS /authority` | origin + observer 都建立 baseline | origin 发 `submitOperation` | observer 收到 `authority.documentDiff` |
| 全量文档同步 | `WS /authority` | 无 baseline 或不能 diff | 触发整图变化 | 收到 `authority.document` |
| 健康检查 | `GET /health` | 服务在线 | HTTP GET | 返回 `ok/documentId/revision/connectionCount` |
| 非法 JSON | `WS /authority` | 已建连 | 原始文本 `{` | `-32700` |
| 非法 envelope | `WS /authority` | 已建连 | 缺字段 request | `-32600` |
| 未知 method | `WS /authority` | 已建连 | `authority.unknown` | `-32601` |
| 非法 params | `WS /authority` | 已建连 | 多余或错误 params | `-32602` |

---

## 在 Apifox 中保存为接口文档

### `GET /health`

1. 在 HTTP 接口页保存请求 URL、示例响应和断言说明。
2. 把接口名称固定为 `health`。
3. 在说明区写明：它不是 OpenRPC method，只是 authority 健康检查入口。

### `WS /authority`

1. 在 WebSocket 接口页保存连接地址 `{{authorityWsUrl}}`。
2. 把上面的成功场景和错误场景分别保存为消息示例。
3. 在说明区写明：
   - 首包应先看到 `authority.frontendBundlesSync`
   - `authority.documentDiff` 推荐用 observer 连接验证
   - `authority.runtimeFeedback` 是持续事件流，不是同步 response

---

## 资料来源

检索日期：`2026-03-22`

- Apifox 官方文档：
  - [导入 OpenAPI/Swagger](https://docs.apifox.com/import-openapi-swagger)
  - [导入导出数据](https://docs.apifox.com/import-and-export)
  - [WebSocket 调试](https://docs.apifox.com/5220190m0)
- 仓库事实源：
  - `openrpc/authority.openrpc.json`
  - `templates/backend/python-openrpc-authority-template/src/.../core/protocol.py`
  - `templates/backend/python-openrpc-authority-template/src/.../core/document_store.py`
  - `templates/backend/python-openrpc-authority-template/src/.../core/frontend_bundles.py`
  - `templates/backend/python-openrpc-authority-template/tests/test_server.py`
  - `templates/backend/python-openrpc-authority-template/tests/test_generated_client.py`
  - `templates/backend/python-openrpc-authority-template/tests/test_runtime.py`
