# Python 后端控制示例模板

这个模板提供一套可直接复制出去的 Python authority / backend control 示例。

它保持当前 LeaferGraph Python demo 的最小契约：

- `GET /health`
- `WS /authority`
- `authority.request / authority.response / authority.event`

## 目录结构

```text
templates/python-backend-control-template/
  pyproject.toml
  README.md
  src/
    leafergraph_python_backend_control_template/
      __init__.py
      protocol.py
      runtime.py
      server.py
  tests/
```

## 安装

在模板目录运行：

```bash
uv sync
```

## 启动

```bash
uv run python -m leafergraph_python_backend_control_template.server
```

默认监听：

- `http://127.0.0.1:5503/health`
- `ws://127.0.0.1:5503/authority`

可用环境变量：

- `LEAFERGRAPH_PYTHON_AUTHORITY_HOST`
- `LEAFERGRAPH_PYTHON_AUTHORITY_PORT`
- `LEAFERGRAPH_PYTHON_AUTHORITY_NAME`

## 联调

当前仓库里的 editor demo 页可直接连这套模板服务：

```text
http://localhost:5501/authority-python-host-demo.html?preloadTestBundles=1
```

## 说明

- 这份模板当前直接承载仓库里的 Python authority demo 语义
- 如果你复制到仓库外，可按需要重命名包名、日志前缀和默认 authority 名称
- 行为回归由 `tests/` 中的 pytest 用例锁定
