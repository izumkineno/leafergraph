# 强制刷新模式与 API 清单

## 文档信息

- 当前状态：现状说明
- 最后校对：2026-05-15
- 适用范围：`packages/leafergraph` 强制刷新相关 API、调用点与性能特征
- 互补文档：
  - 渲染刷新策略总览看 [`../packages/leafergraph/渲染刷新策略.md`](../packages/leafergraph/渲染刷新策略.md)
  - 主包装配链看 [`../packages/leafergraph/内部架构地图.md`](../packages/leafergraph/内部架构地图.md)
  - Leafer 官方 API 看 [`E:\Code\Node_editor\leafer-docs`](../packages/leafergraph/渲染刷新策略.md)

这份文档记录 `leafergraph` 项目中所有强制刷新相关 API 的使用位置、调用场景和性能特征，方便做性能排查和刷新策略优化。

---

## 1. 术语表

### `forceUpdate()`

强制更新元素，**同时更新布局 + 渲染**。适合属性改动后希望整体刷新。

- Leafer API：`element.forceUpdate()`
- 项目状态：**未使用**

### `forceRender()`

强制渲染元素，**只重新渲染，不更新布局**。适合样式变化但布局没变的情况。

- Leafer API：`app.forceRender()`、`app.forceRender(undefined, true)`
- 项目状态：**未使用**

### `updateLayout()`

请求更新布局。如果布局没有变化，可能会忽略。

- Leafer API：`element.updateLayout()`
- 项目状态：**未使用**

### `nextRender()`

等待下一次渲染帧执行函数。适合在下一帧里做一些刷新后的操作。

- Leafer API：`element.nextRender(callback)`
- 项目状态：**未使用**

### `requestRender()`

项目自定义的统一渲染请求接口，底层实现为 `app.requestRender(true)`。

- 定义位置：`src/graph/assembly/runtime.ts`
- 调用点：30+ 处

---

## 2. 刷新层次体系

项目当前收敛为 2 个主要刷新层次，从轻到重：

```
┌──────────────────────────────────────────────────────────────┐
│  Level 1: requestRender()                                     │
│  → app.requestRender(true)                                    │
│  → 请求 Leafer 在下一轮调度中更新/渲染                         │
│  → 最轻量，30+ 处调用                                          │
├──────────────────────────────────────────────────────────────┤
│  Level 2: refreshNodeView() / refreshAllNodeViews()           │
│  → 单节点/全节点整壳重建                                       │
│  → 最重量，销毁旧 widget → 重建 shell → 重新挂载               │
│  → 主题切换、document 恢复时使用                               │
└──────────────────────────────────────────────────────────────┘
```

### 层次对比

| 层次 | 方法 | 布局更新 | 渲染更新 | 典型场景 | 调用次数 |
|------|------|----------|----------|----------|----------|
| Level 1 | `requestRender()` | 由 Leafer 自管 | ✓ | mutation、交互、widget、动画属性更新 | 30+ |
| Level 2 | `refreshNodeView()` | ✓ (重建) | ✓ | 主题切换、节点刷新 | 10+ |

---

## 3. API 清单与调用点

### 3.1 `forceUpdate()` — 0 处调用

项目中**没有使用** `forceUpdate()`。

---

### 3.2 `forceRender()` — 0 处调用

项目中**没有使用** `forceRender()`。

---

### 3.3 `updateLayout()` — 0 处调用

项目中**没有使用** `updateLayout()`。

**原因分析**：

- 项目选择用 `forceUpdate()` 替代，因为 `forceUpdate()` 保证同时更新布局和渲染
- `updateLayout()` 可能忽略无变化的布局请求，不适合需要强制刷新的场景

---

### 3.4 `nextRender()` — 0 处调用

项目中**没有使用** `nextRender()`。

**原因分析**：

- 项目使用 `requestAnimationFrame` 自行管理动画帧循环
- 动画控制器（`frame_loop.ts`）直接驱动帧推进，不需要等待下一帧回调

---

### 3.5 `requestRender()` — 30+ 处调用

这是项目中**最主要的刷新请求方式**，统一由 `runtime.ts` 中的 `app.requestRender(true)` 实现。

**定义位置**：

- `src/graph/assembly/runtime.ts:127` — 底层实现为 `canvasState.app.requestRender(true)`

**调用分布**：

