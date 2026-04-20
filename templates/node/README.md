# Node Templates

这个目录只放“纯节点作者模板”。

它们的共同特点是：

- 作者代码集中在 `src/developer/`
- 以 `@leafergraph/authoring` 和 `@leafergraph/node` 为核心真源
- 既能导出 ESM 包，也能构建 `node.iife.js`

## 当前模板

- [authoring-node-template](./authoring-node-template/README.md)
  - 纯节点作者模板
  - 自带 `BasicSumNode` 和 `WatchNode`
  - 适合从“单个节点包”开始扩成自己的 node module

## 适用边界

适合放在这里的模板：

- 只交付节点定义、模块和 plugin
- 不需要额外交付 Widget bundle 或 demo bundle
- 主要演示节点作者层和 `node.iife.js` 产物

不适合放在这里的模板：

- 同时交付 node / widget / demo 的组合模板
- 主要关注 Widget 渲染层的模板
- 宿主壳层或 authority 相关模板

## 推荐阅读顺序

1. [authoring-node-template README](./authoring-node-template/README.md)
2. [@leafergraph/authoring README](../../packages/authoring/README.md)
3. [外部节点包接入方案](../../docs/节点插件接入方案.md)
