# `src/app`

## 作用
- 承接 editor 当前仍未完全下沉到 `shell/ui` 的过渡层实现。
- 主要包含页面 bootstrap 解析、authority bundle projection 策略和过渡面板实现。

## 边界
- 负责把页面级输入整理成 editor 可消费的初始化结构。
- 不负责长期持有 authority 会话、bundle catalog 或画布运行时。

## 核心入口
- `editor_app_bootstrap.ts`
- `remote_authority_bundle_projection.ts`
- `WorkspacePanels.tsx`

## 主要数据流 / 调用链
1. 页面注入 bootstrap。
2. `editor_app_bootstrap.ts` 归一化 remote authority 与 preloaded bundles。
3. `shell/provider.tsx` 消费这些输入并继续装配运行时。

## 推荐阅读顺序
1. `editor_app_bootstrap.ts`
2. `remote_authority_bundle_projection.ts`
3. `WorkspacePanels.tsx`

## 上下游关系
- 上游：`main.tsx`、HTML 页面入口。
- 下游：`shell/provider.tsx`、`backend/authority`、`ui/*`。