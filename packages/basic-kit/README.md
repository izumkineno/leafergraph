# `@leafergraph/basic-kit`

`@leafergraph/basic-kit` 是 LeaferGraph workspace 的默认内容包。

它负责把“基础 widgets + 系统节点”打包成一套显式安装的默认内容，而不再让主包隐式内装这些条目。

## 包定位

适合直接依赖它的场景：

- 需要 `system/on-play`、`system/timer`
- 需要基础 widgets，例如 `input`、`textarea`、`select`、`toggle`、`slider`
- 需要一条 plugin 直接装好默认内容

不适合直接把它当成：

- 图运行时主包
- Widget runtime 真源
- 主题或配置真源

## 公开入口

### 根入口

- `leaferGraphBasicKitPlugin`

根入口只做一件事：按固定顺序安装默认内容。

### `./widget`

这个子路径负责基础 Widget 条目：

- `BasicWidgetLibrary`
- `BasicWidgetRendererLibrary`

### `./node`

这个子路径负责系统节点模块：

- `createBasicSystemNodeModule()`
- `LEAFER_GRAPH_ON_PLAY_NODE_TYPE`
- `leaferGraphOnPlayNodeDefinition`
- `LEAFER_GRAPH_TIMER_NODE_TYPE`
- `leaferGraphTimerNodeDefinition`

## 最小使用方式

推荐方式是把它作为 plugin 显式装进主包：

```ts
import { leaferGraphBasicKitPlugin } from "@leafergraph/basic-kit";
import { createLeaferGraph } from "leafergraph";

const graph = createLeaferGraph(container, {
  plugins: [leaferGraphBasicKitPlugin]
});

await graph.ready;
```

如果你只想要其中一部分内容，也可以拆开用：

```ts
import { createBasicSystemNodeModule } from "@leafergraph/basic-kit/node";
import { BasicWidgetLibrary } from "@leafergraph/basic-kit/widget";

graph.installModule(createBasicSystemNodeModule(), { overwrite: true });

for (const entry of new BasicWidgetLibrary().createEntries()) {
  graph.registerWidget(entry, { overwrite: true });
}
```

## 与其它包的边界

| 包 | 关系 |
| --- | --- |
| `@leafergraph/basic-kit` | 默认内容包 |
| `@leafergraph/widget-runtime` | Widget runtime 真源 |
| `@leafergraph/execution` | 系统执行节点的逻辑真源 |
| `@leafergraph/theme` | 默认视觉主题真源 |
| `leafergraph` | 消费这套默认内容的图宿主 |

一个简单判断是：

- 想快速得到“能用的默认节点和控件”，来 `basic-kit`
- 想改 Widget runtime、主题或主包行为，不要改这里

## 常用命令

在 workspace 根目录执行：

```bash
bun run build:basic-kit
bun run test:basic-kit
```

## Widget 组件梳理

### 组件分类概览

`@leafergraph/basic-kit` 提供了 11 种内建 Widget 类型，按交互能力分为两类：

| 分类 | 数量 | 组件类型 |
|------|------|---------|
| 可交互组件 | 8 | button, checkbox, radio, select, slider, input, textarea, toggle |
| 只读展示组件 | 3 | number, string, custom |

### 可交互组件

#### button - 按钮控件

| 属性 | 说明 |
|------|------|
| 控制器 | `ButtonFieldController` |
| 功能 | 触发自定义动作 |
| 交互特性 | 点击、悬停、按下状态；键盘聚焦；空格/回车触发 |
| 样式变体 | `primary` / `secondary` / `ghost` |
| 事件 | 点击后派发动作事件，可绑定自定义逻辑 |

```ts
// 使用示例
{
  type: "button",
  name: "submit",
  options: {
    label: "提交",
    variant: "primary",  // primary | secondary | ghost
    action: "onSubmit"   // 自定义动作名称
  }
}
```

#### checkbox - 复选框控件

| 属性 | 说明 |
|------|------|
| 控制器 | `CheckboxFieldController` |
| 功能 | 布尔值输入 |
| 数据类型 | `boolean` |
| 交互特性 | 点击切换；键盘空格/回车切换；勾选标记绘制 |

```ts
// 使用示例
{
  type: "checkbox",
  name: "enabled",
  options: {
    label: "启用",
    onText: "已启用",
    offText: "已禁用"
  }
}
```

#### radio - 单选框组

| 属性 | 说明 |
|------|------|
| 控制器 | `RadioFieldController` |
| 功能 | 从多个选项中选择一个 |
| 交互特性 | 垂直排列；支持禁用单个选项；键盘方向键导航 |

```ts
// 使用示例
{
  type: "radio",
  name: "mode",
  options: {
    label: "模式选择",
    items: [
      { label: "自动", value: "auto" },
      { label: "手动", value: "manual" },
      { label: "禁用选项", value: "disabled", disabled: true }
    ]
  }
}
```

#### select - 下拉选择控件

| 属性 | 说明 |
|------|------|
| 控制器 | `SelectFieldController` |
| 功能 | 下拉选择 |
| 交互特性 | 点击打开宿主菜单；键盘回车/空格打开；ESC关闭 |

```ts
// 使用示例
{
  type: "select",
  name: "format",
  options: {
    label: "格式",
    items: [
      { label: "JSON", value: "json" },
      { label: "XML", value: "xml" },
      { label: "CSV", value: "csv" }
    ]
  }
}
```

#### slider - 滑块控件

