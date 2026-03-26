# `@leafergraph/sync` Outlet Contract

## 文档定位

这份文档专门说明当前 `SyncOutlet` 合同，以及它和 session、protocol、carrier、storage 之间的边界。  
如果 README 解决的是“包是什么”，这里解决的是“为什么切协议时应尽量只换 outlet”。

## 当前 `SyncOutlet` 接口

当前根层 `SyncOutlet` 固定为：

```ts
export interface SyncOutlet {
  getSnapshot(): Promise<DocumentSnapshot>;
  request(command: SyncCommand): Promise<SyncAck>;
  subscribe(listener: (event: SyncOutletEvent) => void): () => void;
  getConnectionStatus?(): ConnectionStatus;
  dispose?(): void | Promise<void>;
}
```

当前 `SyncOutletEvent` 固定为：

```ts
export type SyncOutletEvent =
  | { type: "snapshot"; snapshot: DocumentSnapshot }
  | { type: "patch"; patch: DocumentPatch }
  | { type: "feedback"; feedback: RuntimeFeedback }
  | { type: "connection"; status: ConnectionStatus }
  | { type: "error"; error: SyncOutletError };
```

当前 `SyncOutletError.kind` 固定区分：

- `decode`
- `transport`
- `protocol`

## outlet 当前负责什么

当前 outlet 实现应只负责：

- 把 `SyncCommand` 编码成协议请求
- 把协议响应映射成 `SyncAck`
- 把协议通知映射成 `snapshot / patch / feedback`
- 把链路状态映射成 `connection`
- 把解码失败、协议错误、传输错误映射成 `error`

## outlet 当前不负责什么

当前 outlet 明确不负责：

- session 的 pending / confirmation / resync 编排
- storage 三态入口裁决
- `authorityKey` 生成或规范化
- `documentId + authorityKey` 到完整 `SyncStorageScope` 的组装
- storage ownership 与 `dispose?()` 裁决
- recovery snapshot 的发布时间与 authority 替换时机
- provenance 是否进入公共类型
- UI 状态与业务页面逻辑

## `getSnapshot()` 为什么单独存在

当前实现把 `getSnapshot()` 作为独立入口保留下来，是因为它承担两类固定职责：

- session 首连时拉 authority 首快照
- `resync()` 时整图重拉

这样做的好处是：

- 整图拉取不需要伪装成特殊 command
- `request(...)` 可以只表达“一条命令 -> 一次确认”
- outlet 和 session 都更容易维持 authority-first 语义

## 当前的协议 / carrier 分层

在 `packages/sync` 当前实现里：

- `src/openrpc/openrpc_outlet.ts`
  - 负责 method / notification 映射
- `src/openrpc/websocket_carrier.ts`
  - 负责 WebSocket 上的 JSON-RPC envelope 收发

也就是说：

- outlet 负责协议语义
- carrier 负责承载语义

同一个协议未来如果要换 carrier，应该尽量仍然停留在协议子出口内部，不抬回根层。

## 当前的切换边界

业务层当前推荐这样接：

```ts
import { createSyncSession } from "@leafergraph/sync";
import {
  createOpenRpcOutlet,
  createOpenRpcWebSocketCarrier
} from "@leafergraph/sync/openrpc";

const session = createSyncSession({
  documentId: "demo-graph",
  outlet: createOpenRpcOutlet({
    carrier: createOpenRpcWebSocketCarrier({
      endpoint: "ws://localhost:8787/authority"
    })
  })
});
```

如果未来换成别的协议，理想改动面仍然是：

- 保持 `createSyncSession(...)` 不变
- 只替换 `createXxxOutlet(...)`

一旦业务层需要自己拼 protocol payload、自己理解 notification method、自己处理 decode error 到 resync 的转换，就说明 outlet 边界已经回退了。

## 当前实现里的特殊处理

OpenRPC 子出口当前还做了两个明确约束：

- `authority.documentDiff`
  - outlet 会先尝试前推自己的 `currentDocument`
  - 前推失败时清空内部基线，并把错误上抛给 session
- `authority.frontendBundlesSync`
  - 只在 OpenRPC 子出口校验结构
  - 不进入 sync 根层事件面

## outlet 合约测试基线

当前每个 outlet 实现至少应满足这些测试要求：

- `request(...)` 能正确映射成功与失败响应
- `getSnapshot()` 能拉到 authority 当前整图
- `subscribe(...)` 能持续投影 `snapshot / patch / feedback / connection / error`
- `dispose()` 后不会继续泄漏监听
- decode / protocol 错误不会被伪装成成功 ack
- outlet 不擅自接管 storage 规则
- outlet 不擅自实现 session 级恢复状态机

## 推荐阅读顺序

1. [README.md](./README.md)
2. [ARCHITECTURE.md](./ARCHITECTURE.md)
3. [src/outlet/README.md](./src/outlet/README.md)
4. [src/openrpc/README.md](./src/openrpc/README.md)
