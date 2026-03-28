# leafergraph AI / 工程导航索引

生成时间: 2026-03-27

## 1. 索引目标与适用查询场景摘要

- 目标: 为 `leafergraph` 后续工程开发提供稳定的仓库导航入口，帮助快速判断模型层、作者层、运行时层、同步层和示例层分别在哪里。
- 适用查询:
  - `节点定义和 GraphDocument 在哪`
  - `怎么写节点作者层 / Widget 作者层`
  - `图运行时宿主和交互逻辑在哪`
  - `同步协议、OpenRPC、outlet、session 在哪`
  - `editor 壳层和 authority demo 在哪`
- 这是一份工程分层导航索引，重点是“先看哪里”和“每个目录负责什么”。

## 2. 项目类型识别结果与依据

| 识别结果 | 结论 | 依据 |
| --- | --- | --- |
| 主类型 | `workspace + graph runtime sdk + examples` | 根 `package.json` 使用 Bun workspaces，包含 `packages/*`、`examples/*`、`templates/*` |
| 核心形态 | `分层清晰的节点图工程` | README 明确拆分 `@leafergraph/node`、`@leafergraph/authoring`、`leafergraph`、`@leafergraph/sync` |
| UI 壳层 | `example editor` | `examples/editor` 使用 Preact 承担页面壳层、命令、session 与 authority 接线 |
| 协议真源 | `OpenRPC-first authority contract` | `openrpc/` 存放 authority 协议真源，并由 `LEAFERGRAPH_OPENRPC_ROOT` 指定 |

## 3. 仓库全景

- tracked files: `610`
- 根目录主要组成:
  - `packages/`: 正式包
  - `examples/`: 可运行示例
  - `templates/`: 可复制出去的模板工程
  - `openrpc/`: authority 协议真源
  - `docs/`: 架构蓝图与设计方案
  - `scripts/`: 构建与辅助脚本

### 3.1 包级职责

| 包 | 角色 | 负责什么 | 不负责什么 |
| --- | --- | --- | --- |
| `@leafergraph/node` | 模型真源 | `NodeDefinition`、`NodeModule`、`NodeRegistry`、`GraphDocument`、序列化模型 | 图渲染宿主、作者层体验、editor UI |
| `@leafergraph/authoring` | 作者层 SDK | 节点类、Widget 类、plugin/module 组装 | 模型真源、图宿主、editor bridge |
| `leafergraph` | 图运行时宿主 | Leafer 场景恢复、节点/连线/Widget 渲染、交互与运行反馈 | workspace 壳层、authority transport |
| `@leafergraph/sync` | 同步层 | `SyncSession`、`SyncOutlet`、OpenRPC 子出口、storage | 页面 UI、editor 壳层、多主协作 |

### 3.2 示例与模板职责

| 路径 | 定位 | 适合查什么 |
| --- | --- | --- |
| `examples/editor` | 编辑器壳层 | Preact UI、session、commands、bundle 装载、authority 接线 |
| `examples/minimal-graph` | 最小图示例 | 只用主包恢复一张图的最小路径 |
| `examples/tauri-backend-demo` | 前端 + Tauri Rust authority 演示 | `@leafergraph/sync` 和 Rust authority 的接线方式 |
| `templates/backend/` | 后端模板 | Python OpenRPC authority 模板 |
| `templates/node/` | 节点作者模板 | 外部节点包模板 |
| `templates/widget/` | Widget 模板 | 外部 widget 作者模板 |
| `templates/misc/` | 其他模板 | 浏览器插件、后端节点包等模板 |

## 4. 推荐阅读顺序

1. `README.md`
2. `packages/node/README.md`
3. `packages/authoring/README.md`
4. `packages/leafergraph/README.md`
5. `packages/sync/README.md`
6. `examples/editor/README.md`
7. `examples/tauri-backend-demo/README.md`
8. `templates/README.md`
9. `docs/*.md`

如果你要理解编辑器壳层，继续按 `examples/editor/README.md` 里给出的阅读顺序往下走。  
如果你要理解 authority 协议，优先看 `openrpc/`，再看 `@leafergraph/sync/openrpc`。

## 5. 关键目录导航

