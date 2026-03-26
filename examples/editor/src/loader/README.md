# `src/loader`

## 作用
- 负责 bundle manifest 校验、脚本/JSON bundle 装载、依赖求解和浏览器持久化。

## 边界
- 负责把 bundle 事实整理成 `runtimeSetup`。
- 不负责 UI 展示，也不直接维护 authority session。

## 核心入口
- `runtime.ts`
- `persistence.ts`
- `types.ts`

## 主要数据流 / 调用链
1. provider 恢复持久化记录或接收本地文件。
2. loader 解析 manifest、求解依赖并计算激活状态。
3. `resolveEditorBundleRuntimeSetup(...)` 产出 plugins、demo document 和 quick-create 能力。

## 推荐阅读顺序
1. `types.ts`
2. `runtime.ts`
3. `persistence.ts`

## 上下游关系
- 上游：`shell/provider.tsx`、本地文件选择器、authority frontend bundle sync。
- 下游：`ui/viewport/View.tsx`、`app/remote_authority_bundle_projection.ts`。