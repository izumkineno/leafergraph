# LeaferGraph 节点外壳设计

## 文档信息

- 日期：`2026-03-11`
- 适用对象：`leafergraph` 分类型节点外壳
- 当前阶段：`Phase 0 / 静态节点壳重做`
- 目标：
  - 参考现代专业节点工具中的 category node 风格重做节点
  - 把节点结构从“展示卡片”升级为“真正的功能节点”
  - 保留 Leafer retained-mode 场景下可接受的性能预算

---

## 参考输入

本轮重做直接参考了用户提供的 HTML 示意节点，其关键特征包括：

- 暗色工作区与轻网格背景
- 带状态灯的 header
- 右上角 category badge
- 上半区 slots area
- 下半区 widget area
- 带数值显示的紧凑 slider
- 输入输出端口贴边溢出

### 参考中的高成本效果

参考稿里包含这些典型 web 视觉：

- `backdrop-filter: blur(...)`
- 毛玻璃半透明面板
- hover 时更重的阴影
- 端口 hover 放大与发光
- 折叠 / 展开动画

### 在 LeaferGraph 中的取舍

为了不违背“现代化但不过分吃性能”的前提，本项目不直接照搬这些效果，而是做如下映射：

- 用半透明深色面板 + 轻边框模拟玻璃层次
- 用单层阴影代替多层模糊阴影
- 用状态灯与清晰结构代替大面积视觉特效
- 先做静态 expanded node，不在第一版上折叠动画
- hover / collapse / active 在后续状态系统中再接入

一句话原则：

- **保留结构语义，弱化昂贵特效。**

---

## 设计输入

### Figma 侧原则

参考 Figma 的 component / variant / token 思路，节点外壳应满足：

- 可以作为组件集，而不是一次性视觉稿
- anatomy 清晰，便于拆分 header / slots / widget
- category、ports、control、state 都能作为后续变量或 slot
- 能稳定映射到 Leafer 图元，而不是依赖浏览器专属效果

### `ui-ux-pro-max` 侧结果

本轮对以下关键词做了重新检索：

- `node graph editor glassmorphism dark category badge slots widget performant`
- `glass dark professional editor category badge`
- `slider accessibility compact control dark`

提炼出的有效结论是：

- 视觉基底应优先采用 `Dark Mode (OLED)` 一类高对比深色方案
- glassmorphism 可以借鉴“透明层级 + 浅描边”的感觉，但不应原样搬用 blur
- category badge、紧凑控件、深色背景上的高可读性文字比“炫技特效”更重要
- widget 控件的可读值、标签与颜色不应只靠单一颜色传递状态

---

## 视觉方向

本次节点壳采用以下方向：

- 名称：`Category Node / Soft Glass Runtime`
- 气质：`专业节点工具 + 轻玻璃层次 + 深色技术界面`
- 关键词：
  - dark
  - structured
  - compact
  - category-driven
  - runtime-like

### 核心变化

相较前一版 `Precision Panel` 卡片，本轮变化重点是：

- 从“标题 + 状态 pill”转向“header + slots + widget”的节点结构
- 从“卡片展示”转向“更接近真正图节点软件”的语义布局
- 把 category badge 放回 header
- 把参数控件放入独立 widget area
- 让连线锚点对齐到首个 slot 行，而不是节点几何中心

### 不采用的方向

- 不做真实毛玻璃 blur
- 不做 hover 放大
- 不做持续发光
- 不做 scanline / glitch / HUD 装饰
- 不做过度霓虹

原因：

- 节点图场景里会同时出现大量节点
- 真正影响使用体验的是结构清楚、信息易扫、锚点易理解
- blur、glow、复杂动画在节点堆叠时更容易脏和贵

---

## 节点 anatomy

节点外壳拆成以下部分：

1. `Shadow`
   - 单层阴影，负责悬浮感
2. `Card`
   - 主壳体，深色半透明面板
3. `Header`
   - 顶部结构区，容纳状态灯、标题和分类标签
4. `Signal Light`
   - 用颜色表达运行态，而不是再额外放一个大状态 pill
5. `Category Badge`
   - 右上角胶囊标签，突出节点归类
6. `Slots Area`
   - 左输入、右输出的双列插槽区域
7. `Ports`
   - 端口半悬挂在节点边缘，提升“可连线”可感知性
8. `Widget Area`
   - 底部独立参数区，和 slots area 明确分层
9. `Compact Slider`
   - 紧凑的数值调节条，带 label 和 value

### 结构示意

```text
+--------------------------------------------------------+
|  ● Multiply                           [ MATH / FLOAT ] |
|--------------------------------------------------------|
|  A                                                   Result
|  B                                                     ●
|                                                        |
|--------------------------------------------------------|
|  FACTOR                                           2.50 |
|  =====================o------------------------------- |
+--------------------------------------------------------+
```

---

## 设计 token

### 颜色

| Token | Value | 用途 |
|------|-------|------|
| `node.bg` | `rgba(28, 28, 33, 0.76)` | 节点主背景 |
| `node.stroke` | `rgba(255, 255, 255, 0.10)` | 节点边框 |
| `node.header` | `rgba(255, 255, 255, 0.05)` | header 背景 |
| `node.shadow` | `rgba(0, 0, 0, 0.34)` | 单层阴影 |
| `node.divider` | `rgba(255, 255, 255, 0.08)` | 区域分隔线 |
| `badge.bg` | `rgba(255, 255, 255, 0.08)` | 分类标签背景 |
| `badge.stroke` | `rgba(255, 255, 255, 0.05)` | 分类标签边框 |
| `text.title` | `#F4F4F5` | 标题 |
| `text.slot` | `#A1A1AA` | 插槽文字 |
| `text.meta` | `#71717A` | widget label |
| `port.input` | `#3B82F6` | 输入端口 |
| `port.output` | `#8B5CF6` | 输出端口 |

