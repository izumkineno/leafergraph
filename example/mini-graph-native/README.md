# mini-graph native memory comparison

这个示例是 `example/mini-graph` 的原生 TypeScript 对照页面，用于排查重复创建动画链、播放、停止、重置后仍有少量内存保留时，问题是否来自 Preact 页面壳层或 vnode/state 保留。

## 目标

- 只使用原生 DOM 与 TypeScript，不引入 Preact/React/Vue/lit/signals。
- 复用 `example/mini-graph/src/graph/diagnostic_controller.ts`，保证诊断链和 Preact 版本的核心图运行时路径一致。
- 通过 `window.__MINI_GRAPH_NATIVE_TEST__` 暴露最小测试面，便于自动化或手动在控制台驱动。

## 命令

在可见 PowerShell 窗口中执行：

```powershell
bun run dev:minimal-graph-native
bun run build:minimal-graph-native
bun run preview:minimal-graph-native
```

## 手动内存检查协议

1. 使用生产构建预览，不开启 DevTools heap recorder。
2. 打开 Chrome 任务管理器观察页面内存。
3. 点击“创建诊断链”，确认 Timer 间隔为 `25ms`。
4. 点击 `Play`，运行几分钟。
5. 点击 `Stop`，再点击 `Reset`。
6. 等待几分钟，观察页面内存是否能回落到目标阈值（当前目标：低于 150MB）。

如果原生页面能回落而 Preact 页面不能回落，优先排查 Preact 页面壳层、hook 引用、日志/state 或测试面闭包。如果两者都不能回落，优先排查 LeaferGraph/Leafer/runtime 层资源释放。
