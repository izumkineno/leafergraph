# `src/openrpc`

## 作用

`src/openrpc` 是 `@leafergraph/sync/openrpc` 的实际运行时代码目录。  
这里放的是当前首个协议子出口实现，而不是概念层草案。

## 当前目录内容

- `types.ts`
  - OpenRPC / JSON-RPC 相关类型、carrier 合同与常量
- `validation.ts`
  - method params、result、notification 的结构校验
- `openrpc_outlet.ts`
  - 把 OpenRPC 协议映射成根层 `SyncOutlet`
- `websocket_carrier.ts`
  - 基于 WebSocket 的 JSON-RPC 承载实现
- `index.ts`
  - `@leafergraph/sync/openrpc` 子出口入口

## 当前实现边界

这一层当前负责：

- `createOpenRpcOutlet(...)`
- `createOpenRpcWebSocketCarrier(...)`
- OpenRPC method / notification 映射
- JSON-RPC envelope 收发与校验

这一层当前不负责：

- session 的 pending / resync 编排
- storage 规则
- `authorityKey` 生成或规范化
- 页面级接线

## 当前数据流

### request 链

1. session 调用 `outlet.request(...)`
2. OpenRPC outlet 把 `SyncCommand` 映射成具体 method + params
3. carrier 发送 JSON-RPC request
4. response 回来后由 outlet 解码成 `SyncAck`

### notification 链

1. carrier 收到 JSON 文本
2. 判断是 response 还是 notification
3. notification 继续交给 outlet
4. outlet 按 method 映射为根层事件

## 当前与概念层文档的关系

如果你想看“为什么要把 OpenRPC 放在子出口，而不是根出口”，读：

- [../protocols/openrpc/README.md](../protocols/openrpc/README.md)

如果你想看“当前代码到底怎么实现”，从本目录源码开始读即可。

## 推荐阅读顺序

1. [../../README.md](../../README.md)
2. [../../OUTLETS.md](../../OUTLETS.md)
3. `types.ts`
4. `validation.ts`
5. `openrpc_outlet.ts`
6. `websocket_carrier.ts`
