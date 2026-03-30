# @leafergraph/contracts

`@leafergraph/contracts` 是 LeaferGraph workspace 的公共契约真源。

它负责这些“会被多个包共享、但不该绑定某个宿主实现”的内容：

- 图运行时公开 options、插件协议和宿主上下文
- 图操作、交互提交、运行反馈等公共输入输出类型
- Widget 条目、renderer、lifecycle、editing context 等共享契约
- 图文档 diff 的纯数据类型与 helper

它不负责：

- `LeaferGraph` 运行时类和场景装配
- 节点壳、连线、画布交互和视图刷新
- 默认内容包、主题 preset 或 config 默认值真源

## 适用场景

适合：

- 给 `leafergraph`、`@leafergraph/widget-runtime`、`@leafergraph/authoring` 提供统一共享类型
- 在宿主外部声明 `LeaferGraphOptions`、`RuntimeFeedbackEvent`、`GraphOperation`
- 在 session / sync / authority 链里消费 `graph-document-diff` helper

不适合：

- 直接创建图实例
- 承载 Leafer scene 运行时逻辑
- 作为主题或配置默认值入口

## 快速开始

### 根入口

```ts
import type {
  LeaferGraphNodePlugin,
  LeaferGraphOptions,
  RuntimeFeedbackEvent
} from "@leafergraph/contracts";
```

### 文档 diff 子路径

```ts
import {
  applyGraphDocumentDiffToDocument,
  createUpdateNodeInputFromNodeSnapshot
} from "@leafergraph/contracts/graph-document-diff";
```

## 公开入口

- `@leafergraph/contracts`
  - 插件协议、图 API 输入输出、运行反馈、Widget 契约
- `@leafergraph/contracts/graph-document-diff`
  - 纯文档 diff 类型与 helper

## 包边界

- 节点、文档、模块和注册表真源在 `@leafergraph/node`
- 视觉主题真源在 `@leafergraph/theme`
- 非视觉配置真源在 `@leafergraph/config`
- Widget runtime 行为真源在 `@leafergraph/widget-runtime`
- `leafergraph` 只消费这些契约来暴露运行时 façade，不再聚合 re-export 它们

## 常用命令

在 workspace 根目录执行：

```bash
bun run build:contracts
bun run test:contracts
```
