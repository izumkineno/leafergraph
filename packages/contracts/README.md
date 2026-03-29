# @leafergraph/contracts

`@leafergraph/contracts` 是 LeaferGraph workspace 的公共契约真源。

它负责收口下面这类“可被多个包共享、但不应依赖主包运行时”的内容：

- 插件、Widget 与主题相关公共协议
- 图操作、交互提交、运行反馈等宿主公共类型
- 图文档 diff 的纯数据类型与 helper

它不负责：

- `LeaferGraph` 运行时类
- 场景装配、节点壳、交互宿主和视图同步
- `graph_api_host` 一类主包 facade 实现

当前兼容策略如下：

- `@leafergraph/contracts` 是正式契约真源
- `leafergraph` 根入口仍然继续 re-export 这些契约
- `leafergraph/graph-document-diff` 子路径仍然继续可用

也就是说，外部当前仍可从 `leafergraph` 导入原有公共类型；但在 workspace 内部，新增实现应优先直接依赖 `@leafergraph/contracts`。
