# `src/demo`

## 作用
- 提供浏览器内 demo authority、Worker/bootstrap 和 WebSocket host demo 的页面接线能力。

## 边界
- 负责演示模式和宿主脚本入口。
- 不负责长期产品态的 authority 协议真源。

## 核心入口
- `preview_remote_authority_bootstrap.ts`
- `remote_authority_demo_service.ts`
- `remote_authority_demo_worker.ts`
- `websocket_host_demo_bootstrap.ts`

## 主要数据流 / 调用链
1. demo 页面安装 bootstrap。
2. demo authority service / Worker 或 WebSocket transport 被装配。
3. backend runtime 把它们统一为 remote authority source。

## 推荐阅读顺序
1. `preview_remote_authority_bootstrap.ts`
2. `remote_authority_demo_source.ts`
3. `remote_authority_demo_service.ts`
4. `websocket_host_demo_bootstrap.ts`

## 上下游关系
- 上游：HTML demo 页面。
- 下游：`backend/authority`、`session/*`。