# 最小图示例

`examples/minimal-graph` 是仓库根下的一个独立最小工程，用来演示：

- 不依赖 `packages/editor`
- 只使用 `leafergraph + @leafergraph/node`
- 使用 `Preact` 驱动页面层
- 在浏览器里挂起一张最小节点图
- 运行 `play / step / stop`
- 订阅并显示运行反馈

## 运行方式

在仓库根目录执行：

```bash
bun run dev:minimal-graph
```

构建：

```bash
bun run build:minimal-graph
```

预览：

```bash
bun run preview:minimal-graph
```

也可以直接进入当前目录执行：

```bash
bun run dev
bun run build
bun run preview
```

## 示例图结构

这个示例默认会恢复一条最小执行链：

1. `system/on-play`
2. `example/counter`
3. `example/watch`

其中：

- `system/on-play` 是主包内建入口节点
- `example/counter` 每次执行会把内部计数加一并向下游输出
- `example/watch` 会把最近一次收到的值显示在节点标题里

## 目录结构

- `index.html`
  - 页面入口
- `src/main.tsx`
  - 挂载 Preact 根组件与全局样式
- `src/app/App.tsx`
  - 页面壳层，组织控制面板与右侧画布卡片
- `src/components/`
  - 纯展示组件，当前拆为控制面板、运行日志和画布卡片
- `src/graph/use_example_graph.ts`
  - 图实例生命周期、节点注册、默认示例图恢复和运行反馈订阅
- `src/graph/example_nodes.ts`
  - `example/counter` 与 `example/watch` 的节点定义
- `src/graph/example_document.ts`
  - 空图工厂与最小执行链种子输入
- `src/graph/runtime_feedback_format.ts`
  - 运行反馈与运行值的短文本格式化
- `src/style.css`
  - 页面样式

## 页面驱动方式

页面现在由 `Preact` 驱动：

- `App.tsx` 只负责页面结构
- `useExampleGraph()` 负责 `LeaferGraph` 实例生命周期
- 日志、按钮和链路说明都通过组件 props 渲染，不再手工拼接 DOM

图生命周期目前固定收口在：

- `src/graph/use_example_graph.ts`

这个 hook 统一负责：

1. 创建图实例
2. 等待 `graph.ready`
3. 注册示例节点
4. 恢复默认最小执行链
5. 订阅运行反馈并投影到 UI
6. 在卸载或热更新时清理订阅与实例

## 边界

这个工程故意保持最小：

- 不接 authority
- 不接 bundle loader
- 不接 editor 壳层
- 只展示主包最小公开 API 的直连用法