### 字体

| Token | Value | 用途 |
|------|-------|------|
| `font.primary` | `Inter / Segoe UI / sans-serif` | 标题、标签、widget 文本 |
| `font.code` | `JetBrains Mono / monospace` | 编辑器代码字体保留用 |

### 尺寸

| Token | Value | 用途 |
|------|-------|------|
| `node.width.default` | `288` | 默认节点宽度 |
| `node.height.min` | `184` | 默认最小高度 |
| `node.radius` | `18` | 节点圆角 |
| `node.header.height` | `46` | header 高度 |
| `slot.row.height` | `20` | 单个插槽行高度 |
| `slot.row.gap` | `16` | 插槽行间距 |
| `port.size` | `12` | 端口尺寸 |
| `widget.height` | `60` | widget area 高度 |

---

## 布局规则

### Header

- 左侧：状态灯 + 标题
- 右侧：category badge
- header 与 body 之间使用单线分割

### Slots Area

- 输入在左侧，输出在右侧
- 端口中心对齐对应 slot 行
- 连线锚点默认取首个 slot 行中心
- 文字对齐以“可扫读”为优先，不做复杂装饰

### Widget Area

- 放在底部独立区块
- 顶部用分隔线隔开
- label 在左、value 在右
- slider 放在 label/value 下方

### 高度策略

- 节点高度随 slot 行数动态增长
- 当 slot 数较少时，仍保持最小高度，避免节点过扁
- widget area 固定高度，保证不同节点的参数区结构一致

---

## 状态设计

第一版只实现静态默认展开态，但为后续这些状态预留结构：

- `default`
- `hover`
- `selected`
- `running`
- `collapsed`
- `error`

### 状态建议

| 状态 | 视觉变化建议 |
|------|--------------|
| `hover` | 提亮边框、端口和 header，不做 scale |
| `selected` | 外描边增强，端口与 slider accent 同步增强 |
| `running` | signal light 与当前 widget accent 提亮 |
| `collapsed` | 仅保留 header，高度收起 |
| `error` | signal light 切换到 error 色，并允许 category badge 同步警示 |

### 关键原则

- 不用常驻脉冲动画
- 不用 hover 放大节点
- 不靠颜色单独表达错误，后续应补图标或文本语义

---

## 性能预算

相较前一版极简卡片，本轮节点结构更接近真实软件节点，因此对象数量会上升。

### 预算原则

- 仍然不使用 `blur`、`backdrop-filter`、mask、复杂滤镜
- 仍然只保留一层阴影
- 以“结构语义优先”替代高成本装饰
- slot 数增加时按需增加图元，不预先堆很多装饰元素

### 当前对象构成

基础节点壳大致包含：

- 1 个阴影 `Rect`
- 1 个主卡片 `Rect`
- 1 个 header `Rect`
- 1 个 header divider `Rect`
- 2 个状态灯 `Rect`
- 1 个标题 `Text`
- 1 个 category badge `Rect`
- 1 个 category `Text`
- 1 个 widget area `Rect`
- 1 个 widget divider `Rect`
- 1 个 widget label `Text`
- 1 个 widget value `Text`
- 1 个 slider track `Rect`
- 1 个 slider active `Rect`
- 1 个 slider thumb `Rect`

再加上每个 slot：

- 1 个端口 `Rect`
- 1 个 slot label `Text`

### 典型数量

以“2 输入 + 1 输出”的节点为例：

- 基础壳：`15` 个对象
- slots：`6` 个对象
- 合计：`21` 个对象

这个数量比前一版高，但仍然明显低于引入 blur、复杂阴影和持续动画的成本。

---

## Figma 组件建议

如果后续把这版正式整理到 Figma，建议组件集如下：

### Component Set

- `NodeShell / CategoryNode`

### Variants

- `state=default|hover|selected|running|collapsed|error`
- `slotCount=1|2|3+`
- `widget=slider|none`

### Slot 替换项

- `title`
- `category`
- `signalColor`
- `inputs`
- `outputs`
- `controlLabel`
- `controlValue`
- `controlAccent`

### 命名建议

- `NodeShell/CategoryNode`
- `NodeShell/Header`
- `NodeShell/CategoryBadge`
- `NodeShell/Slot/Input`
- `NodeShell/Slot/Output`
- `NodeShell/Widget/Slider`

---

## 对代码实现的约束

- 不在 editor 层拼装节点壳
- 节点壳仍由核心库统一创建
- 视觉层次尽量用简单 `Rect` / `Text` 组合完成
- 端口几何与连线锚点应共享同一套 slot 布局语义
- 后续加 collapse / hover / selected 时，应 patch 当前结构，不要整卡重画

---

## 最终结论

这版节点壳不是把 HTML 的玻璃效果硬搬进 Leafer，而是把它重构成了更适合节点图运行环境的版本：

- 结构上更像真实节点软件
- 视觉上更接近现代专业工具
- 性能上比原始毛玻璃方案更可控
- 为后续 slots、widgets、collapse、state 插件接入留出了稳定骨架