| 模块 | 文件 | 调用次数 | 典型场景 |
|------|------|----------|----------|
| **图 mutation** | `src/graph/host/mutation.ts` | 9 | createNode, removeNode, updateNode, moveNode, resizeNode, createLink, removeLink 等 |
| **图视图** | `src/graph/host/view.ts` | 3 | 视图更新 |
| **图恢复** | `src/graph/host/restore.ts` | 1 | document 恢复后 |
| **图场景运行时** | `src/graph/host/scene_runtime.ts` | 1 | sceneRuntime.requestRender() |
| **主题运行时** | `src/graph/theme/runtime.ts` | 1 | 主题切换后 |
| **节点运行时控制器** | `src/node/runtime/controller.ts` | 2 | 折叠/展开、resize 约束 |
| **节点执行** | `src/node/runtime/execution.ts` | 2 | 执行反馈、连线传播 |
| **节点状态** | `src/node/runtime/state.ts` | 1 | 连接变化后 |
| **节点连接** | `src/node/runtime/connections.ts` | 1 | 连接变化 |
| **交互连接** | `src/interaction/runtime/connection.ts` | 4 | 连线交互 |
| **交互节点视图** | `src/interaction/runtime/node_views.ts` | 1 | 节点视图交互 |
| **选择框** | `src/interaction/selection_box_host.ts` | 3 | 框选交互 |
| **Widget 文本** | `packages/core/basic-kit/src/widget/text_widget.ts` | 1 | 文本 widget 更新 |
| **Widget 模板** | `packages/core/basic-kit/src/widget/template.ts` | 1 | 模板 widget 更新 |
| **Widget 运行时** | `packages/core/widget-runtime/src/widget_host.ts` | 2 | Widget 值更新 |
| **作者层** | `packages/extensions/authoring/src/widget_authoring.ts` | 1 | 作者层 widget |

---

## 4. 传播链架构

### 4.1 `requestRender` 传播链

```
调用方 (30+ 处)
    │
    ▼
sceneRuntime.requestRender()          ← 统一壳面
    │
    ▼
options.requestRender()               ← 依赖注入
    │
    ▼
runtime.ts: requestRender()           ← 收口层
    │
    ▼
canvasState.app.requestRender(true)   ← Leafer API
```

**设计要点**：

- 所有调用方**不知道**底层是 `forceRender`，只依赖 `requestRender()` 接口
- 这使得底层可以批量合并请求、切换渲染策略、添加性能监控

### 4.2 完整刷新链路图

```
                    ┌─────────────────────┐
                    │   调用方 (30+ 处)    │
                    │ mutation / execution │
                    │ interaction / widget │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │  sceneRuntime       │
                    │  .requestRender()   │  ← 统一壳面
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │  runtime.ts         │
                    │  requestRender()    │  ← 收口层
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
                               ▼
                    ┌─────────────────────┐
                    │  app.requestRender  │
                    │      (true)         │
                    │  Leafer 自调度刷新  │
                    └─────────────────────┘
```

---

## 5. 各场景刷新策略详解

### 5.1 图 mutation（最常见）

`src/graph/host/mutation.ts` — **9 处调用**

| 操作 | 刷新动作 | 粒度 |
|------|----------|------|
| `createNode` | mountNodeView + requestRender | 局部 |
| `removeNode` | unmountNodeView + requestRender | 局部 |
| `updateNode` | refreshNodeView + updateConnectedLinks + requestRender | 局部 |
| `moveNode` | updatePosition + updateConnectedLinks + requestRender | 局部 |
| `resizeNode` | refreshNodeView + updateConnectedLinks + requestRender | 局部 |
| `setNodeCollapsed` | refreshNodeView + updateConnectedLinks + requestRender | 局部 |
| `setNodeWidgetValue` | widget.update + requestRender | 最轻 |
| `createLink` | mountLinkView + requestRender | 局部 |
| `removeLink` | unmountLinkView + requestRender | 局部 |

**模式**：每次 mutation 结尾统一 `requestRender()`，不重复刷新。

**代码示例**（`mutation.ts:275-288`）：

```typescript
const state = this.options.nodeViews.get(nodeId);
if (state) {
  this.options.refreshNodeView(state);
} else {
  this.options.mountNodeView(node);
}

this.options.updateConnectedLinks(nodeId);
this.options.requestRender();  // 统一收口
return node;
```

---

### 5.2 节点执行反馈

`src/node/runtime/execution.ts` — **2 处调用**

```typescript
// 执行反馈
context.nodeExecutionHost.subscribeNodeExecution((event) => {
  context.refreshExecutedNode(event.nodeId);  // 整壳重建 (Level 4)
  context.notifyNodeStateChanged(event.nodeId, "execution");
});

// 连线传播
context.nodeExecutionHost.subscribeLinkPropagation((event) => {
  context.options.sceneRuntime.requestRender();  // 只重绘 (Level 1)
  context.notifyNodeStateChanged(event.targetNodeId, "input-values");
});
```

**特点**：

- 执行态变化 → 整壳重建（Level 4）
- 连线传播 → 轻量重绘（Level 1）

---

### 5.3 数据流动画（最复杂）

`src/link/animation/frame_loop.ts` — **0 处 forceUpdate**

```typescript
// 帧循环主函数
updateLeaferGraphLinkDataFlowFrame() {
  // 推进 pulse
  for (pulse of activePulses) {
    updatePulse(pulse);  // 更新 path/stroke/opacity
  }
  
  // 推进粒子
  for (particle of activeParticles) {
    updateParticle(particle);  // 更新位置/透明度
  }
  
  // 只在有可视变化时请求一次统一渲染
  if (hasVisualMutation) {
    host.options.requestRender();
  }
}
```

**设计亮点**：

- 动画粒子直接改 Leafer 常规属性，让引擎自己标记脏区
- 帧结束只做 `requestRender()`，把调度交还给 Leafer
- 无变化帧不触发渲染，避免空转

