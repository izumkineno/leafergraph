# Browser Node Widget Plugin Template

这份模板用于产出浏览器侧 node/widget/demo 插件，并同时支持：

- ESM 包接入
- browser IIFE bundle 接入

## 目录结构

```text
templates/misc/browser-node-widget-plugin-template/
  package.json
  tsconfig.json
  tsconfig.build.json
  vite.config.ts
  vite.browser.config.ts
  scripts/
    prepare_dist.mjs
  src/
    index.ts
    core/
      shared.ts
      module.ts
      nodes/
      widgets/
    presets/
      demo_document.ts
    browser/
      register_bundle.ts
      demo_bundle.ts
      demo_alt_bundle.ts
      node_bundle.ts
      widget_bundle.ts
```

## 角色边界

### 需要改

- 插件包名、命名空间、节点定义、Widget 定义。
- demo 文档内容。
- browser bundle 对外暴露内容。

### 不要改

- `LeaferGraphEditorBundleBridge.registerBundle(...)` 注册契约。
- bundle manifest 的 `kind/id/requires` 基本语义。
- `demo/node/widget` 三类分包职责边界。

## 命令

在模板目录执行：

```bash
bun install
bun run check
bun run build
```

`build` 会产出：

- ESM：`dist/index.js` + `dist/*.d.ts`
- browser：`dist/browser/demo.iife.js`、`demo-alt.iife.js`、`node.iife.js`、`widget.iife.js`

## 联调

editor 可通过本地文件选择器加载 `dist/browser/*.iife.js`。

推荐顺序：

1. `widget.iife.js`
2. `node.iife.js`
3. `demo.iife.js`
4. `demo-alt.iife.js`
