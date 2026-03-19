# Node 后端控制示例模板

这个模板现在直接承载完整的 Node authority 后端实现。

仓库内的 Node backend 现已统一收口到这里：

- authority 协议
- 内存 runtime
- WebSocket / HTTP server
- demo 启动入口
- 行为测试

## 目录结构

```text
templates/node-backend-control-template/
  package.json
  tsconfig.json
  README.md
  src/
    authority/
      protocol.ts
      runtime.ts
      server.ts
      demo_server.ts
      index.ts
    index.ts
    server.ts
  tests/
```

## 安装

在模板目录运行：

```bash
bun install
```

如果你把模板复制到仓库外，请先把 `package.json` 里的：

```text
@leafergraph/node: file:../../packages/node
```

替换成你自己的 workspace 路径或发布版本；模板只依赖 `@leafergraph/node` 的纯节点库导出。

## 检查、测试与构建

```bash
bun run check
bun run test
bun run build
```

## 启动

```bash
bun run start
```

如果你希望直接运行源码入口，也可以使用：

```bash
bun run dev
```

默认监听：

- `http://127.0.0.1:5502/health`
- `ws://127.0.0.1:5502/authority`

可用环境变量：

- `LEAFERGRAPH_NODE_AUTHORITY_HOST`
- `LEAFERGRAPH_NODE_AUTHORITY_PORT`
- `LEAFERGRAPH_NODE_AUTHORITY_NAME`

## 联调

当前仓库里的 editor demo 页可直接连这套模板服务：

```text
http://localhost:5501/authority-node-host-demo.html?preloadTestBundles=1
```

默认语义固定为：

- authority 文档完全以后端当前状态为准
- `preloadTestBundles=1` 只负责预载节点 / widget bundle
- `graph.play / graph.step / graph.stop` 由模板里的 authority runtime 处理
