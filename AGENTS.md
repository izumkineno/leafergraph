# AGENTS.md

## 适用范围

本文件适用于目录 `E:\Code\Node_editor\leafergraph` 及其全部子目录。

在本目录内工作的代理、协作者或自动化工具，应优先遵守本文件；若上层目录也存在 `AGENTS.md`，则以更靠近当前工作目录的文件为准。

---

## 工作区命令与进程约束

以下约束在 `leafergraph` 目录内默认强制执行：

- 凡是需要启动外部工具、应用、服务、测试 runner、浏览器、开发服务器或后端进程时，必须优先通过可见窗口入口启动，例如 `PowerShell`、`Windows Terminal`、`cmd` 或用户明确指定的其他可见终端入口。
- 禁止使用无窗、隐藏窗口、静默驻留或后台守护式启动方式，例如 `pythonw`、`Start-Process -WindowStyle Hidden`、`start /b`、`nohup`、脱离窗口的 daemon 化启动，或其他用户无法直接看到和接管的后台命令。
- 如需给用户提供启动命令，默认写成“在可见 PowerShell 窗口中执行”的形式；若需要由代理代为启动，也应优先使用新的可见 PowerShell 窗口承载该进程，而不是把长期任务留在无窗后台环境中。
- 仅限短生命周期、只读、不会留下后台进程的查询类命令，可以在当前代理 shell 中直接执行；一旦命令会持续运行、监听端口、占用资源或影响联调环境，就必须切回可见窗口入口。
- Python 相关命令统一使用 `uv`，包括安装依赖、运行脚本、启动服务和执行测试。
- 禁止直接使用裸 `python`、`pip`、`pytest`、`python -m` 作为默认入口；应分别改为 `uv run python ...`、`uv pip ...`、`uv run pytest ...`、`uv sync` 等 `uv` 统一入口。
- 若用户明确要求使用某个非 `uv` 的 Python 入口，或仓库中的现存脚本只能通过非 `uv` 方式工作，需要先在说明中明确偏离原因，再执行对应命令。

---

## 项目定位

`leafergraph` 是一个新的 Leafer-first 实验工程，目标是构建一套干净、可扩展、以 Leafer 为核心渲染宿主的节点图系统。

当前工程不是历史 `litegraph.js` 的直接兼容层，也不是旧架构的简单搬运。默认前提如下：

- 这里优先追求清晰架构，而不是历史兼容。
- 这里优先追求模块边界明确，而不是短期堆功能。
- 这里允许借鉴 `litegraph.js` 的能力设计，但不要把旧项目的技术债直接复制过来。
- 除非任务明确要求，否则不要为旧版 API、旧序列化格式、全局桥接、CJS 行为增加兼容负担。

---

## 目录职责

### 根目录

- `README.md`
  - 说明 workspace 的基本结构与常用命令。
- `docs/`
  - 存放范围定义、设计方案、架构讨论等文档。
- `packages/`
  - 存放实际可运行的子包。
- `templates/`
  - 存放可复制出去的模板工程与模板分类入口。

### `packages/leafergraph`

这是核心库工程，负责节点图底层能力，原则上应包含：

- graph / node / link / group 等核心模型
- 注册机制与运行时能力
- Leafer scene sync / 渲染宿主
- 视口、命中测试、连接、选择等底层交互能力
- 最小可序列化能力

不应把编辑器壳层、复杂面板 UI、页面布局逻辑塞进该包。

### `templates`

这是模板工程目录，负责对外可复制的节点、Widget 和 browser bundle 样例，原则上应包含：

- 节点 / Widget 作者代码样例
- 对外发布用的 `dist/browser/*` 产物示例
- 最小必要的模板说明与构建入口

不应在该目录中反向定义核心模型真源或主包长期 API。

---

## 工作原则

### 1. 先理解，再修改

在开始实现前，至少优先阅读以下内容：

1. `README.md`
2. 与任务最相关的当前维护文档，优先从 `docs/节点API方案.md`、`docs/节点插件接入方案.md`、`packages/leafergraph/内部架构地图.md` 中选择
3. 目标子包的 `package.json`
4. 目标入口文件与直接依赖文件

