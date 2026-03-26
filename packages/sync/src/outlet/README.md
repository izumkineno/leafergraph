# `src/outlet`

## 作用

`src/outlet` 说明的是 `@leafergraph/sync` 当前的抽象出口层。  
它不是某个具体协议的代码目录，而是根层 contract 的解释入口。

## 边界

当前 outlet 层负责：

- `SyncOutlet` 合同
- `SyncOutletEvent`
- `SyncOutletError`
- 连接状态语义

当前 outlet 层不负责：

- session 的 resync 状态机
- 协议特定字段
- storage 三态入口裁决
- `authorityKey` 生成
- recovery snapshot 暴露时机

## 当前 contract 核心

当前 `SyncOutlet` 固定提供：

- `getSnapshot()`
- `request(...)`
- `subscribe(...)`
- `getConnectionStatus?()`
- `dispose?()`

当前 contract 的关键点有三条：

- `request(...)` 只表达“一条命令 -> 一次确认”
- `getSnapshot()` 专门承担首连与 resync 的整图拉取
- `subscribe(...)` 承载长流事件，不把它和 command request 混写

## 当前与 session 的关系

当前关系非常明确：

- session 负责恢复策略与状态编排
- outlet 负责协议映射与事件投影

因此当前 outlet 不会决定：

- ack rejection 之后是否 resync
- reconnect 后是否重拉整图
- storage 是否启用

## 当前与 protocol / carrier 的关系

在当前实现里：

- `src/openrpc`
  - 是实际协议实现目录
- `src/protocols/openrpc`
  - 是协议边界文档目录

也就是说，outlet 层是根层 contract，OpenRPC 只是它的一个当前实现。

## 推荐阅读顺序

1. [../../OUTLETS.md](../../OUTLETS.md)
2. [../openrpc/README.md](../openrpc/README.md)
3. [../protocols/openrpc/README.md](../protocols/openrpc/README.md)