| 路径 | 定位 | 适合查什么 |
| --- | --- | --- |
| `README.md` | workspace 总入口 | 包分层、示例、模板、常用命令 |
| `packages/node/src/` | 模型层源码 | graph 文档、节点定义、注册表、link、widget 模型 |
| `packages/authoring/src/` | 作者层源码 | 类式节点/Widget 作者体验、plugin/module 组装 |
| `packages/leafergraph/src/api/` | 主包 API | 面向宿主的公开 API |
| `packages/leafergraph/src/graph/` | 图运行时 | 图场景、运行时数据与生命周期 |
| `packages/leafergraph/src/interaction/` | 交互层 | 选择、拖拽、连接、视口交互 |
| `packages/leafergraph/src/link/` | 连线层 | link 渲染与路由 |
| `packages/leafergraph/src/node/` | 节点运行时 | 节点实例与宿主逻辑 |
| `packages/leafergraph/src/widgets/` | Widget 宿主层 | widget 注册、渲染与交互 |
| `packages/sync/src/core/` | 同步根合同 | `DocumentSnapshot`、`DocumentPatch` 等核心类型 |
| `packages/sync/src/session/` | session 层 | `createSyncSession(...)` 与状态机 |
| `packages/sync/src/outlet/` | outlet 层 | 协议抽象边界 |
| `packages/sync/src/openrpc/` | OpenRPC 子出口 | authority OpenRPC 接线 |
| `packages/sync/src/storage/` | 浏览器存储层 | 恢复缓存与持久化 |
| `examples/editor/src/` | 编辑器壳层源码 | app、commands、runtime、session、shell、ui |
| `examples/tauri-backend-demo/src/graph/` | 图侧 demo 逻辑 | 最小图、交互提交、反馈格式化 |
| `examples/tauri-backend-demo/src-tauri/src/authority/` | Rust authority 真相 | 同步命令、执行推进、持久化 |
| `openrpc/` | authority 合同真源 | method、schema、conformance |
| `docs/` | 方案文档 | 架构蓝图、功能计划、节点 API 方案 |

## 6. 常用命令

- `bun install`
- `bun run dev:editor`
- `bun run dev:editor:lan`
- `bun run dev:minimal-graph`
- `bun run build:authoring`
- `bun run build:leafergraph`
- `bun run build:sync`
- `bun run build`
- `bun run test:authoring`
- `bun run test:sync`
- `bun run test:editor`
- `bun run test:authority-conformance`
- `bun run start:python-openrpc-backend`

## 7. 查询路由

| 如果你要问 | 先看哪里 |
| --- | --- |
| 节点定义、GraphDocument、NodeRegistry 在哪 | `packages/node/README.md`、`packages/node/src/` |
| 节点作者层和 Widget 作者层怎么写 | `packages/authoring/README.md`、`packages/authoring/src/` |
| 浏览器里怎么恢复一张图并运行 | `packages/leafergraph/README.md`、`packages/leafergraph/src/` |
| selection / connect / viewport / play / step / stop 在哪 | `packages/leafergraph/src/interaction/`、`packages/leafergraph/src/graph/` |
| editor 页面壳层、命令系统、session 在哪 | `examples/editor/README.md`、`examples/editor/src/` |
| authority 协议与 OpenRPC 真源在哪 | `openrpc/`、`packages/sync/src/openrpc/` |
| SyncSession、SyncOutlet、storage 在哪 | `packages/sync/README.md`、`packages/sync/src/` |
| 如何接一个 Rust authority demo | `examples/tauri-backend-demo/README.md` |
| 如何复制一个外部模板工程 | `templates/README.md` |

## 8. 使用注意事项

- `examples/editor` 是 UI 壳层，不是模型和运行时真源。
- `@leafergraph/node` 才是正式模型真源，涉及 `GraphDocument` 或节点定义时先回这里。
- `@leafergraph/authoring` 是作者体验层，不应承担 editor 兼容和 authority transport。
- `leafergraph` 主包是图运行时宿主，不应把页面壳层职责塞进去。
- `@leafergraph/sync` 当前叙事固定为 `authority-first + resync-only`，不要默认它已经是通用协同框架。
- `openrpc/` 是 authority 合同真源；如果协议说明和示例代码冲突，以这里为准。
- `docs/*.md` 很适合建立设计心智模型，但遇到实现细节仍需回源码确认。