如果需求涉及架构边界，先确认修改应该落在核心库还是编辑器层，不要为了图省事把逻辑放错位置。

### 2. 保持 Leafer-first

新增功能时，优先围绕 Leafer 的 retained-mode 思路设计：

- 优先考虑 scene graph 同步，而不是临时 imperative 绘制补丁。
- 优先考虑长期可扩展的数据结构，而不是演示性质的临时拼接。
- 优先把“模型层、渲染层、交互层、编辑器壳层”分开。

### 3. 保持边界清楚

任何实现都要先问这三个问题：

1. 这是核心库职责，还是编辑器职责？
2. 这是长期公共能力，还是 demo/页面层行为？
3. 这段代码是否会让后续节点生态、模板化或插件化更难？

如果答案不清楚，优先选更保守、更低耦合的落点。

### 4. 默认不引入历史包袱

除非用户明确要求，否则不要主动加入以下内容：

- 旧版 LiteGraph API 兼容层
- 全局变量桥接
- CommonJS 兼容出口
- 历史序列化修补逻辑
- 仅为迁就旧实现而存在的命名或目录结构

---

## Leafer 文档索引

`leafergraph` 开发时，可以参考同级目录中的 Leafer 官方文档仓库：

- `E:\Code\Node_editor\leafer-docs`

当任务涉及 Leafer 能力选型、布局方式、视口行为、渲染性能时，优先查阅该目录中的相关文档，而不是凭记忆直接实现。

### 总入口

- `E:\Code\Node_editor\leafer-docs\index.md`
  - Leafer 文档站首页入口。
- `E:\Code\Node_editor\leafer-docs\guide\index.md`
  - Guide 入口，适合按主题继续深入。
