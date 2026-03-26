# `@leafergraph/sync`

`@leafergraph/sync` 是 LeaferGraph 的协议无关后端同步包。当前目录已经包含可构建、可测试的 v1 实现，包级叙事固定为“根层同步合同 + 协议子出口 + 可选 storage 子出口”。

当前实现保持这些前提：

- 根出口只表达同步语义，不把 `OpenRPC`、`WebSocket` 或 editor 兼容写成包级前提。
- `@leafergraph/sync/openrpc` 是首个协议子出口，负责把当前 authority OpenRPC method / notification 映射成根层合同。
- `@leafergraph/sync/storage` 提供浏览器缓存实现，默认语义固定为 IndexedDB。
- v1 固定采用 `authority-first + resync-only`，不承诺跨重启 pending replay，不把 awareness / presence 混进根层事件面。

## 包定位

这个包当前负责：

- 定义 `DocumentSnapshot`、`DocumentPatch`、`SyncCommand`、`SyncAck`、`RuntimeFeedback` 等根层术语
- 提供 authority-first 的 `createSyncSession(...)`
- 通过 `SyncOutlet` 把 session 状态机与协议实现拆开
- 提供浏览器侧恢复资料缓存能力
- 让业务层在切协议时尽量只替换 `createXxxOutlet(...)`

这个包当前不负责：

- editor 兼容层
- UI 组件、面板和页面壳层
- 把某个具体协议抬成根层真理
- CRDT、presence、awareness 或多主协作模型
- 直接暴露 carrier 细节给业务层

## 当前导出

### 根出口 `@leafergraph/sync`

当前稳定导出包括：

- `createSyncSession(...)`
- `DEFAULT_RESYNC_POLICY`
- `DocumentSnapshot`
- `DocumentPatch`
- `DocumentRevision`
- `RuntimeFeedback`
- `ConnectionStatus`
- `SyncCommand`
- `SyncAck`
- `SyncOutlet`
- `SyncOutletEvent`
- `SyncOutletError`
- `SyncSession`
- `SyncStorage`
- `SyncStorageScope`
- `SyncStoredState`
- `ResyncPolicy`

### 协议子出口 `@leafergraph/sync/openrpc`

当前稳定导出包括：

- `createOpenRpcOutlet(...)`
- `createOpenRpcWebSocketCarrier(...)`
- `OPENRPC_METHODS`
- `OPENRPC_NOTIFICATIONS`
- `OpenRpcCarrier`
- `CreateOpenRpcOutletOptions`
- `CreateOpenRpcWebSocketCarrierOptions`

### storage 子出口 `@leafergraph/sync/storage`

当前稳定导出包括：

- `createBrowserCacheStorage(...)`
- `hasBrowserPersistenceHost(...)`
- `resolveSyncStorage(...)`

## 五分钟上手

```ts
import { createSyncSession } from "@leafergraph/sync";
import {
  createOpenRpcOutlet,
  createOpenRpcWebSocketCarrier
} from "@leafergraph/sync/openrpc";

const outlet = createOpenRpcOutlet({
  carrier: createOpenRpcWebSocketCarrier({
    endpoint: "ws://localhost:8787/authority"
  })
});

const session = createSyncSession({
  documentId: "demo-graph",
  outlet,
  storageScope: {
    authorityKey: "local-authority-dev"
  }
});

const disposeDocument = session.subscribeDocument((snapshot) => {
  console.log("document snapshot", snapshot.revision);
});

const disposeFeedback = session.subscribeRuntimeFeedback((feedback) => {
  console.log("runtime feedback", feedback.type);
});

await session.connect();

await session.submitCommand({
  commandId: "cmd-1",
  issuedAt: Date.now(),
  type: "runtime.control",
  request: {
    type: "graph.play"
  }
});

disposeDocument();
disposeFeedback();
await session.dispose();
```

## storage 三态入口

`createSyncSession(...)` 当前固定采用“一次 session 对应一份逻辑文档”的边界，因此 `documentId` 始终显式。  
与 storage 相关的 session 入参当前是：

- `storage?: false | SyncStorage`
- `storageScope?: { authorityKey: string }`

session 在真正读写 storage 前，会用 `documentId + authorityKey` 组装完整 `SyncStorageScope`。

三态入口合同固定如下：

- `storage === false`
  - 明确禁用 storage
  - 不读取、不写入、不创建默认缓存
- `storage` 省略
  - 仅在 Web 宿主具备 `IndexedDB`，且显式提供 `storageScope.authorityKey` 时，隐式启用默认浏览器缓存
  - 这条路径固定等价于 `createBrowserCacheStorage({ namespace: "@leafergraph/sync" })`
  - 不满足条件时自动等同 `storage: false`
