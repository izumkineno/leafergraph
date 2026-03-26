# `src/ui/node-library-preview`

## 作用
- 提供节点库 hover/focus 预览浮层，以及对应的请求、落点和预览文档工具。

## 边界
- 负责预览浮层自己的只读 graph 和几何计算。
- 不负责节点创建或节点库列表展示。

## 核心入口
- `helpers.ts`
- `View.tsx`
- `Connected.tsx`

## 主要数据流 / 调用链
1. 节点库项触发预览请求。
2. `helpers.ts` 生成锚点和 preview document。
3. `View.tsx` 挂载一个只读 `LeaferGraph` 预览浮层。

## 推荐阅读顺序
1. `helpers.ts`
2. `View.tsx`
3. `Connected.tsx`

## 上下游关系
- 上游：`node-library/Connected.tsx`、`shell/provider.tsx`。
- 下游：`leafergraph` 只读预览实例。