- `E:\Code\Node_editor\leafer-docs\reference\`
  - 属性、方法、配置项的精确查询入口。
- `E:\Code\Node_editor\leafer-docs\plugin\`
  - 官方插件文档入口，自动布局、视口、编辑器等扩展优先从这里找。

### 布局相关索引

涉及节点排布、容器布局、尺寸变化、视口缩放平移时，优先看下面这些文档：

- `E:\Code\Node_editor\leafer-docs\reference\UI\layout.md`
  - 基础布局属性总入口，重点看 `x`、`y`、`width`、`height`、`scaleX`、`scaleY`、`rotation`、`updateLayout()`。
- `E:\Code\Node_editor\leafer-docs\guide\design\tree.md`
  - 理解 Leafer tree 的布局、事件、渲染接口和局部更新机制，适合建立底层认知。
- `E:\Code\Node_editor\leafer-docs\guide\advanced\viewport.md`
  - 视口平移缩放、design/document/viewport 场景类型与交互方式，适合图编辑器场景。
- `E:\Code\Node_editor\leafer-docs\guide\advanced\bounds.md`
  - 边界与包围盒相关概念，适合处理节点尺寸、命中区域、脏区和局部更新。
- `E:\Code\Node_editor\leafer-docs\guide\advanced\coordinate.md`
  - 坐标转换相关内容，适合做节点命中、拖拽、连线 anchor 和 overlay 同步。
- `E:\Code\Node_editor\leafer-docs\plugin\in\flow\index.md`
  - 自动布局插件总入口，适合做面板、工具栏、属性区或节点内部自动排布。
- `E:\Code\Node_editor\leafer-docs\plugin\in\flow\Flow\flow.md`
  - 布局方向。
- `E:\Code\Node_editor\leafer-docs\plugin\in\flow\Flow\flowAlign.md`
  - 布局对齐方式。
- `E:\Code\Node_editor\leafer-docs\plugin\in\flow\Flow\flowWrap.md`
  - 自动换行策略。
- `E:\Code\Node_editor\leafer-docs\plugin\in\flow\Flow\gap.md`
  - 子元素间距。
- `E:\Code\Node_editor\leafer-docs\plugin\in\flow\Flow\padding.md`
  - 容器内边距。
- `E:\Code\Node_editor\leafer-docs\plugin\in\flow\Flow\autoWidth.md`
  - 剩余空间自动分配宽度。
- `E:\Code\Node_editor\leafer-docs\plugin\in\flow\Flow\autoHeight.md`
  - 剩余空间自动分配高度。
- `E:\Code\Node_editor\leafer-docs\plugin\in\flow\Flow\inFlow.md`
  - 控制子元素是否参与自动布局。

### 布局实现建议

在 `leafergraph` 中做布局时，默认遵守以下顺序：

1. 先确定布局是“图模型坐标布局”还是“UI 容器自动布局”。
2. 图中节点、端口、连线锚点优先使用明确坐标和边界数据，不要盲目依赖自动布局。
3. 编辑器壳层、工具栏、面板、属性区可优先考虑 `Flow` 自动布局。
4. 涉及缩放平移时，先看 `viewport.md`，不要手写一套与 Leafer 机制冲突的视口逻辑。
5. 涉及边界、命中、局部更新时，先确认 `bounds` 和 `coordinate` 语义再实现。

### 性能优化相关索引

涉及大量节点、频繁更新、缩放平移、大面积重绘时，优先查阅：

- `E:\Code\Node_editor\leafer-docs\guide\performance.md`
  - Leafer 性能能力概览，建立对创建速度和内存占用的基本认识。
- `E:\Code\Node_editor\leafer-docs\guide\advanced\partRender.md`
  - 局部渲染与局部布局的关键文档，和本项目关系非常直接。
- `E:\Code\Node_editor\leafer-docs\guide\advanced\bounds.md`
  - 脏区与渲染边界判断的基础。
- `E:\Code\Node_editor\leafer-docs\guide\life\render.md`
  - 渲染生命周期相关内容，适合定位刷新时机。
- `E:\Code\Node_editor\leafer-docs\reference\UI\forceRender.md`
  - 强制渲染行为说明。
- `E:\Code\Node_editor\leafer-docs\reference\UI\forceUpdate.md`
  - 强制更新行为说明。
- `E:\Code\Node_editor\leafer-docs\reference\config\app\canvas.md`
  - App 画布配置相关。
- `E:\Code\Node_editor\leafer-docs\reference\config\app\type.md`
  - 场景类型配置，关系到交互和渲染模式选择。

### 性能优化实现建议

在 `leafergraph` 中做性能相关工作时，默认遵守以下原则：

- 优先利用 Leafer 的局部渲染能力，不要无必要全量重绘。
- 当元素包围盒无法稳定判断时，再考虑关闭局部渲染。
- 当场景里大部分元素都处于高频动态变化状态时，再考虑关闭局部布局。
- 节点图主场景优先减少大范围无差别属性变更，尽量把更新收敛到局部节点、局部连线、局部 overlay。
- 自动布局不是默认最优解；`Flow` 在元素频繁变化时会带来额外性能成本，节点主场景要谨慎使用。
- 视口缩放、平移、选择框、连线预览应优先设计为增量更新，不要每次交互都重建整棵场景树。
- 涉及大批量节点渲染时，优先先做分层、脏区、批量更新策略，再考虑视觉细节。

### 推荐查阅顺序

如果任务同时涉及“布局 + 性能”，建议按这个顺序查：

1. `E:\Code\Node_editor\leafer-docs\guide\design\tree.md`
2. `E:\Code\Node_editor\leafer-docs\reference\UI\layout.md`
3. `E:\Code\Node_editor\leafer-docs\guide\advanced\bounds.md`
4. `E:\Code\Node_editor\leafer-docs\guide\advanced\coordinate.md`
5. `E:\Code\Node_editor\leafer-docs\guide\advanced\viewport.md`
6. `E:\Code\Node_editor\leafer-docs\plugin\in\flow\index.md`
7. `E:\Code\Node_editor\leafer-docs\guide\performance.md`
8. `E:\Code\Node_editor\leafer-docs\guide\advanced\partRender.md`

---

## Leafer 生态推荐

`leafergraph` 开发时，默认优先复用 Leafer 官方生态，而不是为常见能力重复造轮子。

若某项能力已经有官方插件覆盖，应先评估“直接使用 / 小范围封装 / 局部适配”，再决定是否自研。

### 基础原则

- 底座渲染默认使用 `leafer-ui`
- 图编辑器常见能力优先从 `@leafer-in/*` 生态中选择
- 只有当官方插件无法满足架构边界、性能目标或定制深度时，才考虑自研替代
- 自研前要先说明为什么官方方案不适合当前场景

### 官网侧边栏插件清单

根据 Leafer 官网插件中心侧边栏，当前可以看到的官方插件分类至少包括：

- 视口：`@leafer-in/viewport`
- 视图控制：`@leafer-in/view`
- 滚动条：`@leafer-in/scroll`
- Arrow：`@leafer-in/arrow`
- HTML：`@leafer-in/html`
- 文本编辑：`@leafer-in/text-editor`
- 运动路径：`@leafer-in/motion-path`
- Robot：`@leafer-in/robot`
- 交互状态：`@leafer-in/state`
- 查找元素：`@leafer-in/find`
- 导出元素：`@leafer-in/export`
- 滤镜：`@leafer-in/filter`
- color：`@leafer-in/color`
- resize：`@leafer-in/resize`

不是所有插件都需要在 `leafergraph` 中默认引入，但做能力设计时，应优先检查这些官方插件能否覆盖当前需求。

### 推荐包与适用场景

#### `leafer-ui`

作为基础渲染与场景树底座使用，负责：

- `App` / `Group` / `Rect` / `Path` / `Text` 等基础显示对象
- 场景树、基础布局、事件、渲染宿主
- `leafergraph` 核心库的默认显示层基础

这是默认基础依赖，不应被替换为临时自绘方案。

#### `@leafer-in/state`

适用于交互状态与样式切换，优先用于：

- 节点 hover / selected / disabled / focus / press 状态
- 端口悬停、高亮、选中反馈
- 工具栏按钮、面板项、图元交互反馈
- 通过 `state` / `states` 管理可切换的视觉状态

推荐原则：

- 节点选中态、悬停态、禁用态优先用状态插件表达，不要在业务层散落手写样式切换
- 交互态与视觉态尽量通过统一状态入口驱动
- 如果需要过渡动画，再考虑配合动画能力，而不是把动画逻辑写死在事件回调里

#### `@leafer-in/viewport`

适用于视口缩放平移，优先用于：

- 节点画布缩放
- 画布平移
- 滚轮 / 触控板 / 捏合视口交互
- design 类编辑器视图控制基础能力

推荐原则：

- 主工作区的 pan / zoom 优先建立在 `viewport` 能力之上
- 不要先手写一套与 Leafer 视口模型割裂的滚轮缩放逻辑
- 如需 design/document 类型约束，优先参考官方视口类型语义

#### `@leafer-in/view`

适用于编排式视图控制，优先用于：

- `fit`
- `fit-width`
- `fit-height`
- 聚焦到节点、节点组、选区、某个区域
- 编辑器初始化时的自动居中与视图归位

推荐原则：

- “视口存在”与“如何控制视口”分开处理
- `viewport` 负责基础交互，`view` 负责 fit / zoom / focus 等命令式控制
- 避免在业务代码里散落重复的居中、缩放边界计算

#### `@leafer-in/resize`

适用于调整元素或组元素包围盒大小，优先用于：

- 节点尺寸调整
- 分组框尺寸调整
- 容器型图元 resize
- 与自动布局或编辑器控制点配合的尺寸变化

推荐原则：

- 需要稳定 resize 语义时，优先使用官方 resize 能力
- 不要为了“拖一下边框”就自行发明一套尺寸更新协议
- 与节点最小尺寸、端口重排、内容重算配合时，要明确触发顺序

#### `@leafer-in/flow`

适用于自动布局，优先用于：

- 编辑器壳层
- 侧边栏、工具栏、面板区
- 节点内部相对静态的内容排布
- 需要 `gap` / `padding` / `flowAlign` / `autoWidth` / `autoHeight` 的容器

不建议默认用于：

- 高频动态变化的主图场景
- 节点大量实时增删、移动、连线过程中依赖自动布局的核心画布层

推荐原则：

- 面板 UI 可以优先考虑 `Flow`
- 主图节点坐标布局优先使用明确几何数据，不要把节点主场景建立在自动布局上
- 遇到频繁变化场景，先评估 `Flow` 的性能成本

#### `@leafer-in/arrow`

适用于连线方向表达，优先用于：

- 节点连线箭头
- 连线终点方向提示
- 流向、依赖方向、执行方向的视觉强化

推荐原则：

- 需要标准箭头、角度箭头、三角箭头时，优先使用官方箭头能力
- 自定义箭头样式前，先评估内置箭头是否足够
- 连线主体路径与箭头表达尽量走同一条官方能力链，减少自绘分叉

#### `@leafer-in/find`

适用于查找元素，优先用于：

- 按 `id`、`innerId`、`className`、`tag` 查找节点
- 按条件批量筛选节点、端口、连线宿主
- 查找“新增 / 删除 / 变化”的 diff 节点集合
- 局部刷新、局部高亮、局部统计、批量标记

推荐原则：

- 做节点 diff 时，优先考虑给节点打 `tag` / `className` / `id`，再用 `find()` / `findOne()` 查询，不要每次都手写整棵树遍历
- 对比前后状态时，可把变化节点集中打上统一标记，例如 `changed`、`added`、`removed`
- 批量高亮、批量选中、批量更新前，先用 `find()` 收敛目标集合，再执行后续逻辑
- 如果需求只是“找一个目标节点”，优先使用 `findOne()`，避免不必要的全量结果集

用于 diff 节点时，推荐思路：

- 先在模型层算出差异节点 ID 集合
- 再把对应 Leafer 节点写入统一 `tag` 或 `className`
- 最后通过 `find()` 拉出变化节点集合，执行高亮、描边、状态切换或局部更新

不推荐做法：

- 每次交互都从根节点手写递归扫描全部场景树
- 把节点查找逻辑散落在多个控制器里重复实现
- 把 diff 集合维护和视觉查询逻辑耦死在同一个模块里

#### `@leafer-in/scroll`

适用于无限画布滚动条，优先用于：

- 主画布需要明确滚动反馈时
- 需要横向 / 纵向滚动条提示当前视图位置时
- 大画布、文档式或设计器式工作区

推荐原则：

- 如果产品形态需要更强的视图位置感知，可在 `viewport + view` 之上补 `scroll`
- 深色画布可优先使用 `dark` 主题，浅色画布可优先使用 `light` 主题
- 不要在已有官方滚动条能力的情况下再单独造一套 DOM 滚动条替身

#### `@leafer-in/export`

适用于导出元素，优先用于：

- 导出节点图截图
- 导出局部节点区域
- 调试时输出当前选区或当前图层结果
- 后续做分享、快照、导出图片功能

推荐原则：

- 导出能力优先走官方导出链路
- 不要先在业务层拼接临时截图方案，再绕开 Leafer 的导出能力

#### `@leafer-in/html`

适用于在 Leafer 中承载 HTML 富文本，优先用于：

- 少量富文本说明
- 节点内需要展示复杂格式文本时
- 画布中嵌入受控 HTML 内容时

注意事项：

- 当前主要适用于 web
- 不要把它当成节点主渲染方案
- 节点主结构、端口、连接反馈仍应优先使用原生 Leafer 图元

#### `@leafer-in/text-editor`

适用于文本编辑，优先用于：

- 双击编辑文本节点
- 节点标题或说明文字的直接编辑
- 需要画布内联文本编辑体验的场景

注意事项：

- 依赖图形编辑器插件能力
- 当前主要适用于 web 平台 PC 端
- 没有明确文本编辑需求前，不要提前引入这一层复杂度

#### `@leafer-ui/worker`

适用于需要把渲染放到 Worker 的场景，优先用于：

- 超大场景
- 高密度绘制
- 明确存在主线程压力的场景
- 经 profiling 证明确有必要的性能优化阶段

注意事项：

- Worker 环境不能直接操作 DOM
- 没有性能证据前，不要提前把架构复杂化
- 只有在主线程方案成为瓶颈时，再评估引入 Worker 版本

### 组合建议

对于 `leafergraph` 这类节点编辑器，推荐的默认组合是：

- 基础渲染：`leafer-ui`
- 交互状态：`@leafer-in/state`
- 视口交互：`@leafer-in/viewport`
- 视图控制：`@leafer-in/view`
- 尺寸调整：`@leafer-in/resize`
- 连线箭头：`@leafer-in/arrow`
- 节点筛选与 diff 查询：`@leafer-in/find`

如需自动布局，仅在合适区域补充：

- 面板和壳层布局：`@leafer-in/flow`

如需增强编辑器能力，可按场景补充：

- 大画布滚动反馈：`@leafer-in/scroll`
- 截图和导出：`@leafer-in/export`
- 富文本承载：`@leafer-in/html`
- 文本内联编辑：`@leafer-in/text-editor`

如需更高性能的异步渲染路线，再评估：

- `@leafer-ui/worker`

### 不推荐的默认做法

- 不要为 hover / selected / disabled 这类状态先手写一套自定义状态系统，再忽略 `@leafer-in/state`
- 不要为 pan / zoom 先手写一套浏览器事件逻辑，再绕开 `@leafer-in/viewport`
- 不要把节点 diff 查找先实现成一套长期手写递归扫描，再忽略 `@leafer-in/find`
- 不要把 `Flow` 当作主图节点布局的默认解法
- 不要在尚未确认瓶颈前就引入 Worker 复杂度
- 不要因为官方有 `leafer-editor` 就直接把它当作 `leafergraph` 的实现基础；本项目目标仍是自建干净的节点图系统

### 选择顺序建议

当需要新增某类能力时，按这个顺序决策：

1. Leafer 官方基础能力是否已覆盖
2. `@leafer-in/*` 是否已有合适插件
3. 能否通过薄封装满足当前架构
4. 若仍不适合，再实现项目自有能力

---

## 开发命令

在 `E:\Code\Node_editor\leafergraph` 根目录下使用：

```bash
bun install
bun run build:node
bun run build:authoring
bun run build:leafergraph
```

### Bun Workspace 注意事项

- `leafergraph` 是 Bun monorepo。模板工程或子包只要依赖仓库内其他包，必须在根 `package.json` 的 `workspaces` 中声明，并使用 `workspace:*`，不要写成会去 npm registry 拉取的普通版本号。
- `link:` 仅用于 `bun link` 注册过的本地包，不作为本仓库 workspace 包互相依赖的默认写法。
- 新增模板或子包后，优先在 `E:\Code\Node_editor\leafergraph` 根目录执行 `bun install`；如果直接在子目录执行 `bun install`，也必须先确认该目录已经被根 workspace 纳入。
- Bun 默认会安装 `peerDependencies`。如果模板工程只是本仓库内开发样例，不希望额外触发 peer 安装或误拉外部 registry，优先在模板目录增加 `bunfig.toml` 并设置 `[install] peer = false`。
- 如果安装过程被中断，可能留下不完整的 `node_modules`、临时锁文件或缓存拷贝残留，重试前应先检查目录状态，避免把半安装状态误判成依赖规则错误。

要求如下：

- 涉及核心库改动时，至少执行 `bun run build:leafergraph`
- 涉及模型层改动时，至少执行 `bun run build:node`
- 涉及作者层改动时，至少执行 `bun run build:authoring`
- 涉及跨包改动时，优先执行受影响包对应的 `build:*` 命令
- 如果因为环境问题无法完成验证，必须在最终说明中明确写出未验证项

---

## 编码规范

### 通用要求

- 默认使用 TypeScript
- 优先使用 ES Module
- 尽量保持函数短小、职责单一、命名明确
- 非必要不要引入新的运行时依赖
- 非必要不要引入 `any`
- 非必要不要通过隐式全局状态传递数据
- 非必要不要把多个无关改动混在同一次变更中
- 注释与文档默认使用中文，避免出现英文与中文混用导致的风格割裂

### 核心库要求

核心库代码应优先满足以下标准：

- 先有清晰模型，再有渲染表达
- 公共 API 应稳定、简洁、可推断
- 渲染宿主与业务数据尽量分离
- 交互控制器不要直接承担 UI 壳层布局职责
- 新增能力优先考虑后续模板化节点和外部节点接入

### 模板与宿主接入要求

模板代码和外部宿主接入说明应优先满足以下标准：

- 模板负责样例和产物组织，不反向定义核心库边界
- browser bundle 接入说明要和正式主包 API 明确分层
- 宿主状态与图运行时状态要尽量解耦
- 演示代码、正式能力、实验性代码尽量分目录或分模块放置

### 注释与文档

- 注释只写必要信息，不写废话注释
- 复杂约束、非直觉设计、重要权衡应写注释或补文档
- 如果实现改变了架构边界、目录职责或对外使用方式，应同步更新相关文档

---

## 文件与模块组织规范

### 新增代码时的默认放置原则

- 图模型、运行时、渲染、交互基础能力：放到 `packages/leafergraph`
- 模板说明、外部宿主接入说明与架构决策：放到 `docs/` 或 `templates/` 对应目录
- 设计说明、范围讨论、架构决策：放到 `docs/`

### 避免以下问题

- 在 `editor` 内复制一份核心逻辑
- 在 `leafergraph` 内混入大量页面 UI 代码
- 单文件同时承担模型、渲染、交互、UI 四种职责
- 用临时 demo 数据结构替代正式领域模型但不做标注

---

## 变更标准

### 提交前最低要求

完成改动后，应尽量确认：

- 改动是否放在正确目录
- 导出是否合理
- 命名是否与当前工程语义一致
- 构建是否通过
- 文档是否需要同步

### 对“实验代码”的要求

即使是实验工程，也不能把代码写成纯临时堆砌。实验性质的实现也应满足：

- 目的明确
- 边界明确
- 后续可替换
- 不误导后续维护者

如果某段代码只是占位实现，请明确标出其阶段性目的。

---

## Git 规范

### 必须使用中文提交信息

本项目中，所有 `git commit` 的提交说明必须使用中文。

硬性要求如下：

- 不允许只写英文提交信息
- 不允许只写无意义缩写，如 `fix`、`update`、`misc`
- 不允许把多个不相关主题混在同一个提交说明中
- 提交说明要能直接表达“做了什么”和“为什么做”

### 推荐格式

推荐使用以下格式：

```text
类型: 简要说明
```

可选类型示例：

- `新增`
- `修复`
- `重构`
- `文档`
- `测试`
- `构建`
- `样式`
- `性能`

### 合格示例

```text
新增: 搭建 LeaferGraph 节点卡片基础渲染
修复: 处理编辑器卸载时未销毁图实例的问题
重构: 拆分视口挂载逻辑并收敛生命周期管理
文档: 补充 LeaferGraph 范围与设计方案说明
测试: 增加核心库构建前的类型检查脚本
```

### 不合格示例

```text
fix bug
update
misc
refactor graph
stuff
```

### 提交粒度要求

- 一个提交只做一个主题
- 重构与功能新增尽量分开提交
- 样式调整与逻辑修复尽量分开提交
- 文档补充如果强依赖代码改动，可与代码同提交；否则单独提交更好

---

## 禁止事项

在未明确说明原因时，禁止以下做法：

- 直接复制大段 `litegraph.js` 历史实现到本工程
- 为了短期跑通而破坏核心库与编辑器边界
- 在未验证的情况下声称“已经可用”
- 修改公共 API 却不更新调用处和文档
- 引入与当前目标无关的复杂抽象
- 把临时调试代码直接留在主路径中

---

## 推荐协作方式

进行较大改动时，建议按以下顺序推进：

1. 明确改动落点与边界
2. 先搭最小可运行结构
3. 再补类型、导出与目录整理
4. 执行构建验证
5. 更新必要文档
6. 使用中文撰写清晰提交说明

---

## 最终交付要求

完成任务后，说明中应尽量包含：

- 改了什么
- 为什么这样改
- 验证了什么
- 哪些地方尚未验证
- 是否需要继续补下一步

如果已经执行 `git commit`，提交信息必须为中文。
