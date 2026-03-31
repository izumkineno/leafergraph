# `@leafergraph/shortcuts`

`@leafergraph/shortcuts` 是 `leafergraph` workspace 里的宿主输入扩展包。

它负责这些内容：

- 快捷键 chord 归一化与匹配
- 功能注册表与按键注册表
- `keydown -> guard -> binding -> function` 的最小 controller
- `leafergraph` 节点图默认快捷键预设与快捷键标签解析

它不负责这些内容：

- `leafergraph` 主包 runtime 核心装配
- undo / redo 历史栈本体、clipboard store 真源、持久化历史
- 命令总线或用户级 keymap 持久化

这个包已经进入 root 默认 `build` 和 `test:core`，但文档定位仍固定为“非核心维护包 / 宿主输入扩展层”。

## 适用场景

- 你想在宿主里注册一组独立快捷键功能
- 你希望键位和功能分开维护
- 你正在接入 `leafergraph`，想直接复用默认 graph 快捷键预设

不适合这些场景：

- 你需要完整 undo / redo
- 你要做多段 chord、录制模式或系统级全局快捷键
- 你想把快捷键能力重新塞回 `leafergraph` 主包内部

## 快速开始

### 根入口

```ts
import {
  createShortcutController,
  createShortcutFunctionRegistry,
  createShortcutKeymapRegistry
} from "@leafergraph/shortcuts";

const functionRegistry = createShortcutFunctionRegistry();
const keymapRegistry = createShortcutKeymapRegistry();

functionRegistry.register({
  id: "demo.fit-view",
  run() {
    console.log("fit view");
  }
});

keymapRegistry.register({
  id: "demo.fit-view",
  functionId: "demo.fit-view",
  shortcut: "KeyF"
});

const controller = createShortcutController({
  functionRegistry,
  keymapRegistry
});

const dispose = controller.bind(document);
```

### `./graph`

```ts
import { bindLeaferGraphShortcuts } from "@leafergraph/shortcuts/graph";
import { bindLeaferGraphUndoRedo } from "@leafergraph/undo-redo/graph";
import { createLeaferGraphContextMenuClipboardStore } from "@leafergraph/context-menu-builtins";

const historyBinding = bindLeaferGraphUndoRedo({
  host: graph,
  config: {
    maxEntries: 100
  }
});
const clipboard = createLeaferGraphContextMenuClipboardStore();

const binding = bindLeaferGraphShortcuts({
  target: document,
  scopeElement: graphContainer,
  host: {
    listNodeIds: () => graphNodeIds,
    listSelectedNodeIds: () => graph.listSelectedNodeIds(),
    setSelectedNodeIds: (nodeIds) => graph.setSelectedNodeIds(nodeIds),
    clearSelectedNodes: () => graph.clearSelectedNodes(),
    removeNode: (nodeId) => {
      graph.removeNode(nodeId);
    },
    fitView: () => {
      graph.fitView();
    },
    play: () => {
      graph.play();
    },
    step: () => {
      graph.step();
    },
    stop: () => {
      graph.stop();
    },
    isContextMenuOpen: () => menu.isOpen()
  },
  history: {
    undo: () => historyBinding.controller.undo(),
    redo: () => historyBinding.controller.redo(),
    canUndo: () => historyBinding.controller.getState().canUndo,
    canRedo: () => historyBinding.controller.getState().canRedo
  },
  clipboard: {
    copySelection: () => copySelectionInto(clipboard),
    cutSelection: () => cutSelectionInto(clipboard),
    pasteClipboard: () => pasteFromClipboard(clipboard),
    duplicateSelection: () => duplicateSelection()
  }
});

binding.destroy();
historyBinding.destroy();
```

## 公开入口

- 根入口
  - `createShortcutFunctionRegistry(...)`
  - `createShortcutKeymapRegistry(...)`
  - `createShortcutController(...)`
  - `normalizeShortcutChord(...)`
  - `matchShortcutEvent(...)`
  - `formatShortcutLabel(...)`
- `./graph`
  - `registerLeaferGraphShortcutFunctions(...)`
  - `registerLeaferGraphShortcutKeymap(...)`
  - `bindLeaferGraphShortcuts(...)`
  - `LeaferGraphShortcutFunctionId`
  - `LeaferGraphShortcutClipboardHost`
  - `LeaferGraphShortcutHistoryHost`
  - `LeaferGraphShortcutHost`

## 默认 graph 绑定

- 编辑组
  - `Mod+C` -> `graph.copy`
  - `Mod+X` -> `graph.cut`
  - `Mod+V` -> `graph.paste`
  - `Mod+D` -> `graph.duplicate`
  - `Mod+A` -> `graph.select-all`
  - `Escape` -> `graph.clear-selection`
  - `Delete / Backspace` -> `graph.delete-selection`
- 历史组
  - `Mod+Z` -> `graph.undo`
  - macOS: `Mod+Shift+Z` -> `graph.redo`
  - Windows / Linux: `Mod+Y` -> `graph.redo`
- 视图与执行
  - `KeyF` -> `graph.fit-view`
  - `Mod+Enter` / `Mod+Shift+Enter` / `Mod+Period` 仍然只在显式启用 execution 组后注册

`bindLeaferGraphShortcuts(...)` 返回的 binding 还会暴露 `resolveShortcutLabel(...)` 和 `listShortcutLabels(...)`，适合把真实 keymap 文案同步到右键菜单或按钮提示里。

## 与其它包的边界

- `@leafergraph/shortcuts`
  - 不依赖任何 workspace 包，只提供输入层 runtime 和 graph 预设
- `leafergraph`
  - 仍然是图 runtime façade 真源
- `@leafergraph/context-menu`
  - 负责菜单 runtime，不负责快捷键
- `@leafergraph/context-menu-builtins`
  - 可以消费 `resolveShortcutLabel(...)` 来显示右键菜单快捷键，但不会反向依赖 `shortcuts`
- 后续 undo/redo 包
  - 由 `@leafergraph/undo-redo` 承担历史栈与回放；`shortcuts` 只可选消费它暴露的 history host

## 常用命令

```bash
bun run build:shortcuts
bun run test:shortcuts
```