| 属性 | 说明 |
|------|------|
| 控制器 | `SliderFieldController` |
| 功能 | 数值范围选择 |
| 数据类型 | `number` |
| 交互特性 | 拖拽调整；键盘方向键/Home/End微调；进度条显示 |

```ts
// 使用示例
{
  type: "slider",
  name: "volume",
  options: {
    label: "音量",
    min: 0,
    max: 100,
    step: 1
  }
}
```

#### input - 单行文本输入

| 属性 | 说明 |
|------|------|
| 控制器 | `TextFieldController(false)` |
| 功能 | 单行文本输入 |
| 数据类型 | `string` |
| 交互特性 | 点击请求编辑；支持只读模式；占位符；最大长度限制 |

```ts
// 使用示例
{
  type: "input",
  name: "username",
  options: {
    label: "用户名",
    placeholder: "请输入用户名",
    maxLength: 20,
    readOnly: false
  }
}
```

#### textarea - 多行文本输入

| 属性 | 说明 |
|------|------|
| 控制器 | `TextFieldController(true)` |
| 功能 | 多行文本输入 |
| 数据类型 | `string` |
| 交互特性 | 同input，支持多行编辑；更高默认高度；自动换行 |

```ts
// 使用示例
{
  type: "textarea",
  name: "description",
  options: {
    label: "描述",
    placeholder: "请输入描述",
    maxLength: 500
  }
}
```

#### toggle - 开关控件

| 属性 | 说明 |
|------|------|
| 控制器 | `ToggleFieldController` |
| 功能 | 布尔值切换 |
| 数据类型 | `boolean` |
| 交互特性 | 滑动开关样式；点击切换；键盘空格/回车切换 |

```ts
// 使用示例
{
  type: "toggle",
  name: "darkMode",
  options: {
    label: "深色模式",
    onText: "开启",
    offText: "关闭"
  }
}
```

### 只读展示组件

#### number - 数值只读展示

| 属性 | 说明 |
|------|------|
| 控制器 | `ReadonlyFieldController` |
| 功能 | 数值只读展示 |
| 数据类型 | `number` |
| 特性 | 专业面板样式；支持聚焦高亮；统一格式化显示 |

```ts
// 使用示例
{
  type: "number",
  name: "count",
  options: {
    label: "计数"
  }
}
```

#### string - 字符串只读展示

| 属性 | 说明 |
|------|------|
| 控制器 | `ReadonlyFieldController` |
| 功能 | 字符串只读展示 |
| 数据类型 | `string` |
| 特性 | 同number，统一文本展示样式；支持占位符；聚焦高亮 |

```ts
// 使用示例
{
  type: "string",
  name: "status",
  options: {
    label: "状态",
    placeholder: "无数据"
  }
}
```

#### custom - 自定义值只读展示

| 属性 | 说明 |
|------|------|
| 控制器 | `ReadonlyFieldController` |
| 功能 | 自定义值只读展示 |
| 数据类型 | `any` |
| 特性 | 任意类型值转字符串展示；适合输出自定义结构 |

```ts
// 使用示例
{
  type: "custom",
  name: "metadata",
  options: {
    label: "元数据"
  }
}
```

### 交互方式汇总

| 交互方式 | 支持的组件 |
|---------|-----------|
| 点击 | button, checkbox, select, toggle, radio, input, textarea |
| 拖拽 | slider |
| 悬停 | button |
| 键盘导航 | 所有可交互组件都支持键盘聚焦和操作 |
| 文本编辑 | input, textarea |

### 技术特性

#### 架构设计

- **分离关注点**：渲染由 basic-kit 负责，真实编辑（文本输入、菜单打开）交给宿主处理
- **主题支持**：所有组件都支持主题切换，支持深色/浅色模式
- **无障碍**：所有可交互组件都支持键盘聚焦和操作
- **节点强调色**：组件使用节点强调色，视觉上与所属节点保持一致
- **禁用状态**：所有可交互组件都支持 `disabled` 状态

#### 交互实现

| 交互类型 | 实现方式 |
|---------|---------|
| 点击交互 | `bindPressWidgetInteraction`，支持 hover、press 状态变化 |
| 线性拖拽 | `bindLinearWidgetDrag`，处理滑块等一维拖拽 |
| 文本编辑 | 调用宿主 `beginTextEdit`，由宿主弹出 DOM 编辑器覆盖 |
| 菜单选择 | 调用宿主 `openOptionsMenu`，由宿主弹出菜单 |

### 快速参考

| 组件类型 | 交互状态 | 用途 | 数据类型 |
|---------|---------|------|---------|
| button | ✅ 可互动 | 触发动作 | - |
| checkbox | ✅ 可互动 | 布尔输入 | `boolean` |
| radio | ✅ 可互动 | 单选 | `any` |
| select | ✅ 可互动 | 下拉选择 | `any` |
| slider | ✅ 可互动 | 范围选择 | `number` |
| input | ✅ 可互动 | 单行文本 | `string` |
| textarea | ✅ 可互动 | 多行文本 | `string` |
| toggle | ✅ 可互动 | 开关切换 | `boolean` |
| number | ⚪ 只读 | 数值展示 | `number` |
| string | ⚪ 只读 | 文本展示 | `string` |
| custom | ⚪ 只读 | 自定义展示 | `any` |

## 继续阅读

- [根 README](../../README.md)
- [@leafergraph/execution README](../execution/README.md)
- [@leafergraph/widget-runtime README](../widget-runtime/README.md)
- [leafergraph README](../leafergraph/README.md)
