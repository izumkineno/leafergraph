# AGENTS.md

本文件适用于整个 LeaferGraph workspace。保持短小、可执行；优先链接已有文档，不复制长篇架构说明。

## 先读哪里

- 读 [README.md](README.md) 获取当前包分层、命令面和阅读导航。
- 读 [docs/leafergraph-ai-index.md](docs/leafergraph-ai-index.md) 快速路由到包、示例、模板或专题文档。
- 改坐标、右键菜单、连线动画或文档导航前，先读 [注意事项.md](注意事项.md)。
- 旧提案和当前源码冲突时，以当前源码、根 README、包 README 和事实型 docs 为准。

## 命令与进程

- 在 workspace 根目录使用 Bun；仓库声明 `packageManager: bun@1.2.21`。
- 常用聚焦验证：`bun run build:leafergraph`、`bun run test:leafergraph`、`bun run build:node`、`bun run test:execution`。
- 边界验证：`bun run check:boundaries`、`bun run test:workspace-boundaries`。
- 完整验证：`bun run test`，会覆盖边界、JSDoc、核心包、示例和模板，耗时更长。
- 示例冒烟：`bun run test:smoke:examples`；模板冒烟：`bun run test:smoke:templates`。
- 会长期运行、监听端口或影响联调环境的进程，应放在用户可见且可接管的 PowerShell、Windows Terminal 或 cmd 窗口中；短生命周期只读查询可以直接在当前代理 shell 执行。
- Python 相关命令默认使用 `uv`，例如 `uv run python ...`、`uv run pytest ...`、`uv pip ...`、`uv sync`。只有用户明确要求或现存脚本无法使用 `uv` 时，才说明原因后改用其他入口。

## 架构边界

- 这是 Leafer-first 的节点图 runtime，不是历史 `litegraph.js` 的兼容搬运。除非任务明确要求，不要主动增加旧 API、旧序列化、全局变量桥接、CommonJS 兼容出口或历史目录结构负担。
- `leafergraph` 是 viewer-first root。稳定根入口是 `LeaferGraph` / `createLeaferGraph(...)`；完整 runtime/editor 责任已经拆到 extracted packages。
- `@leafergraph/scene-runtime` 负责 scene、interaction、node shell、link visuals、theme runtime 和 runtime-feedback 投影。
- `@leafergraph/api-host` 负责 full API host、facade groups、history、registry、document/mutation/execution integration，以及 `leafergraph/api/graph_api_host` 兼容面。
- `@leafergraph/core/node` 是模型真源：`GraphDocument`、`NodeDefinition`、`NodeModule`、registry 等。
- `@leafergraph/core/execution` 是执行真源：执行上下文、传播语义、运行状态、执行反馈。
- `@leafergraph/core/contracts` 是宿主契约层：图 API 输入输出、Widget 契约、diff/history helper、`RuntimeFeedbackEvent`。
- `@leafergraph/core/theme`、`@leafergraph/core/config`、`@leafergraph/core/widget-runtime`、`@leafergraph/core/basic-kit` 分别承载主题、配置、Widget runtime 和默认内容包。
- `@leafergraph/extensions/*` 承载作者层、菜单、快捷键、撤销重做等宿主扩展。

## 导入与包规则

- 新代码优先使用当前包路径，例如 `@leafergraph/core/node` 和 `@leafergraph/extensions/context-menu`；旧别名仅用于兼容，不要继续扩散。
- 不要让包依赖越过允许边界；边界规则由 [scripts/workspace_boundaries.shared.mjs](scripts/workspace_boundaries.shared.mjs) 和检查脚本执行。
- `packages/core/*` 与 `packages/extensions/*` 是 package split 必需 workspace globs。
- Vite alias 集中在 [vite.config.base.ts](vite.config.base.ts)，TypeScript paths 集中在 [tsconfig.base.json](tsconfig.base.json)。新增或移动公开包路径时，两处都要同步。

## 开发原则

- 先判断改动属于核心库、运行时包、扩展包、示例还是模板；不要为了省事把宿主/demo 行为塞进核心真源。
- 保持模型层、渲染层、交互层、宿主壳层分离；优先 Leafer retained-mode scene graph 同步，不做临时 imperative 绘制补丁。
- TypeScript 是 strict 配置，避免未使用符号和违反 `noUncheckedSideEffectImports` 的副作用导入。
- 依赖 Leafer/browser API 的测试可能使用 package-level `tests/setup.ts` 中的 Happy DOM 和 canvas fake。
- 主包不再隐式安装 basic kit；需要系统节点或基础 widgets 时显式安装 `leaferGraphBasicKitPlugin`。
- 右键菜单创建节点优先使用 page 坐标；连线动画不可见时先排查 `prefers-reduced-motion` 和运行反馈，详见 [注意事项.md](注意事项.md)。
- 如果任务涉及 Leafer 能力选型、布局、视口、坐标或性能，可查本机 Leafer 文档目录（若存在）：`E:\Code\Node_editor\dora_workbench\libs\leafer-docs` 或 `E:\Code\Node_editor\leafer-docs`。

## 文档维护

- 当前事实写入 [README.md](README.md)、包 README 和 [docs/](docs/) 下的事实型专题。
- 前瞻方案写入 [docs/架构演进与提案总览.md](docs/架构演进与提案总览.md)，不要混入现状说明。
- 链接或包路径变化时，优先同步根 README 和 [docs/leafergraph-ai-index.md](docs/leafergraph-ai-index.md)。
- viewer-first split 状态见 [docs/viewer-first-root-split-manifest.md](docs/viewer-first-root-split-manifest.md)、[docs/viewer-first-root-migration.md](docs/viewer-first-root-migration.md) 和 [docs/package-split-verification.md](docs/package-split-verification.md)。