# `src/session`

## 作用

`src/session` 承接 `@leafergraph/sync` 当前最核心的 authority-first 会话状态机。  
协议实现可以替换，但 session 对上层暴露的同步语义当前保持稳定。

## 边界

当前这一层负责：

- `createSyncSession(...)`
- authority 首连与 `resync()` 编排
- command -> ack -> snapshot 的确认链
- 文档订阅、运行反馈订阅、连接状态订阅
- recovery snapshot 的临时投影
- storage ownership 的执行边界

当前这一层不负责：

- 协议字段编码与解码
- JSON-RPC / OpenRPC 校验
- carrier 连接实现
- 浏览器缓存底层实现
- 页面状态与 UI 编排

## 当前核心入口

当前公开入口固定是：

- `createSyncSession(...)`
- `SyncSession`
- `ResyncPolicy`

`createSyncSession(...)` 当前固定采用“一次 session 对应一份逻辑文档”的边界，因此 `documentId` 始终显式。

## 当前启动链

当前 `connect()` 的执行顺序固定为：

1. 建立 outlet 订阅
2. 解析 storage 三态
3. 若 storage 生效且存在恢复资料，先投影 recovery snapshot
4. 调用 `outlet.getSnapshot()` 获取 authority 首快照
5. 用 authority 首快照整体替换 recovery 基线
6. 保存 authority 已确认快照到 storage

因此 `subscribeDocument(...)` 当前允许先收到 recovery 基线，再收到 authority 首快照。

## 当前 command / ack / resync 语义

### submitCommand

当前 `submitCommand(...)` 固定做这些事：

1. 先确保 `connect()` 已完成
2. 把 command 交给 outlet
3. 如果 ack 附带 authoritative snapshot，立即整体替换当前文档
4. 如果 ack 为 `rejected` 或 `resync-required`，按策略触发 `resync()`

### patch

当前 session 处理 patch 时固定遵守：

- 必须存在当前 authority 基线
- patch 通过 `applyGraphDocumentDiffToDocument(...)` 前推
- `documentId` 不匹配、`baseRevision` 不匹配或 patch 损坏时直接 `resync()`

### reconnect

当前 reconnect 语义固定为：

- 只有 authority 事实链已经建立后，断线才会被记为 reconnect gap
- gap 后重新回到 `connected`，按策略触发 `resync()`

### error

当前 `error` 事件处理固定为：

- `decode / protocol`
  - 走 `fail-and-refetch`
- `transport`
  - 只交给连接状态链处理

## 当前 storage 接入方式

session 当前接受：

- `storage?: false | SyncStorage`
- `storageScope?: { authorityKey: string }`

解析规则固定为：

- `storage === false`
  - 明确禁用
- `storage` 省略
  - 仅在浏览器持久化宿主且 `authorityKey` 完整时启用默认浏览器缓存
- `storage` 显式传入
  - 仍然要求 `authorityKey`
  - 缺少时自动退化为禁用

## 当前恢复边界

当前 recovery 语义固定为：

- storage 只提供启动临时基线
- authority 首快照与 resync 快照整体替换本地基线
- `RuntimeFeedback` 不从 storage 恢复
- v1 不做 pending replay

## 当前内部来源语义

虽然它们不是公开字段，session 当前仍然保留这些内部来源标签：

- `storage-recovery`
- `authority-event`
- `resync`
- `ack-snapshot`

这些标签只用于内部时序和调试，不进入公开快照载荷。

## 推荐阅读顺序

1. [../../README.md](../../README.md)
2. [../../ARCHITECTURE.md](../../ARCHITECTURE.md)
3. [../storage/README.md](../storage/README.md)
4. [../openrpc/README.md](../openrpc/README.md)
