# 节点 API 与节点外壳设计

## 文档信息

- 当前状态：现状优先，保留设计约束
- 最近校对：2026-03-23
- 适用范围：`packages/node`、`packages/leafergraph` 的节点模型与节点壳

## 1. 当前 API 结论

当前节点 API 已经不是纯概念提案，而是围绕 `packages/node` 与 `packages/leafergraph` 形成了两层接口：

1. 模型层 API
   - `NodeDefinition`
   - `NodeModule`
   - `NodeRegistry`
   - `createNodeApi`
   - `installNodeModule(...)`
2. 宿主层 API
   - `LeaferGraph`
   - `registerWidget(entry)`
   - `createNode(...)`
   - `updateNode(...)`
   - `moveNode(...)`
   - `resizeNode(...)`
   - `removeNode(...)`
   - `getNodeSnapshot(...)`

这份文档的目标是把“当前已经存在的接口”与“仍然属于设计约束的外壳方案”拆开说明。

## 2. 当前模型层接口

### 2.1 `NodeDefinition`

当前 `NodeDefinition` 已经是正式节点类型入口，负责描述：

- `type`
- `title`
- `inputs`
- `outputs`
- `widgets`
- `properties`
- `resize`
- 生命周期钩子

它属于 `packages/node`，不是 editor UI 类型。

### 2.2 `NodeModule`

`NodeModule` 当前是外部节点扩展的正式模型入口。

当前推荐的能力分工是：

- 节点模块通过 `installNodeModule(...)` 进入注册表
- widget 通过 `registerWidget(entry)` 进入主包 widget registry
- editor bundle 只是接入方式，不替代正式模块接口

### 2.3 `GraphDocument`

当前正式节点文档模型已经统一到 `GraphDocument`：

- 文档级身份：`documentId`、`revision`、`appKind`
- 节点集合：`nodes`
- 连线集合：`links`
- 可选能力：`capabilityProfile`
- 可选适配信息：`adapterBinding`

因此文档里不应再把旧 demo 输入结构写成正式节点 API 核心。

### 2.4 `GraphOperation`

当前结构性编辑已经有正式操作模型：

- `node.create`
- `node.update`
- `node.move`
- `node.resize`
- `node.remove`
- `link.create`
- `link.remove`
- `link.reconnect`
- `document.update`

这意味着：

- 节点 API 不只是本地函数调用
- 它已经具备 authority/回放/确认语义的正式抽象基础

## 3. 当前宿主层接口

### 3.1 `LeaferGraph` facade

`packages/leafergraph/src/index.ts` 当前对外提供的节点相关入口包括：

- `listNodes()`
- `getNodeSnapshot(nodeId)`
- `getNodeInspectorState(nodeId)`
- `createNode(...)`
- `updateNode(...)`
- `moveNode(...)`
- `resizeNode(...)`
- `removeNode(...)`
- `setNodeCollapsed(...)`
- `playFromNode(...)`

这层是宿主与场景层 API，不属于 `packages/node` 纯模型层。

### 3.2 节点快照是 editor 的正式观察入口

当前 editor 复制、粘贴、duplicate、history、检查器等能力，已经优先依赖：

- `getNodeSnapshot(...)`
- `subscribeNodeState(...)`
- `getNodeInspectorState(...)`

这说明节点 API 已经从“只服务内部渲染”转向“服务 editor 与 authority 壳层”。

## 4. 当前节点生命周期

当前节点生命周期需要区分两层：

1. 节点定义层生命周期
   - `onCreated`
   - `onConfigure`
   - `onConnectionsChange`
   - `onAction`
   - `onExecute`
2. 宿主层运行反馈
   - 节点状态变化
   - 节点执行事件
   - 图执行状态
   - 连线传播事件

文档不应再把“本地执行函数能跑起来”写成唯一执行模型；当前已经有 `RuntimeFeedbackEvent` 作为更正式的反馈抽象。

## 5. 当前节点外壳设计约束

下面这些内容仍然是设计约束，但已经明显贴近当前主包实现：

### 5.1 节点壳是 retained-mode 场景对象，不是临时 DOM 拼装

当前节点壳由主包节点宿主维护，核心目标是：

- 节点根视图稳定存在
- 内容区、端口区、widget 区可以局部刷新
- 交互态、选中态、折叠态和 resize 能共享同一套壳结构

### 5.2 节点壳刷新不等于整图替换

当前必须明确区分：

- `replaceGraphDocument(...)`：整图替换
- `refreshNodeView(...)`：单节点整壳重建
- widget 快速更新：局部 renderer `update(...)`

节点外壳设计必须服从这条刷新边界，避免把所有可见变化都做成整图替换。

### 5.3 slot / widget / header 是稳定结构，而不是自由堆叠

当前节点 UI 设计应继续围绕这些固定区块：

- Header
- 输入槽位区
- 输出槽位区
- Widget 区
- 折叠 / 信号 / resize 句柄等宿主交互区

这样才能让：

- 命中测试
- 折叠
- resize
- 连线锚点
- widget 交互

共享稳定几何。

## 6. 当前视觉与实现边界

### 6.1 设计稿与代码接口必须分开写

节点外壳的视觉方向、Figma 约束、token 建议仍然有价值，但它们属于：

- 视觉约束
- 交互体验目标
- 性能预算参考

不等于当前正式 TypeScript API。

### 6.2 当前不应再写成现状的内容

以下内容如果继续保留，只能标注为设计草案：

- 尚未存在的 `GraphModel` 新包结构
- 与当前 `GraphDocument` 不一致的概念字段
- 把旧 demo 节点输入当成正式节点文档模型

## 7. 对外部作者的当前建议

### 7.1 正式接入优先级

当前推荐顺序是：

1. 先写 `NodeDefinition`
2. 再把多个定义整理成 `NodeModule`
3. 再用 `installNodeModule(...)` 或主包插件入口接入
4. 如果是 editor 本地联调，再额外产出 bundle

### 7.2 widget 接入边界

当前 widget 的正式宿主入口是：

- `registerWidget(entry)`

而不是假想中的“节点定义里任意塞 renderer 实例”。

### 7.3 authority 相关语义

如果节点最终要进入 remote authority 链，当前应优先保证：

- 节点快照可序列化
- 节点更新能映射到 `GraphOperation`
- 运行态变化能映射到 `RuntimeFeedbackEvent`

## 8. 当前结论

当前节点 API 已经从“设计讨论”进入“正式模型 + 宿主 API + 设计约束并存”的阶段：

- `packages/node` 负责节点模型
- `packages/leafergraph` 负责节点宿主与场景 API
- 节点快照、图操作、运行反馈已经是正式抽象
- 节点外壳设计继续作为实现约束存在，但不能再和正式模型层混写

因此后续更新这份文档时，默认顺序应该始终是：

1. 先写当前已存在的模型与宿主接口
2. 再写当前仍有效的节点壳设计约束
3. 最后才写尚未落地的视觉或交互提案
