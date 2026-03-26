# `src/core`

## 作用

`src/core` 是 `@leafergraph/sync` 的根层模型目录。  
这里放的是所有协议子出口、session 和 storage 都会共享的同步语义。

## 边界

当前这一层负责：

- `DocumentSnapshot`
- `DocumentPatch`
- `DocumentRevision`
- `SyncCommand`
- `SyncAck`
- `RuntimeFeedback`
- `ConnectionStatus`
- `SyncOutlet`
- `SyncStorage`
- `ResyncPolicy`
- 运行时最小校验与 `cloneValue(...)`

当前这一层不负责：

- OpenRPC / JSON-RPC 字段
- WebSocket / HTTP / MessagePort 细节
- editor 专属命名
- 页面或 UI 层逻辑

## 当前核心关系

### `DocumentSnapshot`

- 表达 authority 当前认可的整图事实
- 用于首连拉取、ack-snapshot 替换、resync 替换、storage 恢复基线
- 对应 Leafer tree 级 JSON / canonical document 的快照语义

### `DocumentPatch`

- 表达 authority 在已有基线上的增量推进
- 当前实现通过 `applyGraphDocumentDiffToDocument(...)` 前推
- 前推失败时 session 直接 `resync()`

### `SyncCommand`

当前命令固定三类：

- `document.apply-operation`
- `document.replace`
- `runtime.control`

所有 command 都带：

- `commandId`
- `issuedAt`

### `SyncAck`

当前 ack 固定区分：

- `accepted`
- `rejected`
- `resync-required`

文档类 ack 当前还可携带：

- `changed`
- `documentRevision`
- `snapshot`

### `RuntimeFeedback`

- 与文档链并行
- 只做运行反馈回流
- 当前不承载 presence / awareness

## 当前最低语义维度

这一层当前至少保住以下语义：

- 文档身份
- revision / 因果基线
- command / ack 关联关系
- resync 触发点

这些维度是 session 能正确判断“当前文档是否仍然可信”的前提。

## 快照边界

这一层继续固定两条边界：

- `DocumentSnapshot` 不直接等于 `App` 实例序列化
- `PropertyEvent` 不是 canonical sync 源

## 推荐阅读顺序

1. [../../README.md](../../README.md)
2. [../../ARCHITECTURE.md](../../ARCHITECTURE.md)
3. [../session/README.md](../session/README.md)
4. [../outlet/README.md](../outlet/README.md)