---

### 5.4 主题切换（批量刷新）

`src/graph/theme/runtime.ts` — **1 处调用**

```typescript
refreshThemeScene() {
  this.options.sceneRuntime.refreshAllNodeViews();     // 全节点整壳重建 (Level 4)
  this.options.sceneRuntime.refreshAllConnectedLinks(); // 全连线路径重算
  this.options.sceneRuntime.requestRender();            // 最终重绘 (Level 1)
}
```

**成本**：最高。全节点重建 + 全连线重算。

---

### 5.5 交互层

`src/interaction/runtime/connection.ts` — **4 处调用**

连线预览、拖拽连线等交互场景，每帧都可能需要重绘：

- 连线预览线更新 → `requestRender()`
- 拖拽连线端点 → `requestRender()`
- 连线完成 → `requestRender()`

---

## 6. 条件刷新模式

### 6.1 动画帧的条件触发

```typescript
// frame_loop.ts:96-98
if (hasVisualMutation) {
  host.overlayGroup.forceUpdate();
  host.options.renderFrame();
}
```

**避免空转**：只在本帧确实有可视变化时才触发渲染。

---

### 6.2 reduced motion 感知

```typescript
// controller.ts:165
if (!style.enabled || this.shouldReduceMotion() || !this.ownerWindow) {
  return;  // 跳过动画，不触发刷新
}
```

**无障碍支持**：用户开启"减少动态效果"时，动画完全跳过。

---

### 6.3 动画 preset 分级

```typescript
// controller.ts:169-181
switch (style.preset) {
  case "balanced":
    triggerParticle(runtime, event);        // 只有粒子
    break;
  case "expressive":
    triggerPulse(runtime, event);           // pulse + 粒子
    triggerParticle(runtime, event);
    break;
  case "performance":
  default:
    triggerPulse(runtime, event);           // 只有 pulse
    break;
}
```

**性能分级**：不同 preset 触发不同数量的动画效果。

| Preset | 效果 | 性能 | 适用场景 |
|--------|------|------|----------|
| `performance` | 只有 pulse | 最轻 | 低端设备、大量连线 |
| `balanced` | 只有粒子 | 中等 | 默认选择 |
| `expressive` | pulse + 粒子 | 最重 | 高端设备、演示场景 |

---

## 7. 未使用的 API

| API | 状态 | 说明 |
|-----|------|------|
| `forceUpdate()` | **未使用** | 动画属性更新已交回 Leafer 自管 |
| `forceRender()` | **未使用** | 通用收口已切到 `requestRender(true)` |
| `updateLayout()` | **未使用** | 当前无显式布局强制入口 |
| `nextRender()` | **未使用** | 项目继续使用 `requestAnimationFrame` / Leafer 调度 |
| `emitRender` | **未使用** | 未搜到任何引用 |
| `__render` / `__layout` | **未使用** | 未使用 Leafer 内部 API |

---

## 8. 性能特征总结

### 8.1 刷新成本排序

| 成本 | 方法 | 场景 |
|------|------|------|
| 最轻 | `requestRender()` | 单次渲染请求 |
| 重 | `refreshNodeView()` | 单节点整壳重建 |
| 最重 | `refreshAllNodeViews()` | 全节点重建（主题切换） |

---

### 8.2 优化观察

1. **批量收敛**：mutation 结尾统一 `requestRender()`，不重复刷新
2. **条件触发动画**：无变化帧不触发渲染，避免空转
3. **分级动画**：不同 preset 触发不同数量的动画效果
4. **reduced motion**：用户开启"减少动态效果"时，动画完全跳过

---

## 9. 调试建议

### 9.1 追踪刷新来源

如果需要追踪某个 `requestRender()` 的来源，可以在 `runtime.ts` 中添加堆栈追踪：

```typescript
const requestRender = (): void => {
  console.trace('requestRender');  // 临时调试
  canvasState.app.forceRender();
};
```

### 9.2 统计刷新次数

```typescript
let renderCount = 0;
const requestRender = (): void => {
  renderCount += 1;
  canvasState.app.forceRender();
};
// 定期输出
setInterval(() => {
  console.log(`Render count: ${renderCount}`);
  renderCount = 0;
}, 1000);
```

### 9.3 检查动画帧率

```typescript
let frameCount = 0;
const renderFrame = (): void => {
  frameCount += 1;
  canvasState.app.forceUpdate();
  canvasState.app.forceRender(undefined, true);
};
// 定期输出
setInterval(() => {
  console.log(`Frame count: ${frameCount}`);
  frameCount = 0;
}, 1000);
```

---

## 10. 扩展阅读

- Leafer 渲染机制：`E:\Code\Node_editor\leafer-docs\guide\life\render.md`
- 局部渲染：`E:\Code\Node_editor\leafer-docs\guide\advanced\partRender.md`
- 性能优化：`E:\Code\Node_editor\leafer-docs\guide\performance.md`
- 项目渲染策略：`../packages/leafergraph/渲染刷新策略.md`
