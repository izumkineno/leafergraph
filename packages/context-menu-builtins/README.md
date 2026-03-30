# `@leafergraph/context-menu-builtins`

`@leafergraph/context-menu-builtins` 是 `leafergraph` 节点图菜单内建动作的集成包。

它负责这些内容：

- 画布控制、添加节点、粘贴
- 节点从此处运行、复制、删除
- 连线删除
- 内建剪贴板与默认批量删除回退逻辑

它不负责这些内容：

- Leafer 右键菜单 runtime
- DOM 菜单渲染
- `LeaferGraph` 主包 facade
- 公共协议真源

## 适用场景

- 你已经在用 `@leafergraph/context-menu`
- 你希望把 `leafergraph` 节点图常用右键动作一次性接上
- 你希望通过显式 `host` 适配对象接入复制、删除、粘贴和运行能力

不适合这些场景：

- 只想要纯菜单 runtime
- 想做和节点图无关的自定义菜单
- 想把 builtins 继续挂回 `@leafergraph/context-menu` 根入口

## 快速开始

```ts
import { createLeaferContextMenu } from "@leafergraph/context-menu";
import {
  registerLeaferGraphContextMenuBuiltins,
  type LeaferGraphContextMenuBuiltinsHost
} from "@leafergraph/context-menu-builtins";

const menu = createLeaferContextMenu({
  app: graph.app,
  container
});

const host: LeaferGraphContextMenuBuiltinsHost = {
  listNodes: () => graph.listNodes(),
  getNodeSnapshot: (nodeId) => graph.getNodeSnapshot(nodeId),
  findLinksByNode: (nodeId) => graph.findLinksByNode(nodeId),
  isNodeSelected: (nodeId) => graph.isNodeSelected(nodeId),
  listSelectedNodeIds: () => graph.listSelectedNodeIds(),
  setSelectedNodeIds: (nodeIds, mode) => graph.setSelectedNodeIds(nodeIds, mode),
  createNode: (input, _context) => graph.createNode(input),
  createLink: (input, _context) => graph.createLink(input),
  play: (_context) => {
    graph.play();
  },
  step: (_context) => {
    graph.step();
  },
  stop: (_context) => {
    graph.stop();
  },
  fitView: (_context) => {
    graph.fitView();
  },
  playFromNode: (nodeId, _context) => {
    graph.playFromNode(nodeId, { source: "context-menu" });
  },
  removeNode: (nodeId, _context) => {
    graph.removeNode(nodeId);
  },
  removeLink: (linkId, _context) => {
    graph.removeLink(linkId);
  }
};

const disposeBuiltins = registerLeaferGraphContextMenuBuiltins(menu, {
  host,
  features: {
    canvasAddNode: true,
    canvasPaste: true,
    canvasControls: true,
    nodeRunFromHere: true,
    nodeCopy: true,
    nodeDelete: true,
    linkDelete: true
  }
});
```

如果宿主有批量删除日志或清理链路，推荐额外实现可选的 `removeNodes(...)`。

## 公开入口

- `registerLeaferGraphContextMenuBuiltins(menu, options)`
- `LeaferGraphContextMenuBuiltinsHost`
- `LeaferGraphContextMenuBuiltinOptions`
- `LeaferGraphContextMenuBuiltinFeatureFlags`
- `LeaferGraphContextMenuClipboardFragment`
- `LeaferGraphContextMenuClipboardState`

## 与其它包的边界

- `@leafergraph/context-menu`
  - 纯 Leafer 菜单 runtime
- `@leafergraph/context-menu-builtins`
  - `leafergraph` 节点图菜单动作集成层
- `@leafergraph/contracts`
  - 节点创建、连线创建和选区更新等公共输入类型真源
- `leafergraph`
  - 具体 graph 宿主；通常由调用方把它包成 `host` 适配对象

## 常用命令

```bash
bun run build:context-menu-builtins
bun run test:context-menu-builtins
```
