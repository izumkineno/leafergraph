# Node + Widget 外部插件模板

这个模板现在同时覆盖两条接入路线：

- ESM 包接入
  - 适合其它工程直接 `import "@template/node-widget-demo"`
- browser IIFE 接入
  - 适合当前 `packages/editor` 通过本地文件选择器读取 `dist/browser/*.iife.js`

模板目标不是参与 workspace 的长期源码联动，而是作为“外部节点包 / widget 包参考实现”存在。你可以直接复制整个目录到仓库外，再替换包名、命名空间和节点定义。

## 目录说明

```text
templates/node-widget-plugin-template/
  package.json
  tsconfig.json
  tsconfig.build.json
  vite.config.ts
  vite.browser.config.ts
  scripts/
    prepare_dist.mjs
  src/
    index.ts
    module.ts
    demo-graph.ts
    shared.ts
    browser/
      register_bundle.ts
      demo_bundle.ts
      node_bundle.ts
      widget_bundle.ts
    nodes/
      index.ts
      category_node.ts
      basic_widgets_node.ts
      external_status_node.ts
    widgets/
      index.ts
      external_status_widget.ts
```

## 这份模板演示了什么

### 1. 一个外部包如何同时交付节点和 widget

- 节点通过 `NodeModule` 统一声明
- widget 通过 `LeaferGraphWidgetEntry` 单次注册
- 正式插件安装顺序固定为：
  - 先 `registerWidget(...)`
  - 再 `installModule(...)`

### 2. 一个模板如何同时输出 ESM 包和 browser bundle

- `vite.config.ts`
  - 负责正常 ESM 构建
- `vite.browser.config.ts`
  - 负责 browser IIFE 构建
- `scripts/prepare_dist.mjs`
  - 在构建前确保 `dist/browser/` 一定是目录，而不是历史遗留单文件

### 3. browser bundle 如何拆分成 demo / node / widget 三类

- `demo.iife.js`
  - 只注册演示图数据
  - 显式声明依赖 `node + widget`
- `node.iife.js`
  - 只安装可独立成立的节点模块
  - 不包含依赖外部 widget 的节点
- `widget.iife.js`
  - 先注册外部 widget
  - 再安装消费该 widget 的伴生节点
  - 保证只加载 widget 槽位时 editor 也能看到结果

## 构建命令

```bash
bun install
bun run build
```

`build` 会串联两条产物线：

1. `bun run build:esm`
   - 生成 `dist/*.d.ts`
   - 生成 `dist/index.js`
2. `bun run build:browser`
   - 生成 `dist/browser/demo.iife.js`
   - 生成 `dist/browser/node.iife.js`
   - 生成 `dist/browser/widget.iife.js`

## 在当前 editor 里联调

当前 editor 不再直接源码 import 模板，而是通过本地文件加载：

1. 在本模板目录执行 `bun run build`
2. 打开 `packages/editor`
3. 在页面顶部的本地 bundle 面板里按顺序选择：
   - `dist/browser/widget.iife.js`
   - `dist/browser/node.iife.js`
   - `dist/browser/demo.iife.js`
4. editor 会通过 `LeaferGraphEditorBundleBridge.registerBundle(...)` 读取 manifest

推荐按上面的顺序加载，因为 demo 图里的部分节点依赖 node 和 widget 都已经就绪。

## 宿主侧 ESM 接入示例

```ts
import { createLeaferGraph } from "leafergraph";
import templatePlugin, {
  templateDemoGraph
} from "@template/node-widget-demo";

const graph = createLeaferGraph(container, {
  plugins: [templatePlugin],
  graph: templateDemoGraph
});
```

## 使用建议

- 如果你只需要“纯节点包”，可以删掉 `src/widgets/`
- 如果你只需要“纯 widget 包”，可以删掉 `src/nodes/` 和节点模块
- 如果你只想保留 browser 方案，可以继续输出 `dist/browser/*.iife.js`
- 如果你要做真正的 npm 发布，请去掉 `package.json` 里的 `"private": true`
