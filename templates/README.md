# Templates 总览

`templates/` 只放可复制出去的模板工程与分类入口，不承载 workspace 核心源码。

## 当前目录结构

```text
templates/
  backend/
  node/
    authoring-node-template/
    README.md
  widget/
    authoring-text-widget-template/
    README.md
  misc/
    authoring-browser-plugin-template/
    backend-node-package-template/
```

## 当前模板矩阵

| 路径 | 主要用途 | 典型产物 |
| --- | --- | --- |
| `templates/node/authoring-node-template` | 纯节点作者模板 | `module`、`plugin`、`dist/browser/node.iife.js` |
| `templates/widget/authoring-text-widget-template` | 纯 Widget 作者模板 | `widget entry`、`plugin`、`dist/browser/widget.iife.js` |
| `templates/misc/authoring-browser-plugin-template` | node / widget / demo 组合模板 | `dist/browser/widget.iife.js`、`node.iife.js`、`demo.iife.js` |
| `templates/misc/backend-node-package-template` | 后端节点包模板 | package manifest 与结构化前端 bundle 约定 |

## 分类边界

### `backend/`

- 当前保留为模板分类目录。
- 目前没有活动中的模板 README。

### `node/`

- 放纯节点作者模板。
- 当前默认入口是 `authoring-node-template`。

### `widget/`

- 放纯 Widget 作者模板。
- 当前默认入口是 `authoring-text-widget-template`。

### `misc/`

- 放不属于“纯节点模板 / 纯 Widget 模板”的混合型模板。
- 当前包括：
  - authoring 浏览器组合模板
  - 后端驱动节点包模板

## 推荐阅读

- [`node/README.md`](./node/README.md)
- [`widget/README.md`](./widget/README.md)
- [`misc/authoring-browser-plugin-template/README.md`](./misc/authoring-browser-plugin-template/README.md)
- [`misc/backend-node-package-template/README.md`](./misc/backend-node-package-template/README.md)

## 说明

- 当前模板入口只覆盖仓库里真实存在的模板。
- 已删除模板对应的旧说明已经从这里移除，避免继续把历史目录写成现状。
