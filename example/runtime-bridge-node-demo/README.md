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

## Authority Artifact 与 Browser Artifact

这个 demo 里最容易混淆的一点，是远端节点条目通常会同时出现两份 artifact：

- `authorityArtifact`
- `browserArtifact`

它们不是重复字段，而是分别给两端加载。

### `authorityArtifact`

由 Node authority 加载，用来：

- 真正在后端注册节点类型
- 执行节点逻辑
- 让 authority 能在蓝图替换、operation 应用和运行控制里识别这些节点

### `browserArtifact`

由浏览器加载，用来：

- 在本地图实例里注册节点或 widget 类型
- 正确恢复 authority 发来的 `document.snapshot` / `document.diff`
- 渲染节点外观和 widget 交互

### 三类条目的要求

- `node-entry` 同时需要 `authorityArtifactRef` 和 `browserArtifactRef`
- `component-entry` 只需要 `browserArtifactRef`
- `blueprint-entry` 只需要 `documentArtifactRef`

### demo 里的当前实现

当前示例里的远端节点条目为了简化演示，authority/browser 两侧使用的是同一份节点源码生成的两个 artifact ref；这只是 demo 便利做法，不代表正式场景必须共用同一份代码。

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

## diff/legacy 压测

可以直接运行内置 benchmark，对比 `diff` 与 `legacy` 两种同步模式在高频 `operations.submit` 下的表现：

```bash
bun run --filter leafergraph-runtime-bridge-node-demo bench:diff-modes
```

脚本会输出 JSON 报告，包含：

- 吞吐（`throughputOpsPerSec`）
- 提交延迟（`avg/p50/p95SubmitMs`）
- `document.diff` 事件体和 wire 大小（`avgDiffEventBytes/avgDiffWireBytes`）
- 操作来源集合（`sourceSet`，可用于确认是否由 authority 归一）

可通过环境变量调参：

```bash
BENCH_BATCH_COUNT=200 BENCH_BATCH_SIZE=12 BENCH_WARMUP_BATCHES=20 bun run --filter leafergraph-runtime-bridge-node-demo bench:diff-modes
```

## 说明

- 这是一个单 authority、单文档、内存态 session 的示例
- 不包含 auth、presence、持久化或冲突解决
- 浏览器端不是 authority，只是一个显式上传 interaction commit 的 bridge client

## 继续阅读

- [根 README](../../README.md)
- [@leafergraph/runtime-bridge README](../../packages/runtime-bridge/README.md)
- [leafergraph README](../../packages/leafergraph/README.md)
