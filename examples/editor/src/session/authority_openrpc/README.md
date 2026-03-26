# `src/session/authority_openrpc`

## 作用
- 提供 editor authority 协议的 OpenRPC 生成物入口、运行时校验器和协议类型。

## 边界
- 负责协议描述、schema 校验和默认 adapter。
- 不负责 transport 本身，也不直接维护 document session。

## 核心入口
- `index.ts`
- `runtime.ts`
- `types.ts`
- `_generated/`

## 主要数据流 / 调用链
1. 共享 `openrpc/` 真源发生变化。
2. `tools/generate_from_openrpc.ts` 生成 `_generated/`。
3. transport/runtime 使用这些生成物校验 params/result/notification。

## 生成目录说明
- `_generated/` 只作为自动生成的协议真相镜像。
- 不在该目录手工补注释；若内容过期，重新执行 `bun run generate:authority-openrpc`。

## 推荐阅读顺序
1. `types.ts`
2. `runtime.ts`
3. `index.ts`
4. `_generated/descriptor.ts`

## 上下游关系
- 上游：仓库根 `openrpc/` 真源与生成器。
- 下游：`graph_document_authority_transport.ts`、`message_port*`、`websocket_remote_authority_transport.ts`。