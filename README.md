# LeaferGraph Workspace

`leafergraph` 当前是一个精简后的 Leafer-first workspace，保留的正式内容主要集中在模型层、作者层、运行时主包和模板工程。

历史上围绕若干已删目录的设计稿已经不再是当前仓库入口，本文只保留和现状一致的导航。

## 当前目录

- `packages/node`
  - 节点定义、`NodeModule`、`NodeRegistry`、`GraphDocument` 等模型真源
- `packages/authoring`
  - 面向节点 / Widget 作者的类式 authoring SDK
- `packages/execution`
  - 纯执行内核，负责执行链、传播、图级运行状态机和执行反馈
- `packages/context-menu`
  - Leafer-first 右键菜单包，唯一正式触发源是 Leafer `pointer.menu`
- `packages/leafergraph`
  - Leafer-first 图运行时宿主、交互基础设施和宿主侧反馈投影
- `templates/`
  - 可复制出去的模板工程与模板分类入口
- `docs/`
  - 当前仍在维护的设计文档

## 推荐阅读顺序

1. [`packages/node/README.md`](./packages/node/README.md)
2. [`packages/authoring/README.md`](./packages/authoring/README.md)
3. [`packages/execution/README.md`](./packages/execution/README.md)
4. [`packages/context-menu/README.md`](./packages/context-menu/README.md)
5. [`packages/leafergraph/README.md`](./packages/leafergraph/README.md)
6. [`packages/leafergraph/使用与扩展指南.md`](./packages/leafergraph/使用与扩展指南.md)
7. [`packages/leafergraph/内部架构地图.md`](./packages/leafergraph/内部架构地图.md)
8. [`templates/README.md`](./templates/README.md)

如果你更关心当前仍在维护的设计文档，优先看：

- [`docs/节点API方案.md`](./docs/节点API方案.md)
- [`docs/节点插件接入方案.md`](./docs/节点插件接入方案.md)
- [`docs/开发者友好节点作者层与接入包方案.md`](./docs/开发者友好节点作者层与接入包方案.md)
- [`docs/连线路由.md`](./docs/连线路由.md)

## 常用命令

在仓库根目录执行：

```bash
bun install
bun run build:node
bun run build:execution
bun run build:authoring
bun run build:context-menu
bun run build:leafergraph
```

当前文档不再把聚合 `build`、`editor`、`sync`、`openrpc` 相关脚本写成推荐入口，因为这些目录与旧文档已经不再对应当前仓库结构。

## 模板入口

当前可直接阅读的模板说明有：

- [`templates/node/authoring-node-template/README.md`](./templates/node/authoring-node-template/README.md)
- [`templates/widget/authoring-text-widget-template/README.md`](./templates/widget/authoring-text-widget-template/README.md)
- [`templates/misc/authoring-browser-plugin-template/README.md`](./templates/misc/authoring-browser-plugin-template/README.md)
- [`templates/misc/backend-node-package-template/README.md`](./templates/misc/backend-node-package-template/README.md)

补充说明：

- `templates/backend/` 当前保留目录结构，但没有活动中的模板 README。
- 已删除目录对应的旧文档已经从当前入口移除，避免再把历史结构误写成现状。
