# `tauri-backend-demo`

最小图 + `@leafergraph/sync` + Tauri Rust authority 的演示工程。

## 当前能力

- 前端用 Preact 渲染最小图页面壳层、控制面板、运行日志和画布区。
- 右侧图文档真相由 Rust authority 维护，前端通过 `SyncSession` 消费 `sync_get_document`、`sync_submit_command`、`sync:snapshot` 和 `sync:feedback`。
- 支持 `Play / Step / Stop / Reset / Fit / Clear Log` 六个动作。
- 支持把画布上的正式交互提交同步到 Rust authority，目前覆盖节点移动、节点缩放、节点折叠、widget 提交和连线创建。
- `Play` 会启动后端定时推进，持续推送 `graph.execution / node.execution / link.propagation`。
- `Step` 只推进一次；若当前已有活动运行，后端会返回 `rejected`。
- `Stop` 会停止当前 play 循环并回到 `idle`。
- `Reset` 会通过 `document.replace` 恢复共享 seed 文档；若运行中触发，后端会先收口运行态再替换文档。
- authority 会把最新文档持久化到本地 `authority-document.json`，下次启动优先恢复。

## 目录

- `src/app`：页面壳层组合。
- `src/components`：控制面板、日志、画布卡片等纯展示组件。
- `src/graph`：LeaferGraph 生命周期、最小图 seed、自定义节点、运行反馈格式化。
- `src/tauri`：demo-local `TauriSyncOutlet`，负责把 `invoke + listen` 桥成 `SyncOutlet`。
- `src-tauri/src/authority`：Rust authority 真相、运行推进和持久化。
- `shared/demo_seed_document.json`：前后端共享的正式 `GraphDocument` seed。

## 开发

```bash
bun install
bun run tauri dev
```

只做静态验证时可以分别执行：

```bash
bun run build
cargo check --manifest-path src-tauri/Cargo.toml
```

如果这个 demo 被移动过目录，而 `cargo check` 命中旧绝对路径缓存，可以删除 `src-tauri/target` 后再重跑一次。
