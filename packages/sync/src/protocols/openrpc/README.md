# `src/protocols/openrpc`

## 作用

这个目录当前是 OpenRPC 协议层的概念文档入口。  
它解释的是“为什么 sync 要先提供 OpenRPC 子出口、这个子出口的边界是什么”，而不是实际运行时代码目录。

实际代码在：

- [../../openrpc/README.md](../../openrpc/README.md)

## 当前边界

OpenRPC 子出口当前负责：

- method / notification 命名
- JSON-RPC envelope
- params / result / notification 校验
- OpenRPC 到根层 `SyncCommand / SyncAck / SyncOutletEvent` 的映射

OpenRPC 子出口当前不负责：

- session 的 pending / resync 编排
- storage identity 规则
- `authorityKey` 生成
- recovery snapshot 暴露时机

## 为什么当前先落 OpenRPC

当前工作区里最成熟的后端同步经验来自 OpenRPC authority 链，因此 `@leafergraph/sync` 先提供 OpenRPC 子出口。  
这只是当前实现顺序，不意味着根层围绕 OpenRPC 命名。

## 当前实现对根层的约束

当前 OpenRPC 子出口继续遵守这些约束：

- 不把 JSON-RPC 字段抬进根层类型
- 不把 method 名称写进 `SyncCommand`
- 不让 session 直接理解 OpenRPC 错误 envelope
- 不负责把 endpoint 转换成 `authorityKey`

## 当前特殊事件处理

OpenRPC 子出口当前会：

- 把 `authority.document` 映射成 `snapshot`
- 把 `authority.documentDiff` 映射成 `patch`
- 把 `authority.runtimeFeedback` 映射成 `feedback`
- 校验但忽略 `authority.frontendBundlesSync`

## 推荐阅读顺序

1. [../../../README.md](../../../README.md)
2. [../../../OUTLETS.md](../../../OUTLETS.md)
3. [../../openrpc/README.md](../../openrpc/README.md)
