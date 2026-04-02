# `example/runtime-bridge-node-demo`

`runtime-bridge-node-demo` 是一个 backend-first 的 workspace 示例。

它把 `@leafergraph/runtime-bridge` 真正放到“Node authority + 浏览器 bridge client”这条链上，而不是只展示一段 transport 接口代码。

## 这个示例演示什么

- Node 端用 `happy-dom + leafergraph` 跑一个 headless authority
- authority 持有正式图文档、执行链、runtime feedback 和 history
- 浏览器端通过 `LeaferGraphRuntimeBridgeClient` 拉 snapshot、收 diff、发 control
- 本地交互通过 `createGraphOperationsFromInteractionCommit(...)` 显式上传正式 operation

## 目录结构

- `src/server`
  - Node authority、headless DOM bootstrap、WebSocket server
- `src/client`
  - 浏览器 transport、bridge client 接线、调试台 UI
- `src/shared`
  - demo 文档、wire protocol、日志格式化
- `tests`
  - authority 行为和 transport 请求/响应 smoke

## 启动方式

在仓库根目录开两个终端：

```bash
bun run dev:runtime-bridge-node-demo:server
bun run dev:runtime-bridge-node-demo:client
```

然后打开 Vite 输出的本地地址。

页面里可以直接：

- `Connect`
- `Play`
- `Step`
- `Stop`
- `Resync Snapshot`

也可以直接拖动节点、折叠节点、修改 `system/timer` widget，观察 operation 上传和 authority 回投。

## 构建与测试

```bash
bun run build:runtime-bridge-node-demo
bun run --filter leafergraph-runtime-bridge-node-demo test
```

`preview` 只负责浏览器端静态页面：

```bash
bun run preview:runtime-bridge-node-demo
```

预览时仍然需要单独启动 Node authority。

## 说明

- 这是一个单 authority、单文档、内存态 session 的示例
- 不包含 auth、presence、持久化或冲突解决
- 浏览器端不是 authority，只是一个显式上传 interaction commit 的 bridge client

## 继续阅读

- [根 README](../../README.md)
- [@leafergraph/runtime-bridge README](../../packages/runtime-bridge/README.md)
- [leafergraph README](../../packages/leafergraph/README.md)
