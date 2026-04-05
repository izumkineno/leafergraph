# `example/runtime-bridge-node-demo`

`runtime-bridge-node-demo` 是一个 backend-first 的 runtime-bridge 示例。

## 启动顺序

再启动本 demo：

```bash
bun run dev:runtime-bridge-node-demo:server
bun run dev:runtime-bridge-node-demo:client
```

## 新增内容

当前 catalog 里包含：

- 远端状态节点示例
- 频谱实验蓝图与相关节点/组件

## 说明

- client / server 构建都应可直接通过
- authority 启动时会自动注册本地 seed catalog 条目
