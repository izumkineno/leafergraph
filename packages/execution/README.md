# `@leafergraph/execution`

`@leafergraph/execution` 是 LeaferGraph 的纯执行内核。

它当前只依赖 `@leafergraph/node`，负责：

- 节点执行与传播
- 图级 `play / step / stop`
- `event` 输入到 `onAction(...)` 的分发语义
- 执行反馈事件与本地 feedback adapter
- 内建 `system/on-play`（Start Event）与 `system/timer`

它不负责：

- Leafer scene 刷新
- 节点壳、Widget 渲染
- 节点状态面板投影
- 宿主交互与视图同步

这些宿主语义继续由 `leafergraph` 主包承担。