- `storage` 显式传入 `SyncStorage`
  - 只有在同时提供 `storageScope.authorityKey` 时才生效
  - 缺少 `authorityKey` 时固定自动退化为 `storage: false`

显式禁用：

```ts
const session = createSyncSession({
  documentId: "demo-graph",
  outlet,
  storage: false
});
```

使用隐式默认浏览器缓存：

```ts
const session = createSyncSession({
  documentId: "demo-graph",
  outlet,
  storageScope: {
    authorityKey: "local-authority-dev"
  }
});
```

显式覆盖默认浏览器缓存配置：

```ts
import { createSyncSession } from "@leafergraph/sync";
import { createBrowserCacheStorage } from "@leafergraph/sync/storage";

const session = createSyncSession({
  documentId: "demo-graph",
  outlet,
  storage: createBrowserCacheStorage({
    namespace: "my-app"
  }),
  storageScope: {
    authorityKey: "local-authority-dev"
  }
});
```

## 恢复时序

当前 session 的启动恢复链固定为：

1. 建立 outlet 订阅与连接状态观察
2. 解析 storage 三态
3. 如 storage 生效且本地存在恢复资料，先投影 `storage-recovery` 临时基线
4. 调用 `outlet.getSnapshot()` 获取 authority 首快照
5. authority 首快照整体替换 recovery 基线
6. 后续 patch 只在可信基线上前推，失败时直接 `resync()`

这里有几条固定语义：

- recovery snapshot 只用于减少空白态，不宣称自己比 authority 更真
- authority 首快照或 resync 快照会整体替换 recovery 基线
- v1 不定义 recovery 与 authority 的 merge 语义
- `RuntimeFeedback` 不从 storage 恢复
- v1 不承诺跨重启 pending replay

## 快照边界

`DocumentSnapshot` 当前基于 LeaferGraph 文档模型，也对应 Leafer tree 级 JSON / 包内 canonical document 的快照语义。  
这里要明确两条边界：

- 不直接把 `App` 实例本体当成快照来源
- `PropertyEvent` 只适合观察与调试，不是 canonical sync 源

Leafer 官方文档已经明确：

- `App` 暂不支持直接 JSON 导入导出
- 需要走 `app.tree` 导出与 `app.tree.set(...)` 恢复

## Outlet 事件面

当前 `SyncOutlet` 除了 `request(...)` 之外，还固定提供：

- `getSnapshot()`
- `subscribe(listener)`
- `getConnectionStatus?()`
- `dispose?()`

当前 `SyncOutletEvent` 固定包含五类事件：

- `snapshot`
- `patch`
- `feedback`
- `connection`
- `error`

当前 `SyncOutletError.kind` 固定区分：

- `decode`
- `transport`
- `protocol`

`authority.frontendBundlesSync` 仍然属于 OpenRPC / editor 专属协议事件；当前 OpenRPC 子出口会校验它的结构，但不会把它投影进 sync 根层事件面。

## 推荐阅读顺序

1. 先读这份 README，确认包定位、导出面和恢复时序
2. 再读 [ARCHITECTURE.md](./ARCHITECTURE.md)，确认真实分层与状态机
3. 再读 [OUTLETS.md](./OUTLETS.md)，确认 outlet contract
4. 继续深入源码时，按下面顺序阅读：
   - [src/core/README.md](./src/core/README.md)
   - [src/session/README.md](./src/session/README.md)
   - [src/openrpc/README.md](./src/openrpc/README.md)
   - [src/storage/README.md](./src/storage/README.md)
   - [src/outlet/README.md](./src/outlet/README.md)
   - [src/protocols/openrpc/README.md](./src/protocols/openrpc/README.md)

## 非目标

v1 明确不做这些事情：

- 不承诺 editor 接口兼容
- 不把 OpenRPC 写成根协议真理
- 不把 WebSocket 写成 session 默认底座
- 不默认做乐观投影
- 不把 CRDT 提升为根前提
- 不把 presence / awareness 放进 `RuntimeFeedback`
- 不承诺跨重启 pending replay

## 资料来源

主要依据包括：

- Leafer 官方文档
  - [Guide 入口](../../../leafer-docs/guide/index.md)
  - [JSON 导入导出](../../../leafer-docs/reference/UI/json.md)
  - [属性变化事件](../../../leafer-docs/reference/event/basic/Property.md)
  - [Node 运行环境](../../../leafer-docs/guide/install/ui/node/start.md)
- Context7
  - `/yjs/docs`
  - `/automerge/automerge-repo`
