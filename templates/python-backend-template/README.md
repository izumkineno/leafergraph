# Python Backend Control Template

这份模板提供 Python 后端控制与 authority 服务示例，并与 Node 模板保持同一分层语义：

- `core`：协议与内存 runtime
- `transport`：FastAPI HTTP / WebSocket 服务
- `entry`：唯一启动入口（`python -m ...`）
- `tests`：行为回归

## 目录结构

```text
templates/python-backend-template/
  pyproject.toml
  README.md
  src/
    leafergraph_python_backend_control_template/
      core/
        protocol.py
        runtime.py
      transport/
        server.py
      entry.py
      __init__.py
  tests/
```

## 角色边界

### 需要改

- 默认图文档与业务节点执行规则。
- 业务日志前缀、默认 authority 名称、业务文案。
- 业务侧 runtime feedback 细节（在不改协议形状前提下）。

### 按需改

- FastAPI/uvicorn 启动参数、日志策略、测试覆盖范围。
- 部署脚本、项目打包方式、依赖版本策略。

### 不要改

- `GET /health`、`WS /authority` 路径契约。
- authority envelope 结构与 `getDocument / submitOperation / replaceDocument / controlRuntime` 动作语义。
- 与 editor 联调依赖的运行反馈事件基础形状。

## 命令

在模板目录执行：

```bash
uv sync
uv run python -m pytest tests
uv run python -m leafergraph_python_backend_control_template.entry
```

默认监听：

- `http://127.0.0.1:5503/health`
- `ws://127.0.0.1:5503/authority`

环境变量：

- `LEAFERGRAPH_PYTHON_BACKEND_HOST`
- `LEAFERGRAPH_PYTHON_BACKEND_PORT`
- `LEAFERGRAPH_PYTHON_BACKEND_NAME`

## 联调

```text
http://localhost:5501/authority-python-host-demo.html?preloadTestBundles=1
```

联调语义固定：

- authority 文档以后端当前状态为准。
- `preloadTestBundles=1` 只预载前端 bundle，不回写后端文档。
- `graph.play / graph.step / graph.stop` 均由本模板 runtime 执行。
