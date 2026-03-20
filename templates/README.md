# Templates 总览（角色化）

`templates/` 目录只放“可复制出去的模板工程”。  
它们用于联调和二次开发参考，不是 workspace 的核心源码入口。

## 模板矩阵

| 模板 | 主要用途 | 默认端口 | 启动命令 | 对外契约 |
| --- | --- | --- | --- | --- |
| `node-backend-template` | Node 后端控制与 authority 服务 | `5502` | `bun run --cwd templates/node-backend-template start` | `GET /health`、`WS /authority`、authority request/response/event |
| `python-backend-template` | Python 后端控制与 authority 服务 | `5503` | `uv run --project templates/python-backend-template python -m leafergraph_python_backend_control_template.entry` | `GET /health`、`WS /authority`、authority request/response/event |
| `node-widget-plugin-template` | 节点/Widget 外部插件 + browser bundle 分发 | 无固定端口 | `bun run --cwd templates/node-widget-plugin-template build` | bundle manifest（`kind/id/requires`）与 `registerBundle(...)` |

## 角色边界（统一口径）

### 需要改

- 业务节点定义、业务 widget、业务 demo 文档。
- 包名、命名空间、默认标题、日志前缀、默认 authority 名称。
- 你的业务执行规则与运行反馈内容（在不改协议形状前提下）。

### 按需改

- 构建脚本、测试覆盖范围、默认 demo 预置数据。
- README 里的部署方式、环境准备、外部宿主接入示例。
- 本地开发体验相关配置（如 dev 命令、日志详细度）。

### 不要改

- `GET /health` 与 `WS /authority` 的稳定路径语义。
- authority envelope 基本通道（`authority.request/response/event`）与 action 结构。
- editor bundle bridge 基础契约与 `demo/node/widget` 分包职责。

## 命名约定（本轮重置）

- 根脚本统一使用 `*backend*` 命名，不再使用 `*authority-demo*` 旧名。
- 环境变量统一：
  - Node：`LEAFERGRAPH_NODE_BACKEND_HOST|PORT|NAME`
  - Python：`LEAFERGRAPH_PYTHON_BACKEND_HOST|PORT|NAME`
- 旧 `*_AUTHORITY_*` 变量不再保留。
