# `@leafergraph/sync` 架构说明

## 文档定位

这份文档说明当前 `packages/sync` 已经采用的真实分层，而不是设计草案。  
它主要服务两类读者：

- 接入者：想确认 session、outlet、storage 该怎么接
- 维护者：想确认哪些职责属于根层，哪些职责必须停留在协议或宿主子层

## 当前分层

| 层级 | 当前职责 | 当前代码落点 |
| --- | --- | --- |
| `core` | 根层同步模型、校验工具、默认恢复策略 | `src/core` |
| `session` | authority-first 会话状态机、订阅投影、resync 编排 | `src/session` |
| `outlet` | 协议出口抽象与 contract 说明 | `src/outlet` |
| `openrpc` | 当前首个协议子出口与 WebSocket carrier | `src/openrpc` |
| `storage` | storage 三态解析、浏览器缓存实现 | `src/storage` |
| `protocols/openrpc` | 协议概念层说明与边界约束 | `src/protocols/openrpc` |

当前实现已经落下：

- `createSyncSession(...)`
- `createOpenRpcOutlet(...)`
- `createOpenRpcWebSocketCarrier(...)`
- `createBrowserCacheStorage(...)`

## 设计前提

### Leafer 提供的是同步底座，不是现成后端同步框架

Leafer 官方文档当前明确提供：

- JSON 导入导出
- 属性变化监听
- Node / 非浏览器运行环境支持

这些能力足够构成同步系统底座，但不会直接替 `leafergraph` 决定：

- 协议合同
- carrier 选型
- authority / client 的事实真源关系
- resync 与冲突恢复策略

因此 `@leafergraph/sync` 需要把这些边界在自己的根层合同里写清楚。

### 当前实现固定采用 authority-first

当前包以 authority-first 为根前提：

- authority 是文档事实真源
- session 维护会话态，不反向宣称前端缓存比 authority 更真
- resync 时统一拉整图重建基线

这里要区分三层概念：

- authority-first / CRDT：同步模型
- OpenRPC / gRPC / REST：协议合同
- WebSocket / HTTP / MessagePort：承载方式

## 主数据流

### 命令提交链

1. 业务层调用 `session.submitCommand(...)`
2. session 先确保 `connect()` 完成
3. command 交给 `SyncOutlet.request(...)`
4. outlet 把命令编码成具体协议请求
5. authority 返回 `SyncAck`
6. 若 ack 附带 authoritative snapshot，session 立即整体替换当前文档
7. 若 ack 为 `rejected` 或 `resync-required`，session 按 `ResyncPolicy` 触发 `resync()`

### 首连 / 恢复链

1. session 建立 outlet 订阅
2. session 解析 storage 三态
3. 如果 storage 生效且本地存在恢复资料，先投影 recovery snapshot
4. session 调用 `outlet.getSnapshot()`
5. authority 首快照整体替换 recovery 基线
6. authority 已确认快照落盘到 storage

### 长流事件链

当前 outlet 只向 session 投影五类事件：

- `snapshot`
- `patch`
- `feedback`
- `connection`
- `error`

session 对这些事件的处理固定为：

- `snapshot`：整体替换当前文档
- `patch`：尝试在当前 authority 基线上前推；失败则 `resync()`
- `feedback`：旁路分发给运行反馈订阅者
- `connection`：更新连接状态，并在断线恢复后按策略重拉
- `error`：`decode / protocol` 走 `fail-and-refetch`，`transport` 只交给连接状态链处理

## Session 状态与恢复语义

当前实现虽然没有公开复杂状态枚举，但内部语义固定为：

- 首连前：尚未建立 authority 事实链
- recovery 基线阶段：文档可先展示，但仍等待 authority 首快照
- authority 基线阶段：当前快照可被 patch 前推
- reconnect gap：已经见过 authority 事实，但链路出现过断点
- resync 中：重新走 `getSnapshot()` 拉整图替换

当前 `ResyncPolicy` 默认值固定为：

- `onAckRejected: "refetch"`
- `onPatchFailure: "refetch"`
- `onReconnect: "refetch"`
- `onDecodeError: "fail-and-refetch"`

### 为什么 v1 固定为 `resync-only`

当前实现固定采用 `resync-only`，原因很直接：

- authority-first 更容易稳定确认链与恢复链
- storage 合同当前只保存已确认快照，不保存 pending 队列
- 现有实现不提供跨重启 pending replay 语义

因此当前 recovery 语义只有一条：

- recovery snapshot 只能做启动临时基线
- authority 首快照与 resync 快照始终整体替换本地基线

## storage 边界

当前 session 入口里的 storage 语义固定为三态：

- `storage === false`
  - 明确禁用 storage
- `storage` 省略
  - 只有在 Web 宿主具备 `IndexedDB` 且显式提供 `authorityKey` 时启用默认浏览器缓存
- `storage` 显式传入
  - 仍然要求显式 `authorityKey`
  - 缺少时自动退化为禁用

完整 `SyncStorageScope` 固定为：

```ts
{
  documentId: string;
  authorityKey: string;
}
```

但 session 对外暴露的 `storageScope` 只要求：

```ts
{
  authorityKey: string;
}
```

当前实现由 session 在读写 storage 前补齐 `documentId`。

### ownership

当前 ownership 规则固定为：

- 调用者显式注入的 storage：由调用者负责生命周期
- session 隐式创建的默认浏览器缓存：由 session 在 `dispose()` 时释放

## 协议、carrier 与根层的边界

### 根层负责什么

根层当前只负责：

- `SyncCommand`
- `SyncAck`
- `SyncOutlet`
- `SyncSession`
- `SyncStorage`
- `ConnectionStatus`
- `RuntimeFeedback`

### OpenRPC 子出口负责什么

当前 OpenRPC 子出口负责：

- method / notification 常量
- JSON-RPC envelope 类型
- params / result / notification 校验
- `SyncCommand` 到 OpenRPC request 的映射
- OpenRPC notification 到 `SyncOutletEvent` 的映射

### WebSocket carrier 负责什么

当前 WebSocket carrier 只负责：

- 惰性建连
- request / response 配对
- notification 原样转发给 outlet
- 连接状态投影
- 自动重连

它不负责：

- session 的 resync 策略
- storage 启用条件
- `authorityKey` 生成
- recovery snapshot 何时可见

## Leafer 快照边界

当前实现把 `DocumentSnapshot` 建立在 LeaferGraph 文档模型之上，也对应 Leafer tree 级 JSON / canonical document 的快照语义。  
这里必须继续保持两条边界：

- 不直接对 `App` 实例本体做 JSON 快照
- 不把 `PropertyEvent` 当成 canonical sync 源

## 当前实现明确忽略的能力

下面这些能力当前不进入根层合同：

- `authority.frontendBundlesSync`
- awareness / presence
- provenance 公共字段
- CRDT
- 跨重启 pending replay

## 推荐阅读顺序

1. [README.md](./README.md)
2. [OUTLETS.md](./OUTLETS.md)
3. [src/session/README.md](./src/session/README.md)
4. [src/openrpc/README.md](./src/openrpc/README.md)
5. [src/storage/README.md](./src/storage/README.md)
