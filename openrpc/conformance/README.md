# Authority Conformance 资产说明

这份目录保存 authority 跨语言接入的共享验收资产。

它不是协议真源，也不是某一门语言模板专属测试，而是：

- 给新语言后端提供统一接入门槛
- 给现有 Python 模板提供第一位参考消费者
- 给后续 CI / conformance runner 提供机器可读场景

---

## 目录结构

```text
conformance/
├─ README.md
├─ manifest.json
└─ fixtures/
   ├─ core/
   ├─ advanced/
   └─ runtime/
```

## 分层规则

- `core`
  最小互通要求。
- `advanced`
  参考模板高级兼容要求。

## `manifest.json` 字段

每个场景固定包含这些字段：

- `id`
- `level`
- `channel`
- `preconditions`
- `requestFixture`
- `expectedResponseFixture`
- `expectedNotificationFixtures`
- `notes`

## `preconditions` 约定

当前 runner 支持的预置动作：

- `replaceDocument`
  先把 authority 文档替换成某个 fixture。
- `openConnection`
  除 primary 外额外打开一条 WebSocket 连接。
- `bootstrapBaseline`
  在指定连接上先调用一次 `authority.getDocument`，让服务端和客户端都建立 baseline。

## Fixture 约定

- request fixture
  表示要发给 authority 的原始 request；`.txt` 可用于非法 JSON。
- expected response fixture
  使用 `mode` 指定断言方式：
  - `subset`
  - `result-equals-file`
- expected notification fixture
  当前统一使用 `subset`，按 envelope 的稳定子集匹配。

## 变量与占位

当前 request fixture 中允许用：

- `__CURRENT_DOCUMENT__`
  由 runner 在发送前替换成当前连接最近一次拿到的 `GraphDocument`。

当前 expectation fixture 中允许用：

- `__ANY__`
- `__ANY_STRING__`
- `__ANY_NUMBER__`
- `__ANY_STRING_OR_NUMBER__`
- `__ANY_BOOLEAN__`

这些占位只用于断言，不属于 wire 协议的一部分。

## 对新语言后端的接入方式

一个新语言后端若想复用这套 conformance 资产，应至少暴露：

- `GET /health`
- `WS /authority`

并让 runner 能通过以下环境变量指到它：

- `LEAFERGRAPH_AUTHORITY_CONFORMANCE_HTTP_BASE_URL`
- `LEAFERGRAPH_AUTHORITY_CONFORMANCE_WS_URL`
- `LEAFERGRAPH_AUTHORITY_CONFORMANCE_LEVEL`

## 当前参考消费者

当前这套共享 conformance 资产，已经由 Python OpenRPC 模板直接消费：

- `templates/backend/python-openrpc-authority-template/tests/test_conformance_assets.py`
  负责校验 manifest、fixtures、OpenRPC methods / notifications 对齐关系。
- `templates/backend/python-openrpc-authority-template/tests/test_conformance_runner.py`
  负责把 `manifest.json` 里的 `core` / `advanced` 场景真正回放到 live authority。

如果没有显式设置外部目标环境变量，runner 会自动拉起 Python 参考模板做本地验收；如果设置了：

- `LEAFERGRAPH_AUTHORITY_CONFORMANCE_HTTP_BASE_URL`
- `LEAFERGRAPH_AUTHORITY_CONFORMANCE_WS_URL`

runner 就会把同一套共享场景直接打到外部 authority 上。

## 参考命令

在仓库根目录的可见 PowerShell 中，可以直接执行：

```powershell
uv run --project templates/backend/python-openrpc-authority-template pytest templates/backend/python-openrpc-authority-template/tests/test_conformance_assets.py
uv run --project templates/backend/python-openrpc-authority-template pytest templates/backend/python-openrpc-authority-template/tests/test_conformance_runner.py
```

若只想跑 `core`，可以临时指定：

```powershell
$env:LEAFERGRAPH_AUTHORITY_CONFORMANCE_LEVEL = "core"
uv run --project templates/backend/python-openrpc-authority-template pytest templates/backend/python-openrpc-authority-template/tests/test_conformance_runner.py
Remove-Item Env:LEAFERGRAPH_AUTHORITY_CONFORMANCE_LEVEL
```

## 注意事项

- conformance fixture 可以包含测试文档和测试消息，但它们不是协议真源。
- 若共享 OpenRPC 真源变更后某个场景失效，应优先更新 manifest / fixtures，而不是在语言模板里默默加兼容分叉。
