# @leafergraph/basic-kit

`@leafergraph/basic-kit` 是 LeaferGraph workspace 里的默认内容包。

它负责这些能力：

- 基础 widgets 条目库
- 系统节点模块
- 一键安装这些默认内容的 plugin
- `./widget` 与 `./node` 子路径导出

它不负责这些能力：

- `LeaferGraph` 主包 facade
- Widget runtime 基础设施
- 图执行宿主或场景装配
- 默认 widget 主题真源

当前目录结构固定为：

- `src/widget/`：基础 widgets
- `src/node/`：系统节点与节点模块

正式入口：

- 根入口
  - `leaferGraphBasicKitPlugin`
- `./widget`
  - `BasicWidgetLibrary`
  - `BasicWidgetRendererLibrary`
  - 基础 widget 相关类型
- `./node`
  - `createBasicSystemNodeModule()`
  - `LEAFER_GRAPH_ON_PLAY_NODE_TYPE`
  - `leaferGraphOnPlayNodeDefinition`
  - `LEAFER_GRAPH_TIMER_NODE_TYPE`
  - `LEAFER_GRAPH_TIMER_DEFAULT_INTERVAL_MS`
  - `leaferGraphTimerNodeDefinition`
  - `LeaferGraphTimerRegistration`
  - `LeaferGraphTimerRuntimePayload`

主包显式安装示例：

```ts
import { leaferGraphBasicKitPlugin } from "@leafergraph/basic-kit";
import { createLeaferGraph } from "leafergraph";

const graph = createLeaferGraph(container, {
  plugins: [leaferGraphBasicKitPlugin]
});
```

常用命令：

```bash
bun run build:basic-kit
bun run test:basic-kit
```
