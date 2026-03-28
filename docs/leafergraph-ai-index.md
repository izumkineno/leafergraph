# leafergraph AI / 工程导航索引

生成时间: 2026-03-28

## 1. 索引目标

- 只为当前仓库里仍然存在的目录和文档提供导航入口。
- 优先回答下面这些问题：
  - `NodeDefinition`、`NodeModule`、`GraphDocument` 在哪
  - 类式节点 / Widget 作者层怎么写
  - 图运行时、交互、刷新链和执行反馈在哪
  - 模板工程从哪里开始看
- 历史上已经删除的目录不再作为当前索引入口。

## 2. 项目类型识别结果

| 识别结果 | 结论 | 依据 |
| --- | --- | --- |
| 主类型 | `workspace + graph runtime sdk + templates` | 根目录当前保留 `packages/`、`templates/`、`docs/` |
| 模型层 | `@leafergraph/node` | `packages/node` 提供节点定义、注册表与图文档模型 |
| 作者层 | `@leafergraph/authoring` | `packages/authoring` 提供类式作者体验与 plugin 组装 |
| 运行时层 | `leafergraph` | `packages/leafergraph` 提供图宿主、交互、执行与刷新链 |
| 模板层 | `authoring templates` | `templates/node`、`templates/widget`、`templates/misc` 提供外部接入模板 |

## 3. 仓库全景

### 3.1 根目录主要组成

- `packages/`
  - 正式包源码
- `templates/`
  - 可复制出去的模板工程
- `docs/`
  - 当前仍维护的设计文档

### 3.2 包级职责

| 包 | 角色 | 负责什么 | 不负责什么 |
| --- | --- | --- | --- |
| `@leafergraph/node` | 模型真源 | `NodeDefinition`、`NodeModule`、`NodeRegistry`、`GraphDocument`、序列化模型 | Leafer 宿主、页面壳层 |
| `@leafergraph/authoring` | 作者层 SDK | 节点类、Widget 类、plugin / module 组装 | 模型真源、图宿主、宿主专属装配协议 |
| `leafergraph` | 图运行时宿主 | Leafer 场景恢复、节点 / 连线 / Widget 渲染、交互与运行反馈 | 页面壳层、外部宿主协议 |

### 3.3 模板职责

| 路径 | 定位 | 适合查什么 |
| --- | --- | --- |
| `templates/node/authoring-node-template` | 节点作者模板 | 节点类、模块收口、`node.iife.js` 产物 |
| `templates/widget/authoring-text-widget-template` | Widget 作者模板 | 展示型 Widget、`widget.iife.js` 产物 |
| `templates/misc/authoring-browser-plugin-template` | 组合模板 | node / widget / demo 的 browser bundle 组合方式 |
| `templates/misc/backend-node-package-template` | 后端节点包模板 | 结构化前端 bundle 和后端节点包约定 |
| `templates/backend/` | 预留分类目录 | 当前没有活动中的模板 README |

## 4. 推荐阅读顺序

1. `README.md`
2. `packages/node/README.md`
3. `packages/authoring/README.md`
4. `packages/leafergraph/README.md`
5. `packages/leafergraph/使用与扩展指南.md`
6. `packages/leafergraph/内部架构地图.md`
7. `templates/README.md`
8. `docs/节点API方案.md`
9. `docs/节点插件接入方案.md`
10. `docs/开发者友好节点作者层与接入包方案.md`
11. `docs/连线路由.md`

## 5. 关键目录导航

| 路径 | 定位 | 适合查什么 |
| --- | --- | --- |
| `README.md` | workspace 总入口 | 当前目录、推荐阅读顺序、常用命令 |
| `packages/node/src/` | 模型层源码 | 图文档、节点定义、注册表、序列化 |
| `packages/authoring/src/` | 作者层源码 | 类式节点 / Widget 作者体验、plugin / module 组装 |
| `packages/leafergraph/src/graph/` | 图运行时 | 图场景、运行时数据与生命周期 |
| `packages/leafergraph/src/interaction/` | 交互层 | 选择、拖拽、连接、菜单基础设施 |
| `packages/leafergraph/src/link/` | 连线层 | link 渲染与路由 |
| `packages/leafergraph/src/node/` | 节点运行时 | 节点实例、布局、宿主逻辑 |
| `packages/leafergraph/src/widgets/` | Widget 宿主层 | widget 注册、渲染与交互 |
| `templates/` | 模板入口 | 外部节点 / Widget / browser bundle 模板 |
| `docs/` | 当前维护文档 | 节点 API、接入边界、作者层方案、连线路由 |

## 6. 常用命令

- `bun install`
- `bun run build:node`
- `bun run build:authoring`
- `bun run build:leafergraph`

## 7. 查询路由

| 如果你要问 | 先看哪里 |
| --- | --- |
| 节点定义、GraphDocument、NodeRegistry 在哪 | `packages/node/README.md`、`packages/node/src/` |
| 节点作者层和 Widget 作者层怎么写 | `packages/authoring/README.md`、`packages/authoring/src/` |
| 浏览器里怎么恢复一张图并运行 | `packages/leafergraph/README.md`、`packages/leafergraph/使用与扩展指南.md` |
| 图运行时、刷新链、交互宿主在哪 | `packages/leafergraph/内部架构地图.md`、`packages/leafergraph/src/` |
| 如何复制一个外部模板工程 | `templates/README.md` |
| 节点 API 边界和节点壳怎么拆 | `docs/节点API方案.md` |
| 外部节点怎样接进来 | `docs/节点插件接入方案.md` |
| 作者层长期边界怎么理解 | `docs/开发者友好节点作者层与接入包方案.md` |
| 连线绘制和路由怎么理解 | `docs/连线路由.md` |

## 8. 使用注意事项

- 当前索引只覆盖仓库里真实存在的目录和文档。
- 已删除目录对应的旧文档已经从导航中移除，避免把历史结构误写成现状。
- 如果设计文档和源码细节冲突，以当前源码和包 README 为准。
