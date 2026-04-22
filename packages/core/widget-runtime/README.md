# `@leafergraph/core/widget-runtime`

`@leafergraph/core/widget-runtime` 是 LeaferGraph workspace 的 Widget runtime 真源。

它负责 Widget registry、renderer 生命周期适配、编辑宿主和交互 helper；它不负责默认 Widget 内容库，也不负责整张图的场景装配。

## 包定位

适合直接依赖它的场景：

- 需要一个正式 `LeaferGraphWidgetRegistry`
- 需要把生命周期对象归一化成正式 Widget renderer
- 需要复用 Widget 文本编辑、选项菜单和焦点转发能力
- 需要复用 slider / button 一类交互型 Widget helper

不适合直接把它当成：

- 默认 Widget 内容包
- 图实例主包
- 主题真源或配置真源

## 公开入口

根入口当前导出五组能力：

- Widget registry
  - `LeaferGraphWidgetRegistry`
- Widget 宿主
  - `LeaferGraphWidgetHost`
  - `createMissingWidgetRenderer()`
- 生命周期与渲染 helper
  - `createWidgetLifecycleRenderer(...)`
  - `createWidgetLabel(...)`
  - `createWidgetSurface(...)`
  - `createWidgetValueText(...)`
  - `createWidgetHitArea(...)`
- 编辑宿主
  - `LeaferGraphWidgetEditingManager`
  - `createDisabledWidgetEditingContext()`
- 交互 helper
  - `bindLinearWidgetDrag(...)`
  - `bindPressWidgetInteraction(...)`
  - `isWidgetInteractionTarget(...)`

## 最小使用方式

```ts
import type { LeaferGraphWidgetEntry } from "@leafergraph/core/contracts";
import {
  LeaferGraphWidgetRegistry,
  createMissingWidgetRenderer
} from "@leafergraph/core/widget-runtime";

const registry = new LeaferGraphWidgetRegistry(createMissingWidgetRenderer());

const statusWidget: LeaferGraphWidgetEntry = {
  type: "example/status",
  title: "Status",
  renderer: {
    mount(context) {
      const label = new context.ui.Text({
        x: context.bounds.x,
        y: context.bounds.y,
        text: String(context.value ?? "idle")
      });

      context.group.add(label);
      return { label };
    },
    update(state, _context, nextValue) {
      state?.label && (state.label.text = String(nextValue ?? "idle"));
    },
    destroy(state) {
      state?.label?.remove();
    }
  }
};

registry.registerWidget(statusWidget, { overwrite: true });
```

更常见的 workspace 内消费方式是：

- `leafergraph`
  - 用它装配主包自己的 Widget runtime 环境
- `@leafergraph/core/basic-kit`
  - 在这个真源之上提供基础 Widget 内容条目
- `@leafergraph/extensions/authoring`
  - 生成符合这些契约的 Widget entry

## 与其它包的边界

| 包 | 关系 |
| --- | --- |
| `@leafergraph/core/widget-runtime` | Widget runtime 真源 |
| `@leafergraph/core/basic-kit` | 默认 Widget 内容库 |
| `@leafergraph/core/theme` | Widget 视觉 token 真源 |
| `@leafergraph/core/config` | Widget editing 配置真源 |
| `leafergraph` | 消费这些能力并接到图运行时里 |

一个简单判断是：

- “这个 Widget 怎么渲染、怎么编辑、怎么交互”看 `widget-runtime`
- “默认提供哪些 Widget”看 `basic-kit`

## 常用命令

在 workspace 根目录执行：

```bash
bun run build:widget-runtime
bun run test:widget-runtime
```

## 继续阅读

- [根 README](../../README.md)
- [@leafergraph/core/basic-kit README](../basic-kit/README.md)
- [@leafergraph/core/theme README](../theme/README.md)
- [leafergraph README](../../leafergraph/README.md)



