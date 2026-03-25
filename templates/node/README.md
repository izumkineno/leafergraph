# Node Templates

这个目录用于放“纯节点作者模型”的模板与说明。

## 当前边界

- 当前默认入口是 `authoring-node-template`。
- 节点模板的 `developer/` 会按 `shared / nodes / module` 分文件。
- 如果只是改包名、命名空间或 bundle 信息，优先改 `src/developer/shared.ts`。
- 如果是改节点逻辑，优先改 `src/developer/nodes/*.ts`。
- 这里不放需要同时维护 node/widget/demo 三段链路的组合模板。

## 当前模板

- [`authoring-node-template`](./authoring-node-template/README.md)
  - 纯节点作者模板
  - 内置 `BasicSumNode` 和 `WatchNode`
  - `WatchNode` 自带只读文字 Widget 示例
  - 浏览器发布物是 `dist/browser/node.iife.js`

## 应放什么

- 单节点 artifact 模板
- 节点定义作者指南
- 节点 demo 与执行器如何协作的说明

## 不应放什么

- authority 后端模板
- 混合型浏览器插件模板
- 同时包含前后端整包运行时的 misc 模板
