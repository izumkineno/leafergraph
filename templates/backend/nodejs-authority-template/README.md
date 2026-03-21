# Node.js Authority Template

这份模板是 Node.js authority 后端的正式参考实现。

## 目录结构

```text
templates/backend/nodejs-authority-template/
  package.json
  tsconfig.json
  README.md
  src/
    core/
      protocol.ts
      runtime.ts
    transport/
      server.ts
    entry/
      server.ts
    index.ts
  tests/
```

## 协议约定

- `GET /health`：健康检查
- `WS /authority`：JSON-RPC 2.0 authority 通道
- `rpc.discover`：返回共享 OpenRPC 文档
- 共享真源：`templates/backend/shared/openrpc/authority.openrpc.json`

固定 method：

- `authority.getDocument`
- `authority.submitOperation`
- `authority.replaceDocument`
- `authority.controlRuntime`

固定 notification：

- `authority.document`
- `authority.runtimeFeedback`
- `authority.frontendBundlesSync`

## 角色边界

### 需要改

- 默认图文档、业务节点执行规则、运行反馈细节。
- authority 名称、日志前缀、业务文案。
- 节点包目录与业务启动参数。

### 不要改

- `GET /health` 与 `WS /authority` 的基础路径。
- JSON-RPC 2.0 wire shape。
- OpenRPC 真源的 method / notification 命名。

## 命令

在模板目录执行：

```bash
bun install
bun run check
bun run test
bun run build
bun run dev
bun run start
```

默认监听：

- `http://127.0.0.1:5502/health`
- `ws://127.0.0.1:5502/authority`

环境变量：

- `LEAFERGRAPH_NODE_BACKEND_HOST`
- `LEAFERGRAPH_NODE_BACKEND_PORT`
- `LEAFERGRAPH_NODE_BACKEND_NAME`
- `LEAFERGRAPH_NODE_BACKEND_PACKAGE_DIR`
  默认指向 `templates/misc/backend-node-package-template/packages`

## 联调

```text
http://localhost:5501/authority-node-host-demo.html
```

联调语义固定：

- authority 文档以后端当前状态为准。
- 后端通过 `authority.frontendBundlesSync` 推送结构化前端 bundle 内容。
- `node/demo` 默认优先走 JSON 资产直推；只有 `widget` 或必须执行前端逻辑的 bundle 才继续走脚本。
- `graph.play / graph.step / graph.stop` 都由本模板 runtime 执行。
