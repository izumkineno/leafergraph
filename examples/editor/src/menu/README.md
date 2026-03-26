# `src/menu`

## 作用
- 管理节点、连线和画布右键菜单的绑定与解析逻辑。

## 边界
- 负责菜单目标绑定、菜单项决策和打开前钩子。
- 不负责真正执行命令，执行仍交给命令总线。

## 核心入口
- `context_menu_bindings.ts`
- `context_menu_resolver.ts`

## 主要数据流 / 调用链
1. `GraphViewport` 绑定节点/连线菜单元数据。
2. 菜单解析器根据上下文生成最终项。
3. 菜单项再回调命令总线完成操作。

## 推荐阅读顺序
1. `context_menu_bindings.ts`
2. `context_menu_resolver.ts`

## 上下游关系
- 上游：`ui/viewport/View.tsx`、`leafergraph` context menu。
- 下游：`commands/command_bus.ts`。