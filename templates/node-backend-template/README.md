# Node Backend Control Template

这份模板是 Node 后端控制实现的完整参考工程，按角色分层组织：

- `core`：协议与内存 runtime
- `transport`：HTTP / WebSocket 服务
- `entry`：唯一启动入口
- `tests`：行为回归

## 目录结构

```text
templates/node-backend-template/
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

## 角色边界

### 需要改

- 默认图文档（节点、连线、初始属性）。
- 业务节点执行规则与运行反馈细节。
- 默认 authority 名称、日志前缀、业务说明文案。

### 按需改

- 启动参数读取方式、日志级别、测试覆盖范围。
- 构建脚本与发布方式（保留主入口语义即可）。

### 不要改

- `GET /health`、`WS /authority` 路径契约。
- authority envelope 结构与 `getDocument / submitOperation / replaceDocument / controlRuntime` 动作语义。
- editor 联调依赖的运行反馈事件形状（`graph.execution / node.execution / link.propagation / node.state`）。

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
- `LEAFERGRAPH_NODE_BACKEND_PACKAGE_DIR`（节点包目录，默认指向 `templates/timer-node-package-template/packages`）

## 联调

```text
http://localhost:5501/authority-node-host-demo.html
```

联调语义固定：

- authority 文档以后端当前状态为准。
- 后端会通过 `authority.event -> frontendBundles.sync` 推送前端 bundle 源码，editor 自动注册。
- `graph.play / graph.step / graph.stop` 均由本模板 runtime 执行。
