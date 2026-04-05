# Node 与 Widget 制作完整指南

本文档是 LeaferGraph 项目中 Node 和 Widget 开发的完整指南，面向 AI 生成和扩展节点生态设计。文档包含基础概念、开发步骤、完整示例以及与后端交互的详细说明。

## 目录

- [1. 概述与架构理解](#1-概述与架构理解)
- [2. Node 制作基础](#2-node-制作基础)
- [3. Authoring SDK - 类式 Node 开发](#3-authoring-sdk---类式-node-开发)
- [4. Widget 制作基础](#4-widget-制作基础)
- [5. Authoring SDK - 自定义 Widget 开发](#5-authoring-sdk---自定义-widget-开发)
- [6. 与后端交互方案](#6-与后端交互方案)
- [7. 工程组织与打包](#7-工程组织与打包)
- [8. Plugin 与模块管理](#8-plugin-与模块管理)
- [9. 最佳实践与模式](#9-最佳实践与模式)
- [10. 完整实战案例](#10-完整实战案例)

---

## 1. 概述与架构理解

### 1.1 核心架构

LeaferGraph 采用分层架构设计，各包职责清晰：

| 包名 | 职责定位 | 主要产出 |
|------|----------|----------|
| `@leafergraph/node` | 模型真源，定义节点、模块、图文档核心结构 | `NodeDefinition`, `NodeRegistry`, `GraphDocument` |
| `@leafergraph/authoring` | 作者层体验，提供类式开发 API | `BaseNode`, `BaseWidget`, `createAuthoringPlugin` |
| `@leafergraph/execution` | 执行内核，处理节点执行与数据传播 | `LeaferGraphExecutionContext`, `LeaferGraphGraphExecutionHost` |
| `@leafergraph/widget-runtime` | Widget 运行时，处理渲染与交互 | `LeaferGraphWidgetRegistry`, 生命周期适配 |
| `@leafergraph/contracts` | 公共契约，定义跨包共享类型 | 插件接口、Widget 渲染协议、主题上下文 |
| `@leafergraph/runtime-bridge` | 运行时桥接，支持后端交互 | `LeaferGraphRuntimeBridgeClient`, 操作转换协议 |
| `leafergraph` | 主包，图运行时与交互宿主 | `createLeaferGraph`, `LeaferGraph` |

### 1.2 基本概念

- **Node**：图中的节点，代表一个计算单元或功能单元，具备输入、输出和执行逻辑。
- **Widget**：节点上的可视化控件，用于展示状态、接收用户输入或提供交互能力。
- **NodeDefinition**：节点类型的静态定义，描述某一类节点具备什么能力。
- **NodeModule**：一组节点定义的容器，用于批量安装和管理。
- **LeaferGraphNodePlugin**：插件对象，可同时包含节点和 Widget，由宿主在初始化时安装。

### 1.3 依赖关系

最常见的依赖链：

```
你的 Node/Widget 包 
  → @leafergraph/authoring
    → @leafergraph/node
    → @leafergraph/contracts
      → @leafergraph/execution (可选)
      → @leafergraph/widget-runtime (可选)
  → 最终被 leafergraph 消费
```

---

## 2. Node 制作基础

### 2.1 NodeDefinition 接口详解

```typescript
interface NodeDefinition extends NodeLifecycle {
  // 节点类型标识，必须全局唯一，建议使用 "namespace/name" 格式
  type: string;
  
  // 默认显示标题
  title?: string;
  
  // 默认分类，用于菜单分组
  category?: string;
  
  // 描述信息
  description?: string;
  
  // 搜索关键词
  keywords?: string[];
  
  // 默认输入槽位声明
  inputs?: NodeSlotSpec[];
  
  // 默认输出槽位声明
  outputs?: NodeSlotSpec[];
  
  // 默认属性声明
  properties?: NodePropertySpec[];
  
  // 默认 Widget 声明
  widgets?: NodeWidgetSpec[];
  
  // 节点默认尺寸 [width, height]
  size?: [number, number];
  
  // resize 约束配置
  resize?: NodeResizeConfig;
  
  // 节点壳静态配置
  shell?: NodeShellConfig;
}
```

### 2.2 NodeSlotSpec 槽位声明

```typescript
interface NodeSlotSpec {
  // 槽位名称
  name: string;
  
  // 数据类型，用于类型检查和显示
  type: string;
  
  // 是否为可选输入，默认 false
  optional?: boolean;
  
  // 是否允许多个输入连接，默认 false
  multiple?: boolean;
}
```

示例：

```typescript
inputs: [
  { name: "input", type: "number", optional: false },
  { name: "trigger", type: "event", optional: true }
]
outputs: [
  { name: "result", type: "number" },
  { name: "done", type: "event" }
]
```

### 2.3 NodePropertySpec 属性声明

```typescript
interface NodePropertySpec {
  // 属性名称
  name: string;
  
  // 属性类型
  type: string;
  
  // 默认值
  default?: unknown;
  
  // 是否可编辑
  editable?: boolean;
  
  // 内嵌 Widget 配置
  widget?: NodeWidgetSpec;
}
```

### 2.4 最小 Node 定义示例

使用 `@leafergraph/node` 直接定义：

```typescript
import type { NodeDefinition } from "@leafergraph/node";

export const addNode: NodeDefinition = {
  type: "example/add",
  title: "Add",
  category: "Example/Math",
  description: "Add two numbers",
  inputs: [
    { name: "a", type: "number" },
    { name: "b", type: "number" }
  ],
  outputs: [
    { name: "sum", type: "number" }
  ],
  properties: [
    { name: "offset", type: "number", default: 0 }
  ]
};
```

### 2.5 注册 Node

```typescript
import { NodeRegistry, installNodeModule } from "@leafergraph/node";

const registry = new NodeRegistry({
  get() {
    return undefined;
  }
});

installNodeModule(registry, {
  scope: {
    namespace: "example",
    group: "Example"
  },
  nodes: [addNode, multiplyNode]
});
```

---

## 3. Authoring SDK - 类式 Node 开发

### 3.1 BaseNode 泛型签名

```typescript
class BaseNode<
  Props = Record<string, unknown>,
  Inputs = Record<string, unknown>,
  Outputs = Record<string, unknown>,
  State = Record<string, unknown>
>
```

- **Props**：节点属性类型，对应 `properties` 声明
- **Inputs**：输入端口类型，对应 `inputs` 声明
- **Outputs**：输出端口类型，对应 `outputs` 声明
- **State**：运行时私有状态类型，由 `createState()` 创建

### 3.2 最小完整示例

```typescript
import { BaseNode, createAuthoringPlugin } from "@leafergraph/authoring";
import type { LeaferGraphExecutionContext } from "@leafergraph/execution";

class AddNode extends BaseNode<
  { offset: number },  // Props
  { a: number; b: number },  // Inputs
  { sum: number }   // Outputs
> {
  // 静态元数据，描述节点定义
  static meta = {
    type: "example/add",
    title: "Add",
    category: "Example/Math",
    description: "Add two numbers with optional offset",
    inputs: [
      { name: "a", type: "number" },
      { name: "b", type: "number" },
      { name: "compute", type: "event", optional: true }
    ],
    outputs: [
      { name: "sum", type: "number" }
    ],
    properties: [
      { name: "offset", type: "number", default: 0 }
    ],
    widgets: [
      {
        type: "input",
        name: "offset",
        value: "0",
        options: {
          label: "Offset",
          placeholder: "Additional offset"
        }
      }
    ],
    size: [180, 100]
  };

  // 执行逻辑：当节点被触发执行时调用
  onExecute(ctx: LeaferGraphExecutionContext) {
    // 读取输入
    const a = ctx.getInput("a", 0);
    const b = ctx.getInput("b", 0);
    
    // 读取属性
    const offset = ctx.props.offset;
    
    // 计算结果
    const sum = a + b + offset;
    
    // 设置输出
    ctx.setOutput("sum", sum);
  }

  // 处理动作：当 Widget 触发动作时调用
  onAction(
    action: string,
    param: unknown,
    options: Record<string, unknown>,
    ctx: LeaferGraphExecutionContext
  ) {
    if (action === "compute") {
      // 手动触发执行
      this.execute(ctx);
    }
  }
}

// 打包成插件
const plugin = createAuthoringPlugin({
  name: "example/math-nodes",
  nodes: [AddNode]
});

export default plugin;
```

### 3.3 常用方法

| 方法 | 作用 | 何时需要重写 |
|------|------|--------------|
| `static meta` | 静态元数据，描述节点 | **必须** |
| `createState()` | 创建运行时私有状态 | 需要保持状态时 |
| `onExecute(ctx)` | 节点执行逻辑 | **必须** |
| `onAction(action, param, options, ctx)` | 处理 Widget 动作 | 需要响应 Widget 交互时 |
| `onAdded(ctx)` | 节点被添加到图后调用 | 需要初始化资源时 |
| `onRemoved(ctx)` | 节点从图移除前调用 | 需要清理资源时 |

### 3.4 执行上下文常用 API

在 `onExecute` 中：

```typescript
// 读取输入，提供默认值
const value = ctx.getInput("name", defaultValue);

// 检查输入是否已连接
const hasInput = ctx.hasInput("name");

// 设置输出
ctx.setOutput("name", value);

// 读取属性
const propValue = ctx.props.name;

// 更新属性
ctx.setProp("name", newValue);

// 读取 Widget 值
const widgetValue = ctx.getWidget("name", defaultValue);

// 更新 Widget 值
ctx.setWidget("name", newValue);

// 读取运行时状态
const stateValue = ctx.state.name;

// 更新运行时状态（需要 createState）
ctx.setState({ name: newValue });
```

### 3.5 带 Widget 和状态的完整示例

```typescript
import { BaseNode } from "@leafergraph/authoring";
import { readWidgetNumber } from "./helpers";

class CounterNode extends BaseNode {
  static meta = {
    type: "example/counter",
    title: "Counter",
    category: "Example/Flow",
    outputs: [{ name: "count", type: "number" }],
    inputs: [{ name: "inc", type: "event", optional: true }],
    widgets: [
      {
        type: "button",
        name: "increment",
        value: "Increment",
        options: { label: "Count +1" }
      }
    ]
  };

  createState() {
    return { count: 0 };
  }

  onExecute(ctx) {
    ctx.setOutput("count", ctx.state.count);
  }

  onAction(action, _param, _options, ctx) {
    if (action === "increment") {
      ctx.setState({ count: ctx.state.count + 1 });
      ctx.setOutput("count", ctx.state.count);
    }
  }
}
```

### 3.6 在 Node 中更新 Widget 显示

常见模式是用一个状态型 Widget（如 status readout）显示节点的当前状态：

```typescript
import { BaseNode } from "@leafergraph/authoring";
import { createStatusWidgetSpec } from "./shared";
import { updateStatus } from "./helpers";

class TimeNode extends BaseNode {
  static meta = {
    type: "example/time",
    title: "Time",
    outputs: [
      { name: "in ms", type: "number" },
      { name: "in sec", type: "number" }
    ],
    widgets: [
      createStatusWidgetSpec({
        label: "Clock",
        description: "Browser uptime snapshot"
      })
    ]
  };

  onExecute(ctx) {
    const seconds = performance.now() / 1000;
    ctx.setOutput("in ms", seconds * 1000);
    ctx.setOutput("in sec", seconds);
    updateStatus(ctx, `CLOCK\n${seconds.toFixed(2)} s`);
  }
}
```

其中 `updateStatus` 是一个辅助函数：

```typescript
export function updateStatus(
  ctx: LeaferGraphExecutionContext,
  text: string
): void {
  ctx.setWidget("status", text);
}
```

---

## 4. Widget 制作基础

### 4.1 NodeWidgetSpec 结构

```typescript
interface NodeWidgetSpec {
  // Widget 类型，对应已注册的 Widget 定义
  type: string;
  
  // Widget 名称，用于在节点中标识
  name: string;
  
  // 当前值
  value: unknown;
  
  // 类型特定选项，不同 Widget 有不同选项
  options?: Record<string, unknown>;
}
```

### 4.2 内建 Widget 类型

| 类型 | 用途 | 常用选项 |
|------|------|----------|
| `number` | 数字输入 | `label`, `min`, `max`, `step` |
| `string` / `input` | 单行文本输入 | `label`, `placeholder` |
| `textarea` | 多行文本输入 | `label`, `rows`, `placeholder` |
| `toggle` | 开关切换 | `label`, `onText`, `offText` |
| `checkbox` | 复选框 | `label` |
| `slider` | 滑块 | `label`, `min`, `max`, `step` |
| `select` | 下拉选择 | `label`, `options: [{label, value}]` |
| `button` | 按钮 | `label` |
| `custom` | 自定义渲染 | - |

### 4.3 在 Node 中使用 Widget

直接在节点 `meta.widgets` 中声明：

```typescript
class ConstantNumberNode extends BaseNode {
  static meta = {
    type: "example/const-number",
    title: "Const Number",
    outputs: [{ name: "value", type: "number" }],
    properties: [{ name: "value", type: "number", default: 1 }],
    widgets: [
      {
        type: "input",
        name: "value",
        value: "1",
        options: {
          label: "Value",
          placeholder: "Enter a number"
        }
      }
    ]
  };

  onExecute(ctx) {
    const value = readWidgetNumber(ctx, "value", 1);
    ctx.setProp("value", value);
    ctx.setOutput("value", value);
  }
}
```

常用的辅助读取函数：

```typescript
export function readWidgetNumber(
  ctx: { getWidget: (name: string) => unknown },
  name: string,
  defaultValue: number
): number {
  const value = ctx.getWidget(name, defaultValue);
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const n = Number.parseFloat(value);
    if (!Number.isNaN(n)) {
      return n;
    }
  }
  return defaultValue;
}

export function readWidgetBoolean(
  ctx: { getWidget: (name: string) => unknown },
  name: string,
  defaultValue: boolean
): boolean {
  const value = ctx.getWidget(name, defaultValue);
  return Boolean(value);
}

export function readWidgetString(
  ctx: { getWidget: (name: string) => unknown },
  name: string,
  defaultValue: string
): string {
  const value = ctx.getWidget(name, defaultValue);
  return String(value ?? defaultValue);
}
```

### 4.4 Widget 归一化与序列化

每个 Widget 定义可以提供两个钩子：

```typescript
interface WidgetDefinition {
  type: string;
  title?: string;
  description?: string;
  
  // 运行时值归一化：在实例创建、配置变更时调用
  normalize?(value: unknown, spec?: NodeWidgetSpec): unknown;
  
  // 持久化值序列化：在保存文档前调用
  serialize?(value: unknown, spec?: NodeWidgetSpec): unknown;
}
```

**归一化**是运行时的概念，比如输入框返回 string，但节点期望得到 number，这时归一化钩子会将 string 转为 number。

**序列化**是持久化的概念，比如存储某些内部状态到文档时，需要将复杂对象转为可 JSON 序列化的简单结构。

示例：状态展示型 Widget 的归一化：

```typescript
function normalizeStatusValue(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "[Object]";
    }
  }
  return String(value);
}
```

---

## 5. Authoring SDK - 自定义 Widget 开发

### 5.1 BaseWidget 泛型签名

```typescript
class BaseWidget<
  TValue = string,
  TState = Record<string, unknown>
>
```

- **TValue**：Widget 值类型
- **TState**：挂载后的 UI 状态类型，存放创建的 Leafer 图元

### 5.2 完整示例 - StatusReadoutWidget

这是一个用于状态展示的自定义 Widget，完整代码参考：

```typescript
import {
  BaseWidget,
  defineAuthoringWidget,
  type DevWidgetContext
} from "@leafergraph/authoring";

import { AUTHORING_BASIC_STATUS_WIDGET_TYPE } from "../shared";

type StatusUi = DevWidgetContext<string>["ui"];
type StatusText = InstanceType<StatusUi["Text"]>;
type StatusRect = InstanceType<StatusUi["Rect"]>;

interface StatusReadoutState {
  label: StatusText;
  surface: StatusRect;
  statusLine: StatusText;
  detailLine: StatusText;
  chip: StatusRect;
}

interface StatusReadoutOptions {
  label: string;
  description: string;
  emptyText: string;
}

interface StatusTheme {
  labelFill: string;
  valueFill: string;
  mutedFill: string;
  fieldFill: string;
  fieldStroke: string;
  accentFill: string;
  accentStroke: string;
  fontFamily?: string;
}

function normalizeStatusValue(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "[Object]";
    }
  }
  return String(value);
}

function resolveOptions(options: unknown): StatusReadoutOptions {
  const source =
    options && typeof options === "object"
      ? (options as Record<string, unknown>)
      : {};

  return {
    label:
      typeof source.label === "string" && source.label.trim()
        ? source.label.trim()
        : "Status",
    description:
      typeof source.description === "string" && source.description.trim()
        ? source.description.trim()
        : "Node runtime snapshot",
    emptyText:
      typeof source.emptyText === "string" && source.emptyText.trim()
        ? source.emptyText.trim()
        : "IDLE"
  };
}

function resolveTheme(ctx: DevWidgetContext<string>): StatusTheme {
  const { tokens } = ctx.theme;

  return {
    labelFill: tokens.labelFill,
    valueFill: tokens.valueFill,
    mutedFill: tokens.mutedFill,
    fieldFill: tokens.fieldFill,
    fieldStroke: tokens.fieldStroke,
    accentFill: ctx.theme.mode === "dark" ? "#11304A" : "#D7ECFF",
    accentStroke: ctx.theme.mode === "dark" ? "#2F6CA0" : "#5B8BC1",
    fontFamily: tokens.fontFamily
  };
}

export class StatusReadoutWidget extends BaseWidget<string, StatusReadoutState> {
  static meta = {
    type: AUTHORING_BASIC_STATUS_WIDGET_TYPE,
    title: "Status Readout",
    description: "Compact status panel for authoring basic nodes",
    normalize: normalizeStatusValue,
    serialize: normalizeStatusValue
  };

  mount(ctx: DevWidgetContext<string>) {
    const options = resolveOptions(ctx.widget.options);
    const theme = resolveTheme(ctx);
    const geometry = resolveGeometry(ctx.bounds);

    const surface = new ctx.ui.Rect({
      x: 0,
      y: geometry.surfaceY,
      width: ctx.bounds.width,
      height: geometry.surfaceHeight,
      cornerRadius: 16,
      fill: theme.fieldFill,
      stroke: theme.fieldStroke,
      strokeWidth: 1,
      hittable: false
    });

    const chip = new ctx.ui.Rect({
      x: 12,
      y: geometry.chipY,
      width: 8,
      height: 8,
      cornerRadius: 999,
      fill: theme.accentFill,
      stroke: theme.accentStroke,
      strokeWidth: 1,
      hittable: false
    });

    const label = new ctx.ui.Text({
      x: 0,
      y: 0,
      width: ctx.bounds.width,
      text: options.label,
      fill: theme.labelFill,
      fontFamily: theme.fontFamily,
      fontSize: 10,
      fontWeight: "700",
      hittable: false
    });

    const statusLine = new ctx.ui.Text({
      x: 28,
      y: geometry.statusLineY,
      width: geometry.statusLineWidth,
      text: "",
      fill: theme.valueFill,
      fontFamily: theme.fontFamily,
      fontSize: 12,
      fontWeight: "600",
      textWrap: "break",
      textOverflow: "show",
      hittable: false
    });

    const detailLine = new ctx.ui.Text({
      x: 12,
      y: geometry.detailLineY,
      width: geometry.detailLineWidth,
      height: geometry.detailLineHeight,
      text: options.description,
      fill: theme.mutedFill,
      fontFamily: theme.fontFamily,
      fontSize: 10,
      textWrap: "break",
      textOverflow: "show",
      hittable: false
    });

    const state: StatusReadoutState = {
      label,
      surface,
      statusLine,
      detailLine,
      chip
    };

    ctx.group.add([label, surface, chip, statusLine, detailLine]);
    syncStatusReadout(state, ctx.value, options, theme, ctx.bounds);
    return state;
  }

  update(
    state: StatusReadoutState | void,
    ctx: DevWidgetContext<string>,
    nextValue: string
  ) {
    if (!state) {
      return;
    }

    syncStatusReadout(
      state,
      nextValue,
      resolveOptions(ctx.widget.options),
      resolveTheme(ctx),
      ctx.bounds
    );
  }

  destroy(state: StatusReadoutState | void) {
    if (!state) {
      return;
    }

    state.statusLine.text = "";
    state.detailLine.text = "";
  }
}

export const statusReadoutWidgetEntry = defineAuthoringWidget(StatusReadoutWidget);
```

### 5.3 Widget 生命周期

| 方法 | 作用 | 何时需要重写 |
|------|------|--------------|
| `static meta` | 静态元数据，描述 Widget | **必须** |
| `mount(ctx)` | 首次挂载 Widget，创建图元和状态 | **必须** |
| `update(state, ctx, nextValue)` | 值变化时更新 UI | 需要响应值变化时 |
| `destroy(state)` | Widget 销毁前清理资源 | 需要清理时 |

### 5.4 Widget 渲染上下文常用 API

```typescript
// 访问 LeaferUI 构造器，创建图元
const rect = new ctx.ui.Rect({ ... });
const text = new ctx.ui.Text({ ... });

// 将图元添加到 Widget 容器组
ctx.group.add(rect);
ctx.group.add(text);

// 获取当前布局边界
const { x, y, width, height } = ctx.bounds;

// 获取当前主题信息
const { tokens, mode } = ctx.theme;

// 获取当前 Widget 的值
const value = ctx.value;

// 修改值，只更新本地渲染，不生成文档操作
ctx.setValue(newValue);

// 提交值变更，生成正式文档操作
ctx.commitValue(newValue);

// 触发动作，抛给节点处理
ctx.emitAction("actionName", param, options);

// 请求刷新场景
ctx.requestRender();
```

### 5.5 在 Node 中使用自定义 Widget

创建辅助函数快速生成 spec：

```typescript
export function createStatusWidgetSpec(options: {
  label: string;
  description: string;
  emptyText?: string;
}): NodeWidgetSpec {
  return {
    type: AUTHORING_BASIC_STATUS_WIDGET_TYPE,
    name: "status",
    value: "",
    options
  };
}
```

然后在节点中直接使用：

```typescript
class MyNode extends BaseNode {
  static meta = {
    // ...
    widgets: [
      createStatusWidgetSpec({
        label: "Result",
        description: "Calculation result"
      })
    ]
  };

  onExecute(ctx) {
    // ... 计算
    updateStatus(ctx, JSON.stringify(result));
  }
}
```

### 5.6 主题适配

通过 `ctx.theme` 获取主题 token：

```typescript
interface LeaferGraphWidgetThemeTokens {
  labelFill: string;      // 标签文字颜色
  valueFill: string;      // 值文字颜色
  mutedFill: string;      // 次要文字颜色
  fieldFill: string;      // 字段背景色
  fieldStroke: string;    // 字段边框色
  fontFamily: string;     // 默认字体
}

interface LeaferGraphWidgetThemeContext {
  mode: "light" | "dark";
  tokens: LeaferGraphWidgetThemeTokens;
}
```

根据 mode 调整颜色：

```typescript
accentFill: ctx.theme.mode === "dark" ? "#11304A" : "#D7ECFF"
```

### 5.7 动态尺寸适配

Widget 容器会根据节点 resize 自动调整大小，可以在 `update` 中根据新的 `ctx.bounds` 重新布局：

```typescript
function resolveGeometry(bounds: LeaferGraphWidgetBounds): Geometry {
  const surfaceY = 16;
  const minimumSurfaceHeight = 66;
  const surfaceHeight = Math.max(bounds.height - surfaceY, minimumSurfaceHeight);
  // ... 根据 bounds 计算几何
  return { surfaceY, surfaceHeight, ... };
}

update(state, ctx, nextValue) {
  sync(state, nextValue, resolveGeometry(ctx.bounds));
}
```

---

## 6. 与后端交互方案

### 6.1 文档模型与操作

LeaferGraph 核心文档模型是 `GraphDocument`：

```typescript
interface GraphDocument {
  nodes: GraphNode[];
  links: GraphLink[];
  version: string;
  metadata?: Record<string, unknown>;
}
```

每个操作会产生 `GraphOperation`，可以同步给后端：

```typescript
type GraphOperation =
  | { type: "add-node"; node: GraphNode }
  | { type: "remove-node"; nodeId: string }
  | { type: "update-node"; nodeId: string; changes: Partial<GraphNode> }
  | { type: "add-link"; link: GraphLink }
  | { type: "remove-link"; linkId: string }
  | { type: "batch"; ops: GraphOperation[] };
```

### 6.2 文档差异计算

使用 `@leafergraph/contracts` 提供的 `computeGraphDocumentDiff` 计算新旧文档差异：

```typescript
import { computeGraphDocumentDiff } from "@leafergraph/contracts";

const operations = computeGraphDocumentDiff(oldDoc, newDoc);

// operations 是一个数组，包含从 oldDoc 到 newDoc 所需的所有操作
for (const op of operations) {
  // 发送每个操作给后端
  await sendOperationToBackend(op);
}
```

### 6.3 运行时桥接协议

使用 `@leafergraph/runtime-bridge` 包与后端交互：

#### 客户端初始化

```typescript
import { LeaferGraphRuntimeBridgeClient } from "@leafergraph/runtime-bridge";

const bridge = new LeaferGraphRuntimeBridgeClient({
  // 后端 HTTP 端点
  endpoint: "http://localhost:8080/api/graph",
  
  // 发送心跳间隔（毫秒）
  heartbeatInterval: 30000,
  
  // 操作超时
  operationTimeout: 10000,
  
  // 连接建立后的回调
  onConnect: () => {
    console.log("Connected to backend");
  },
  
  // 连接断开后的回调
  onDisconnect: () => {
    console.log("Disconnected from backend");
  },
  
  // 收到后端推送后的回调
  onOperation: (op) => {
    // 应用操作到本地文档
    graph.applyOperation(op);
  }
});

// 连接后端
await bridge.connect();
```

#### 同步本地操作到后端

```typescript
// 当本地产生操作时，发送给后端
graph.on("operation", ({ operation, source }) => {
  // 如果是本地用户产生的操作，同步给后端
  if (source === "user") {
    bridge.sendOperation(operation);
  }
});
```

#### 请求执行图

```typescript
// 请求后端执行整个图
const result = await bridge.requestExecute({
  document: currentDocument
});

console.log("Execution result:", result.outputs);
```

#### 请求单步执行

```typescript
// 请求后端仅执行指定节点
const result = await bridge.requestExecuteNode({
  document: currentDocument,
  nodeId: targetNodeId,
  inputs: nodeInputs
});

// 将结果更新到前端
result.outputs.forEach(({ name, value }) => {
  graph.setNodeOutput(nodeId, name, value);
});
```

### 6.4 后端服务实现参考（Node.js）

```typescript
import express from "express";
import {
  GraphDocument,
  GraphOperation,
  applyGraphOperation
} from "@leafergraph/node";
import {
  LeaferGraphGraphExecutionHost
} from "@leafergraph/execution";
import { NodeRegistry } from "@leafergraph/node";

const app = express();
app.use(express.json());

// 内存存储文档
let currentDocument: GraphDocument = {
  nodes: [],
  links: [],
  version: "1"
};

// 注册表（提前注册好所有节点类型）
const registry = new NodeRegistry({
  get(type) {
    return predefinedNodes.get(type);
  }
});

// 接收操作
app.post("/api/graph/operation", (req, res) => {
  const op: GraphOperation = req.body;
  
  // 应用操作到当前文档
  currentDocument = applyGraphOperation(currentDocument, op);
  
  // 广播给所有已连接的客户端（如果支持多人协作）
  broadcastToClients(op);
  
  res.json({ ok: true });
});

// 执行请求
app.post("/api/graph/execute", (req, res) => {
  const { document } = req.body;
  
  // 创建执行主机
  const host = new LeaferGraphGraphExecutionHost({
    nodeRegistry: registry,
    initialDocument: document
  });
  
  // 执行
  const result = host.executeAll();
  
  // 返回各节点输出
  res.json({
    ok: true,
    outputs: result.outputs
  });
});

// 拉取当前文档
app.get("/api/graph/document", (req, res) => {
  res.json({
    ok: true,
    document: currentDocument
  });
});

app.listen(8080, () => {
  console.log("Backend server running on port 8080");
});
```

### 6.5 WebSocket 实时同步

对于需要实时协作的场景，可以使用 WebSocket：

```typescript
// 客户端：通过 WebSocket 订阅操作
const socket = new WebSocket("ws://localhost:8080/ws");

socket.onmessage = (event) => {
  const op = JSON.parse(event.data);
  // 应用远端操作
  graph.applyOperation(op);
};

// 本地操作通过 WebSocket 发送
graph.on("operation", ({ operation }) => {
  if (source === "user") {
    socket.send(JSON.stringify(operation));
  }
});
```

### 6.6 Node 调用后端 API

在节点执行逻辑中直接调用后端：

```typescript
class HttpRequestNode extends BaseNode {
  static meta = {
    type: "network/http-request",
    title: "HTTP Request",
    category: "Network",
    inputs: [
      { name: "trigger", type: "event", optional: true },
      { name: "url", type: "string", optional: true },
      { name: "method", type: "string", optional: true }
    ],
    outputs: [
      { name: "response", type: "object" },
      { name: "status", type: "number" },
      { name: "done", type: "event" }
    ],
    properties: [
      { name: "url", type: "string", default: "" },
      { name: "method", type: "string", default: "GET" }
    ],
    widgets: [
      {
        type: "input",
        name: "url",
        value: "",
        options: { label: "URL", placeholder: "https://api.example.com" }
      },
      {
        type: "select",
        name: "method",
        value: "GET",
        options: {
          label: "Method",
          options: [
            { label: "GET", value: "GET" },
            { label: "POST", value: "POST" },
            { label: "PUT", value: "PUT" },
            { label: "DELETE", value: "DELETE" }
          ]
        }
      }
    ]
  };

  createState() {
    return {
      lastResponse: null,
      lastStatus: 0
    };
  }

  async onExecute(ctx) {
    // 读取输入或属性
    const url = ctx.getInput("url", ctx.props.url);
    const method = ctx.getInput("method", ctx.props.method);
    const widgetValue = readWidgetString(ctx, "url", url);

    try {
      // 调用后端 API
      const response = await fetch(widgetValue, { method });
      const data = await response.json();

      // 保存结果到状态
      ctx.setState({
        lastResponse: data,
        lastStatus: response.status
      });

      // 设置输出
      ctx.setOutput("response", data);
      ctx.setOutput("status", response.status);

      // 更新状态 Widget
      updateStatus(ctx, `Status: ${response.status}\n${JSON.stringify(data)}`);
    } catch (error) {
      updateStatus(ctx, `Error\n${(error as Error).message}`);
      throw error;
    }
  }
}
```

### 6.7 前后端执行模式

LeaferGraph 支持三种执行模式：

| 模式 | 说明 | 使用场景 |
|------|------|----------|
| 纯前端执行 | 所有节点都在浏览器中执行 | 原型验证、本地计算、低延迟交互 |
| 纯后端执行 | 整个图交给后端执行，前端只做展示和编辑 | 安全要求高、依赖后端资源、大数据量计算 |
| 混合执行 | 部分节点在前端执行，部分在后端执行 | 多数生产场景：UI 交互在前端，计算/IO 在后端 |

混合执行模式中，你可以通过 `runtime-bridge` 让节点请求后端执行：

```typescript
class BackendComputationNode extends BaseNode {
  static meta = {
    type: "backend/compute",
    title: "Backend Compute",
    inputs: [{ name: "input", type: "any" }],
    outputs: [{ name: "result", type: "any" }]
  };

  async onExecute(ctx) {
    const input = ctx.getInput("input", null);
    
    // 通过 bridge 请求后端计算
    const result = await ctx.host.requestExecute({
      nodeId: ctx.node.id,
      inputs: { input }
    });

    ctx.setOutput("result", result.outputs.result);
  }
}
```

---

## 7. 工程组织与打包

### 7.1 使用模板工程

LeaferGraph 提供了开箱即用的模板工程：

**Node 模板：** `templates/node/authoring-node-template/`

**Widget 模板：** `templates/widget/authoring-text-widget-template/`

### 7.2 Node 模板工程结构

```
authoring-node-template/
├── src/
│   ├── developer/
│   │   ├── shared.ts          # 共享常量（包名、类型ID等）
│   │   ├── module.ts          # Module 和 Plugin 出口
│   │   ├── nodes/             # 放各个 Node 类
│   │   │   └── *.ts
│   │   └── helpers.ts         # 辅助函数
│   └── browser/
│       └── entry.ts           # browser bundle 入口
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── vite.config.ts
└── vite.browser.config.ts
```

### 7.3 Widget 模板工程结构

```
authoring-text-widget-template/
├── src/
│   ├── developer/
│   │   ├── shared.ts          # 共享常量
│   │   ├── plugin.ts          # Plugin 出口
│   │   └── widgets/           # 放各个 Widget
│   │       └── *.ts
│   └── browser/
│       └── entry.ts
├── package.json
├── ...配置文件...
```

### 7.4 依赖配置

`package.json` 中应该将核心包声明为 peerDependencies：

```json
{
  "name": "my-leafer-nodes",
  "version": "1.0.0",
  "peerDependencies": {
    "@leafergraph/authoring": "^0.1.0",
    "@leafergraph/contracts": "^0.1.0",
    "@leafergraph/execution": "^0.1.0",
    "@leafergraph/node": "^0.1.0",
    "leafer-ui": "^1.0.0"
  },
  "devDependencies": {
    // 保留开发依赖
    "typescript": "^5.0.0",
    "vite": "^5.0.0"
  }
}
```

这样可以避免重复打包核心代码，减小产物体积。

### 7.5 输出产物

模板工程默认输出两种产物：

```
dist/
├── esm/
│   ├── module.js              # ESM 格式，供 TypeScript 宿主消费
│   └── ...
└── browser/
    └── node.iife.js           # IIFE 格式，供浏览器直接加载
```

### 7.6 常用构建命令

```bash
# 安装依赖
bun install

# 类型检查
bun run check

# 构建 ESM + browser bundle
bun run build

# 只构建 ESM
bun run build:esm

# 只构建 browser bundle
bun run build:browser
```

### 7.7 宿主接入

#### ESM 宿主

```typescript
import { createLeaferGraph } from "leafergraph";
import myPlugin from "my-leafer-nodes";

const graph = createLeaferGraph(container, {
  plugins: [myPlugin]
});

await graph.ready;
```

#### Browser bundle 宿主

将 `dist/browser/node.iife.js` 上传到服务器或放到本地，然后在页面中引入：

```html
<script src="path/to/node.iife.js"></script>
<script>
  // 全局变量会自动注册
  const graph = LeaferGraph.create(container, {
    plugins: [window.MyLeaferNodes.plugin]
  });
</script>
```

---

## 8. Plugin 与模块管理

### 8.1 LeaferGraphNodePlugin 接口

```typescript
interface LeaferGraphNodePlugin {
  // 插件名称，必须全局唯一
  name: string;
  
  // 可选版本号
  version?: string;
  
  // 安装入口，由宿主调用
  install(context: LeaferGraphNodePluginContext): void | Promise<void>;
}
```

### 8.2 使用 createAuthoringPlugin

对于纯 Authoring 节点包，可以直接用工具函数创建插件：

```typescript
import { createAuthoringPlugin } from "@leafergraph/authoring";

export default createAuthoringPlugin({
  name: "example/math-nodes",
  nodes: [AddNode, MultiplyNode, SubtractNode, DivideNode],
  // 如果有自定义 Widget，也一并放这里
  widgets: [StatusReadoutWidgetEntry]
});
```

### 8.3 手动实现插件

```typescript
import type { LeaferGraphNodePlugin } from "@leafergraph/contracts";

const myPlugin: LeaferGraphNodePlugin = {
  name: "my/custom-nodes",
  version: "1.0.0",
  
  install(context) {
    // 注册节点
    context.registerNode(myNodeDefinition);
    
    // 注册 Widget
    context.registerWidget(myWidgetEntry);
    
    // 也可以直接安装整个模块
    context.installModule(myNodeModule);
  }
};

export default myPlugin;
```

### 8.4 插件上下文 API

在 `install` 方法中你可以：

```typescript
// 判断节点是否已注册
if (!context.hasNode("my/node-type")) {
  context.registerNode(myNode);
}

// 判断 Widget 是否已注册
if (!context.hasWidget("my/widget-type")) {
  context.registerWidget(myWidget);
}

// 获取节点定义
const nodeDef = context.getNode("existing/node-type");

// 获取 Widget 定义
const widgetDef = context.getWidget("existing/widget-type");

// 列出所有节点
const allNodes = context.listNodes();

// 列出所有 Widget
const allWidgets = context.listWidgets();
```

### 8.5 NodeModule 组织

```typescript
import type { NodeModule } from "@leafergraph/node";

const myModule: NodeModule = {
  scope: {
    namespace: "example",
    group: "Example"
  },
  nodes: [
    AddNode.definition,
    MultiplyNode.definition
  ]
};

export { myModule };
```

---

## 9. 最佳实践与模式

### 9.1 Node 设计原则

1. **单一职责**：一个节点只做一件事，不要把太多功能塞到一个节点里。

2. **可组合**：输入输出设计要通用，方便和其他节点连接。

3. **默认值友好**：给所有可选输入和属性设置合理的默认值，让节点默认就能工作。

4. **状态分离**：
   - 用户配置 → `properties`
   - 交互输入 → `widgets`
   - 运行时私有状态 → `createState()`
   - 计算结果 → `outputs`

5. **显示状态**：重要结果应该通过 Widget 显示在节点上，方便用户查看。

### 9.2 常见 Node 模式

**常量节点模式**：

```typescript
// 用户在 Widget 输入一个常量，节点恒定输出这个值
class ConstantNumberNode extends BaseNode {
  static meta = {
    outputs: [{ name: "value", type: "number" }],
    properties: [{ name: "value", type: "number", default: 1 }],
    widgets: [{ type: "input", name: "value", ... }]
  };

  onExecute(ctx) {
    const value = readWidgetNumber(ctx, "value", 1);
    ctx.setProp("value", value);
    ctx.setOutput("value", value);
  }
}
```

**事件触发节点模式**：

```typescript
// 按钮点击时触发一次下游执行
class ButtonNode extends BaseNode {
  static meta = {
    outputs: [{ name: "clicked", type: "event" }],
    widgets: [{ type: "button", name: "click", options: { label: "Click" } }]
  };

  onAction(action, _param, _options, ctx) {
    if (action === "click") {
      ctx.triggerOutput("clicked");
    }
  }
}
```

**过滤器模式**：

```typescript
// 根据条件决定是否向下游传播
class FilterNode extends BaseNode {
  static meta = {
    inputs: [
      { name: "in", type: "any" },
      { name: "condition", type: "boolean", optional: true }
    ],
    outputs: [
      { name: "true", type: "any" },
      { name: "false", type: "any" }
    ],
    properties: [{ name: "condition", type: "boolean", default: true }]
  };

  onExecute(ctx) {
    const value = ctx.getInput("in", null);
    const condition = ctx.getInput("condition", ctx.props.condition);
    
    if (condition) {
      ctx.setOutput("true", value);
    } else {
      ctx.setOutput("false", value);
    }
  }
}
```

### 9.3 Widget 设计原则

1. **保持简洁**：Widget 只负责展示和交互，业务逻辑交给 Node。
2. **适配主题**：使用 `ctx.theme` 获取颜色，不要写死颜色值。
3. **响应尺寸**：当节点被用户 resize 时，Widget 应该自适应新尺寸。
4. **可访问**：重要操作要支持键盘（通过 `LeaferGraphWidgetEditingContext`）。

### 9.4 错误处理

在 `onExecute` 中可以直接抛出错误，宿主会正确捕获并显示：

```typescript
onExecute(ctx) {
  const value = ctx.getInput("value", null);
  
  if (value === null) {
    throw new Error("Input value is required");
  }
  
  // 继续处理...
}
```

对于异步错误，用 try-catch 包裹并更新状态：

```typescript
async onExecute(ctx) {
  try {
    const result = await apiCall(...);
    ctx.setOutput("result", result);
    updateStatus(ctx, "Success");
  } catch (error) {
    updateStatus(ctx, `Error: ${(error as Error).message}`);
    // 可选：重新抛出让宿主知道执行失败
    throw error;
  }
}
```

### 9.5 性能优化

1. **缓存计算结果**：如果输入没有变，不需要重新计算。
2. **按需请求渲染**：不要在 `update` 中频繁调用 `requestRender`。
3. **清理资源**：在 `onRemoved` 和 `destroy` 中清理定时器、网络请求等。

```typescript
class TimerNode extends BaseNode {
  createState() {
    return { timerId: null };
  }

  onAdded(ctx) {
    ctx.setState({
      timerId: setInterval(() => {
        // 定时更新
      }, 1000)
    });
  }

  onRemoved(ctx) {
    if (ctx.state.timerId) {
      clearInterval(ctx.state.timerId);
    }
  }
}
```

---

## 10. 完整实战案例

本节我们从零开始创建一个"随机数生成器"节点，包含一个自定义滑块 Widget。

### 10.1 创建工程

基于模板工程：

```bash
cp -r templates/node/authoring-node-template my-random-nodes
cd my-random-nodes
bun install
```

### 10.2 编写节点

`src/developer/nodes/random-number-node.ts`：

```typescript
import { BaseNode } from "@leafergraph/authoring";
import { readWidgetNumber } from "../helpers";
import { MY_NODE_TYPES } from "../shared";

export class RandomNumberNode extends BaseNode {
  static meta = {
    type: MY_NODE_TYPES.randomNumber,
    title: "Random Number",
    category: "Example/Random",
    description: "Generate a random number in range",
    inputs: [
      { name: "generate", type: "event", optional: true }
    ],
    outputs: [
      { name: "value", type: "number" }
    ],
    properties: [
      { name: "min", type: "number", default: 0 },
      { name: "max", type: "number", default: 100 }
    ],
    widgets: [
      {
        type: "slider",
        name: "min",
        value: 0,
        options: {
          label: "Min",
          min: 0,
          max: 1000,
          step: 1
        }
      },
      {
        type: "slider",
        name: "max",
        value: 100,
        options: {
          label: "Max",
          min: 0,
          max: 1000,
          step: 1
        }
      },
      {
        type: "button",
        name: "generate",
        value: "Generate",
        options: { label: "Generate" }
      },
      createStatusWidgetSpec({
        label: "Last Value",
        description: "Most recently generated value"
      })
    ],
    size: [200, 180]
  };

  createState() {
    return { lastValue: 0 };
  }

  onExecute(ctx) {
    const min = readWidgetNumber(ctx, "min", 0);
    const max = readWidgetNumber(ctx, "max", 100);
    const value = min + Math.random() * (max - min);

    ctx.setState({ lastValue: value });
    ctx.setOutput("value", value);
    updateStatus(ctx, value.toFixed(4));
  }

  onAction(action, _param, _options, ctx) {
    if (action === "generate") {
      this.execute(ctx);
    }
  }
}
```

### 10.3 导出节点

修改 `src/developer/module.ts`：

```typescript
import { createAuthoringModule } from "@leafergraph/authoring";
import { RandomNumberNode } from "./nodes/random-number-node";

export const module = createAuthoringModule({
  scope: {
    namespace: "my",
    group: "My Nodes"
  },
  nodes: [RandomNumberNode]
});

export default module;
```

### 10.4 创建插件

```typescript
import { createAuthoringPlugin } from "@leafergraph/authoring";
import { module } from "./module";

const plugin = createAuthoringPlugin({
  name: "my/random-nodes",
  module
});

export default plugin;
```

### 10.5 构建

```bash
bun run check
bun run build
```

### 10.6 使用

```typescript
import { createLeaferGraph } from "leafergraph";
import myRandomNodes from "my-random-nodes";

const graph = createLeaferGraph(container, {
  plugins: [myRandomNodes]
});

await graph.ready;
// 现在可以在菜单 "My Nodes" 中找到 Random Number 节点了！
```

### 10.7 完整项目结构

```
my-random-nodes/
├── src/
│   ├── developer/
│   │   ├── shared.ts              # 类型ID常量
│   │   ├── helpers.ts            # 辅助函数
│   │   ├── module.ts             # 模块定义
│   │   ├── plugin.ts             # 插件定义
│   │   └── nodes/
│   │       └── random-number-node.ts
│   └── browser/
│       └── entry.ts              # browser bundle 入口
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## 总结

通过本文档，你应该已经掌握了：

1. **Node 开发**：从基础定义到使用 Authoring SDK 进行类式开发
2. **Widget 开发**：内建 Widget 使用和自定义 Widget 的完整流程
3. **工程管理**：使用模板工程快速开始，正确打包和分发
4. **后端集成**：多种执行模式和完整的前后端交互方案
5. **最佳实践**：常见设计模式和性能优化建议

LeaferGraph 的设计理念是**分层开放**：
- 模型层、执行层、渲染层完全解耦
- 可以只做前端纯本地执行，也可以完全后端执行
- 混合执行模式支持平滑演进
- 插件体系允许渐进式扩展

更多阅读：

- [节点插件接入方案](./节点插件接入方案.md)
- [架构演进与提案总览](./架构演进与提案总览.md)
- [节点状态与外壳规范](./节点状态与外壳规范.md)

---

## 附录：常用类型速查表

### 核心类型

| 类型 | 来源包 | 用途 |
|------|--------|------|
| `NodeDefinition` | `@leafergraph/node` | 节点定义 |
| `NodeSlotSpec` | `@leafergraph/node` | 端口定义 |
| `NodePropertySpec` | `@leafergraph/node` | 属性定义 |
| `NodeWidgetSpec` | `@leafergraph/node` | Widget 定义 |
| `GraphDocument` | `@leafergraph/node` | 图文档 |
| `GraphOperation` | `@leafergraph/node` | 文档操作 |
| `LeaferGraphExecutionContext` | `@leafergraph/execution` | 执行上下文 |
| `LeaferGraphNodePlugin` | `@leafergraph/contracts` | 插件接口 |
| `LeaferGraphWidgetRendererContext` | `@leafergraph/contracts` | Widget 渲染上下文 |

### 常用 API

| API | 位置 | 作用 |
|-----|------|------|
| `BaseNode` | `@leafergraph/authoring` | 节点基类 |
| `BaseWidget` | `@leafergraph/authoring` | Widget 基类 |
| `createAuthoringPlugin` | `@leafergraph/authoring` | 创建插件 |
| `createAuthoringModule` | `@leafergraph/authoring` | 创建模块 |
| `defineAuthoringWidget` | `@leafergraph/authoring` | 定义 Widget 入口 |
| `computeGraphDocumentDiff` | `@leafergraph/contracts` | 计算文档差异 |
|
