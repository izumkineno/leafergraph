# `@leafergraph/runtime-bridge`

`@leafergraph/runtime-bridge` 是 LeaferGraph workspace 的聚合与桥接包。

它把浏览器侧 `leafergraph` 主包、可后移的纯协议 helper、执行宿主导出和最小 transport 抽象收口到同一层，但不会把 authority、session 或 transport 责任重新塞回 `leafergraph` 主包。

## 包定位

适合直接依赖它的场景：

- 在浏览器里把 `LeaferGraph` 实例接到本地后端或 authority
- 在不依赖 DOM 的环境里复用纯 `portable` 协议和 diff helper
- 把执行宿主与桥接协议作为一组稳定入口暴露给宿主应用

不适合直接把它当成：

- 图渲染主包
- 图模型真源
- 具体的 HTTP / WebSocket / IPC transport 实现

## 公开入口

### 根入口

根入口聚合四类导出：

- `LeaferGraph`
- `createLeaferGraph(...)`
- `LeaferGraphRuntimeBridgeClient`
- `portable` / `execution` / `transport` 的关键导出

### `./portable`

这个子路径只放纯数据、纯协议和 helper：

- `GraphDocument`
- `GraphOperation`
- `GraphDocumentDiff`
- `applyGraphDocumentDiffToDocument(...)`
- `LeaferGraphHistoryEvent`
- `RuntimeFeedbackEvent`
- `LeaferGraphInteractionCommitEvent`
- `createGraphOperationsFromInteractionCommit(...)`

### `./execution`

这个子路径直接复用 `@leafergraph/execution` 的正式导出，适合 Node-only 宿主或本地后端复用执行链。

### `./transport`

这个子路径定义最小桥接接口：

- `LeaferGraphRuntimeBridgeTransport`
- `RuntimeBridgeControlCommand`
- `RuntimeBridgeInboundEvent`

### `./client`

这个子路径提供浏览器侧桥接控制器：

- `LeaferGraphRuntimeBridgeClient`

## 最小使用方式

```ts
import { createLeaferGraph } from "@leafergraph/runtime-bridge";
import { LeaferGraphRuntimeBridgeClient } from "@leafergraph/runtime-bridge/client";
import type { LeaferGraphRuntimeBridgeTransport } from "@leafergraph/runtime-bridge/transport";
import { createGraphOperationsFromInteractionCommit } from "@leafergraph/runtime-bridge/portable";

const graph = createLeaferGraph(container, {
  document
});

const transport: LeaferGraphRuntimeBridgeTransport = {
  async requestSnapshot() {
    return document;
  },
  async submitOperations(operations) {
    return operations.map((operation) => ({
      accepted: true,
      changed: true,
      operation,
      affectedNodeIds: [],
      affectedLinkIds: []
    }));
  },
  async sendControl() {},
  subscribe() {
    return () => {};
  }
};

const bridgeClient = new LeaferGraphRuntimeBridgeClient({
  graph,
  transport
});

await bridgeClient.connect();

graph.subscribeInteractionCommit((event) => {
  const operations = createGraphOperationsFromInteractionCommit(event, {
    source: "bridge.interaction"
  });
  void bridgeClient.submitOperations(operations);
});
```

## 与其它包的边界

| 包 | 负责什么 |
| --- | --- |
| `leafergraph` | 浏览器侧图实例、渲染、交互和运行反馈投影 |
| `@leafergraph/contracts` | 纯共享协议、图操作和 diff helper |
| `@leafergraph/execution` | 执行内核与反馈事件真源 |
| `@leafergraph/node` | 图文档、连线和节点模型真源 |

一句话记忆：

- `leafergraph` 负责显示和交互
- `@leafergraph/runtime-bridge` 负责聚合和桥接
- 具体 transport 仍然由外层宿主自己实现

## 常用命令

在 workspace 根目录执行：

```bash
bun run build:runtime-bridge
bun run test:runtime-bridge
```

## 继续阅读

- [根 README](../../README.md)
- [leafergraph README](../leafergraph/README.md)
- [@leafergraph/contracts README](../contracts/README.md)
- [@leafergraph/execution README](../execution/README.md)
- [runtime-bridge-node-demo 示例](../../example/runtime-bridge-node-demo/README.md)
