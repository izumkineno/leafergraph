# `@leafergraph/extensions/context-menu-builtins`

`@leafergraph/extensions/context-menu-builtins` 是 `leafergraph` 节点图菜单内建动作的集成包。

它通过显式 `host` 适配对象，把复制、粘贴、删除、运行、历史和快捷键文案接到 `@leafergraph/extensions/context-menu`，但不反向依赖 `leafergraph` 主包。

## 包定位

适合直接依赖它的场景：

- 你已经在使用 `@leafergraph/extensions/context-menu`
- 你希望把节点图常见菜单动作一次性接上
- 你希望菜单里的快捷键文案来自真实已注册 keymap

不适合直接把它当成：

- 纯菜单 runtime
- 图运行时主包
- 公共协议真源

## 公开入口

- `registerLeaferGraphContextMenuBuiltins(...)`
- `createLeaferGraphContextMenuClipboardStore()`
- `getSharedLeaferGraphContextMenuClipboardStore()`
- `LeaferGraphContextMenuBuiltinsHost`
- `LeaferGraphContextMenuBuiltinOptions`
- `LeaferGraphContextMenuBuiltinFeatureFlags`
- `LeaferGraphContextMenuClipboardFragment`
- `LeaferGraphContextMenuClipboardState`

## 最小使用方式

```ts
import { createLeaferContextMenu } from "@leafergraph/extensions/context-menu";
import {
  createLeaferGraphContextMenuClipboardStore,
  registerLeaferGraphContextMenuBuiltins
} from "@leafergraph/extensions/context-menu-builtins";

const menu = createLeaferContextMenu({
  app: graph.app,
  container
});

const clipboard = createLeaferGraphContextMenuClipboardStore();

const disposeBuiltins = registerLeaferGraphContextMenuBuiltins(menu, {
  host: {
    listNodes: () => graph.listNodes(),
    listNodeIds: () => currentNodeIds,
    getNodeSnapshot: (nodeId) => graph.getNodeSnapshot(nodeId),
    findLinksByNode: (nodeId) => graph.findLinksByNode(nodeId),
    isNodeSelected: (nodeId) => graph.isNodeSelected(nodeId),
    listSelectedNodeIds: () => graph.listSelectedNodeIds(),
    setSelectedNodeIds: (nodeIds, mode) => graph.setSelectedNodeIds(nodeIds, mode),
    createNode: (input) => graph.createNode(input),
    createLink: (input) => graph.createLink(input),
    play: () => graph.play(),
    step: () => graph.step(),
    stop: () => graph.stop(),
    fitView: () => graph.fitView(),
    playFromNode: (nodeId) => graph.playFromNode(nodeId),
    removeNode: (nodeId) => graph.removeNode(nodeId),
    removeLink: (linkId) => graph.removeLink(linkId)
  },
  clipboard
});
```

## 与其它包的边界

| 包 | 关系 |
| --- | --- |
| `@leafergraph/extensions/context-menu` | 菜单 runtime |
| `@leafergraph/extensions/context-menu-builtins` | 节点图 builtins 集成层 |
| `@leafergraph/core/contracts` | 创建节点、创建连线、选区更新等共享类型真源 |
| `@leafergraph/core/node` | 节点快照和连线模型真源 |
| `@leafergraph/extensions/shortcuts` | 可选提供快捷键文案，但不会反向依赖 builtins |
| `@leafergraph/extensions/undo-redo` | 可选提供 history host，但不会并进这个包 |

## 常用命令

在 workspace 根目录执行：

```bash
bun run build:context-menu-builtins
bun run test:context-menu-builtins
```

## 继续阅读

- [根 README](../../README.md)
- [@leafergraph/extensions/context-menu README](../context-menu/README.md)
- [@leafergraph/extensions/shortcuts README](../shortcuts/README.md)
- [mini-graph README](../../example/mini-graph/README.md)



