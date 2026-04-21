# `@leafergraph/undo-redo`

`@leafergraph/undo-redo` 是 LeaferGraph workspace 的宿主状态扩展包。

它负责 undo / redo controller、历史栈裁剪和 graph history feed 绑定；它不会自动塞进 `createLeaferGraph(...)`，也不承担快捷键 runtime。

## 包定位

适合直接依赖它的场景：

- 你已经有 `LeaferGraph` 实例，想显式启用历史栈
- 你想通过 `graph.history` 控制最大历史条数和文档同步重置策略
- 你想把按钮、菜单或快捷键统一接到同一个 controller

不适合直接把它当成：

- 图运行时主包
- 持久化历史系统
- authority 合并层

## 公开入口

### 根入口

- `createUndoRedoController(...)`
- `UndoRedoEntry`
- `UndoRedoController`
- `UndoRedoControllerOptions`
- `UndoRedoControllerState`

### `./graph`

- `bindLeaferGraphUndoRedo(...)`
- `LeaferGraphUndoRedoHost`
- `BindLeaferGraphUndoRedoOptions`
- `BoundLeaferGraphUndoRedo`

## 最小使用方式

```ts
import { bindLeaferGraphUndoRedo } from "@leafergraph/undo-redo/graph";

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

这里的 `config` 真源来自 `@leafergraph/config` 的 `graph.history`；  
写了配置并不会自动启用历史栈，仍然需要显式绑定这个包。

## 与其它包的边界

| 包 | 关系 |
| --- | --- |
| `@leafergraph/config` | `graph.history` 配置真源 |
| `leafergraph` | 只负责发出 `subscribeHistory(...)` history feed |
| `@leafergraph/shortcuts` | 可选消费 history host，但不反向依赖 `undo-redo` |
| `@leafergraph/context-menu-builtins` | 可选消费 history host，但不承接历史栈本体 |

## 常用命令

在 workspace 根目录执行：

```bash
bun run build:undo-redo
bun run test:undo-redo
```

## 继续阅读

- [根 README](../../README.md)
- [@leafergraph/config README](../config/README.md)
- [@leafergraph/shortcuts README](../shortcuts/README.md)
- [mini-graph README](../../example/mini-graph/README.md)
