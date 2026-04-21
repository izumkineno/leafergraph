# `@leafergraph/core/contracts`

`@leafergraph/core/contracts` 是 LeaferGraph workspace 的公共契约层。

它把多个包共享、但又不应该绑定某个具体宿主实现的类型集中到一起，例如插件协议、图 API 输入输出、Widget 契约、运行反馈和文档 diff helper。

## 包定位

适合直接依赖它的场景：

- 声明 `LeaferGraphOptions`、`LeaferGraphNodePlugin`、`RuntimeFeedbackEvent`
- 消费图操作输入输出和交互提交事件
- 写共享 Widget 契约类型
- 在实例外处理文档 diff

不适合直接把它当成：

- 图实例主包
- 模型真源
- 主题或配置默认值真源

## 公开入口

### 根入口

根入口主要负责三类共享协议：

- 插件与宿主协议
  - `LeaferGraphNodePlugin`
  - `LeaferGraphOptions`
  - `LeaferGraphWidgetEntry`
- 图 API 输入输出
  - `LeaferGraphCreateNodeInput`
  - `LeaferGraphCreateLinkInput`
  - `GraphOperation`
  - `GraphOperationApplyResult`
- 运行与交互反馈
  - `RuntimeFeedbackEvent`
  - `LeaferGraphInteractionCommitEvent`
  - `LeaferGraphHistoryEvent`

### `./graph-document-diff`

这个子路径只放纯数据 diff 类型与 helper：

- `GraphDocumentDiff`
- `applyGraphDocumentDiffToDocument(...)`
- `createCreateNodeInputFromNodeSnapshot(...)`
- `createUpdateNodeInputFromNodeSnapshot(...)`

## 最小使用方式

```ts
import type {
  LeaferGraphNodePlugin,
  LeaferGraphOptions,
  RuntimeFeedbackEvent
} from "@leafergraph/core/contracts";
import {
  applyGraphDocumentDiffToDocument,
  type GraphDocumentDiff
} from "@leafergraph/core/contracts/graph-document-diff";

const options: LeaferGraphOptions = {
  themeMode: "dark"
};

function handleRuntimeFeedback(event: RuntimeFeedbackEvent) {
  console.log(event.type);
}

function projectDiff(diff: GraphDocumentDiff, documentData: unknown) {
  return applyGraphDocumentDiffToDocument(documentData as never, diff);
}
```

## 与其它包的边界

| 包 | 关系 |
| --- | --- |
| `@leafergraph/core/node` | 模型真源，`contracts` 在其之上定义共享协议 |
| `@leafergraph/core/execution` | 执行真源，`contracts` 在其之上整理宿主共享类型 |
| `@leafergraph/core/config` | 配置真源，`contracts` 只在共享协议里转出相关类型，不接管真源所有权 |
| `@leafergraph/core/theme` | 视觉主题真源 |
| `leafergraph` | 图运行时主包，消费这些契约实现具体宿主 |

如果你已经知道自己只需要模型、配置或主题本身，仍然优先去对应真源包。  
`@leafergraph/core/contracts` 的职责是“跨包共享协议”，不是把所有真源重新聚合一遍。

## 常用命令

在 workspace 根目录执行：

```bash
bun run build:contracts
bun run test:contracts
```

## 继续阅读

- [根 README](../../README.md)
- [@leafergraph/core/node README](../node/README.md)
- [@leafergraph/core/execution README](../execution/README.md)
- [leafergraph README](../leafergraph/README.md)



