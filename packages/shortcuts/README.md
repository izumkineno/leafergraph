# `@leafergraph/shortcuts`

`@leafergraph/shortcuts` 是 LeaferGraph workspace 的宿主输入扩展包。

它采用“功能注册表 + 按键注册表”的两层模型，把快捷键 runtime 和 graph 预设从主包里拆出来。它已经进入默认 build/test 聚合，但文档定位仍是“非核心维护包 / 宿主输入扩展层”。

## 包定位

适合直接依赖它的场景：

- 你想把 chord 匹配、功能定义和按键映射分开维护
- 你想为 `leafergraph` 宿主复用默认 graph 快捷键预设
- 你想把真实已注册的快捷键标签同步给按钮或右键菜单

不适合直接把它当成：

- undo / redo 历史栈本体
- clipboard store 真源
- 命令总线或用户级 keymap 持久化层

## 公开入口

### 根入口

- `createShortcutFunctionRegistry(...)`
- `createShortcutKeymapRegistry(...)`
- `createShortcutController(...)`
- `normalizeShortcutChord(...)`
- `matchShortcutEvent(...)`
- `formatShortcutLabel(...)`

### `./graph`

- `registerLeaferGraphShortcutFunctions(...)`
- `registerLeaferGraphShortcutKeymap(...)`
- `bindLeaferGraphShortcuts(...)`
- `LeaferGraphShortcutHost`
- `LeaferGraphShortcutHistoryHost`
- `LeaferGraphShortcutClipboardHost`

## 最小使用方式

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
dispose();
```

如果你在 `leafergraph` 宿主里直接接 graph 预设：

```ts
import { bindLeaferGraphShortcuts } from "@leafergraph/shortcuts/graph";

const binding = bindLeaferGraphShortcuts({
  target: document,
  scopeElement: graphContainer,
  host: {
    listNodeIds: () => nodeIds,
    listSelectedNodeIds: () => graph.listSelectedNodeIds(),
    setSelectedNodeIds: (nodeIds) => graph.setSelectedNodeIds(nodeIds),
    clearSelectedNodes: () => graph.clearSelectedNodes(),
    removeNode: (nodeId) => graph.removeNode(nodeId),
    fitView: () => graph.fitView(),
    play: () => graph.play(),
    step: () => graph.step(),
    stop: () => graph.stop(),
    isContextMenuOpen: () => menu.isOpen()
  }
});
```

## 默认 graph 绑定

默认会注册这几类快捷键：

- 编辑组
  - `Mod+C`、`Mod+X`、`Mod+V`、`Mod+D`
  - `Mod+A`
  - `Escape`
  - `Delete / Backspace`
- 历史组
  - `Mod+Z`
  - `Mod+Shift+Z`
  - `Mod+Y`
- 视图 / 执行组
  - `KeyF`
  - `Mod+Enter`
  - `Mod+Shift+Enter`
  - `Mod+Period`

其中执行组和历史 / 剪贴板接线，都仍然是显式启用和显式传入 host 的设计。

## 与其它包的边界

| 包 | 关系 |
| --- | --- |
| `@leafergraph/shortcuts` | 快捷键 runtime 与 graph 预设 |
| `@leafergraph/context-menu-builtins` | 可消费快捷键标签，但不会反向依赖这个包 |
| `@leafergraph/undo-redo` | 历史栈真源；`shortcuts` 只可选消费 history host |
| `leafergraph` | 图运行时 façade；`shortcuts` 通过结构兼容对接它 |

## 常用命令

在 workspace 根目录执行：

```bash
bun run build:shortcuts
bun run test:shortcuts
```

## 继续阅读

- [根 README](../../README.md)
- [@leafergraph/undo-redo README](../undo-redo/README.md)
- [@leafergraph/context-menu-builtins README](../context-menu-builtins/README.md)
- [mini-graph README](../../example/mini-graph/README.md)
