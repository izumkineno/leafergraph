# `@leafergraph/undo-redo`

`@leafergraph/undo-redo` 是 LeaferGraph workspace 的宿主状态扩展包。

它负责这些内容：

- undo / redo controller
- 历史栈裁剪、redo 失效和状态订阅
- `leafergraph` history feed 到可回放 entry 的 graph 绑定 helper

它不负责这些内容：

- 主包 runtime 核心装配
- 跨会话持久化
- authority 合并或远端历史同步
- 快捷键 runtime 本体

这个包和 `@leafergraph/shortcuts` 一样，按“非核心维护包 / 宿主状态扩展层”管理，但已经进入 root 默认 `build` 和 `test:core` 聚合。

## 适用场景

- 你已经有 `LeaferGraph` 实例，想显式启用 undo / redo
- 你希望通过 `graph.history` 控制最大历史条数和文档同步重置策略
- 你想把按钮、菜单或快捷键接到统一的历史 controller

不适合这些场景：

- 你需要完整的跨会话历史持久化
- 你想把 undo / redo 自动塞回 `createLeaferGraph(...)`
- 你要把快捷键和历史栈合成一个包

## 快速开始

```ts
import { createLeaferGraph } from "leafergraph";
import { bindLeaferGraphUndoRedo } from "@leafergraph/undo-redo/graph";

const graph = createLeaferGraph(container, {
  config: {
    graph: {
      history: {
        maxEntries: 100,
        resetOnDocumentSync: true
      }
    }
  }
});

await graph.ready;

const history = bindLeaferGraphUndoRedo({
  host: graph,
  config: {
    maxEntries: 100,
    resetOnDocumentSync: true
  }
});

const unsubscribe = history.controller.subscribeState((state) => {
  console.log(state.canUndo, state.nextUndoLabel);
});

history.controller.undo();
history.controller.redo();

unsubscribe();
history.destroy();
```

## 公开入口

- 根入口
  - `createUndoRedoController(...)`
  - `UndoRedoEntry`
  - `UndoRedoController`
  - `UndoRedoControllerOptions`
  - `UndoRedoControllerState`
- `./graph`
  - `bindLeaferGraphUndoRedo(...)`
  - `LeaferGraphUndoRedoHost`
  - `BindLeaferGraphUndoRedoOptions`
  - `BoundLeaferGraphUndoRedo`

## 与其它包的边界

- `@leafergraph/config`
  - `graph.history` 是历史配置真源
- `leafergraph`
  - 只负责发出 `subscribeHistory(...)` history feed，不自动创建 controller
- `@leafergraph/shortcuts`
  - 可以可选消费 history host，但不反向依赖 `@leafergraph/undo-redo`

## 常用命令

```bash
bun run build:undo-redo
bun run test:undo-redo
```
