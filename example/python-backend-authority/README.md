# `example/python-backend-authority`

`python-backend-authority` 是一个“后端接管执行权、前端只负责投影和可视化”的独立示例。

它用一个最小的 Python `http.server` 后端模拟远端执行内核，用浏览器端 LeaferGraph 页面证明这条链路是通的：

- 前端只发送 `start` / `update-config` / `stop` 命令
- 后端负责周期 tick、route 选择、payload 生成和停止清理
- 后端通过 SSE 推送 `RuntimeFeedbackEvent`
- 前端只把 `feedback` 投给 `projectRuntimeFeedback(...)`

这个示例不是为了展示复杂节点能力，而是为了验证“执行 authority 可以从前端切到 Python 后端，同时保留 LeaferGraph 现有投影路径”。

## 这个示例覆盖什么

- `leafergraph`
  - 图宿主 façade 和运行时投影入口
- `@leafergraph/core/basic-kit`
  - 基础节点壳和默认运行时内容
- `@leafergraph/core/contracts`
  - `RuntimeFeedbackEvent` 协议
- `@leafergraph/core/node`
  - 节点定义与图文档类型
- Python `http.server`
  - `POST /commands/start`
  - `POST /commands/update-config`
  - `POST /commands/stop`
  - `GET /events`

## 适合什么时候看

适合：

- 想验证后端接管执行权的最小链路
- 想看 `projectRuntimeFeedback(...)` 在远端 authority 下怎么接
- 想确认 SSE 包装层和 LeaferGraph runtime feedback 的边界
- 想找一个同时带前端页面和 Python 后端的最小 demo

不适合：

- 想看完整业务编排或持久化执行引擎
- 想看多图、多租户或鉴权设计
- 想看生产级 Python 服务框架集成

## 交互模型

页面里有 3 个固定节点：

- `Backend Timer`
- `Tick Processor`
- `Tick Sink`

最小交互面有三个命令：

- `start`
- `update-config`
- `stop`

后端维护当前 run 的状态、tick、节点执行状态和最近事件序号；前端只消费这些远端状态，不在本地驱动执行。

## 协议边界

这是这个示例最重要的约束。

### 前端允许做的事

- `POST /commands/start`
- `POST /commands/update-config`
- `POST /commands/stop`
- 监听 `GET /events`
- 解析 SSE envelope
- 把其中的 `feedback` 投给 `graph.projectRuntimeFeedback(...)`

### 前端不做的事

前端不应直接调用本地执行入口，例如：

- `graph.play(...)`
- `graph.step(...)`
- `graph.stop(...)`
- `graph.playFromNode(...)`

### SSE envelope

后端发给浏览器的是一层 transport envelope：

```json
{
  "seq": 13,
  "runId": "run-001",
  "feedback": {
    "type": "node.execution",
    "event": {}
  }
}
```

前端只把 `feedback` 传给 LeaferGraph：

```ts
graph.projectRuntimeFeedback(parsed.feedback);
```

## 运行时事件类型

这个 demo 只接受并投影 LeaferGraph 已有 runtime feedback 家族：

- `graph.execution`
- `node.execution`
- `node.state`
- `link.propagation`

其中这套 Python demo 当前主要会发：

- `graph.execution`
- `node.execution`
- `link.propagation`

## 目录结构

- `src/app.tsx`
  - 页面入口、图初始化、SSE 监听、命令发送、状态展示
- `src/app.css`
  - 页面布局和状态面板样式
- `backend/main.py`
  - Python 服务启动入口
- `backend/runtime_timer.py`
  - 内存态运行时、命令处理、SSE 推送
- `backend/protocol.py`
  - 命令与事件协议
- `pyproject.toml`
  - `uv` 管理的 Python 项目配置

## 启动方式

这个仓库的 JS workspace 使用 `bun`，Python 侧使用 `uv`。

### 1) 安装前端依赖

在仓库根目录执行：

```bash
bun install
```

### 2) 启动 Python 后端

在仓库根目录执行：

```bash
uv run --project example/python-backend-authority python -m backend.main
```

默认监听：

- `http://127.0.0.1:8765`

也可以直接进入示例目录执行：

```bash
uv run python -m backend.main
```

### 3) 启动前端页面

在仓库根目录执行：

```bash
bun run --filter leafergraph-python-backend-authority-example dev
```

也可以直接进入示例目录执行：

```bash
bun run dev
```

### 4) 打开页面

Vite 启动后，按终端输出打开浏览器地址即可。

建议保留两个终端：

- 一个跑 Python 后端
- 一个跑前端 dev server

## 构建与基本检查

### 前端构建

```bash
bun run --filter leafergraph-python-backend-authority-example build
```

或在示例目录：

```bash
bun run build
```

### 后端健康检查

```bash
curl http://127.0.0.1:8765/health
```

预期返回：

```json
{"ok": true}
```

### 手动触发运行

```bash
curl -X POST http://127.0.0.1:8765/commands/start \
  -H "Content-Type: application/json" \
  -d '{"graphId":"timer-graph","runId":"run-000","config":{"intervalMs":1000,"payload":"{\"message\":\"backend owned tick\"}","route":"timer -> processor -> sink"}}'
```

### 查看 SSE 输出

```bash
curl -N http://127.0.0.1:8765/events
```

你会看到类似：

```text
id: 15
event: runtime
data: {"seq":15,"runId":"run-001","feedback":{...}}
```

## 页面上应该看到什么

启动成功后，页面会显示：

- `Connection`
  - SSE 是否连到 Python 后端
- `Graph Status`
  - `idle` / `running` / `stepping`
- `Run ID`
  - 当前远端 authority run
- `Last Seq`
  - 最新命令确认或反馈序号
- `Runtime Log`
  - 收到的远端 feedback 摘要
- `Node Projection`
  - 每个节点的 `status` 和 `runCount`

点击按钮时的预期行为：

- `Start`
  - 后端开始连续推进 Timer → Processor → Sink
- `Apply Config`
  - 后端更新 tick 间隔、payload 和 route
- `Stop`
  - 当前 run 终止并回到 `idle`

## 当前实现的设计取舍

这个 demo 故意保持最小：

- 不做持久化
- 不做鉴权
- 不做多租户
- 不做复杂 route 编排
- 只保留一个能证明“后端是执行权威”的闭环

## 验收清单

- [ ] 页面显示 timer authority 语义而不是 remote source/process/sink 语义
- [ ] 前端只通过命令接口与 Python 后端交互
- [ ] 后端负责 tick、route、payload 和 stop 清理
- [ ] 前端只把 SSE 里的 feedback 投影给 `projectRuntimeFeedback(...)`
- [ ] README 能指导完整启动和验证流程
