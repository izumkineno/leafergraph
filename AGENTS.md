# AGENTS.md

## 适用范围

本文件适用于目录 `E:\Code\leafergraph` 及其全部子目录。

在本目录内工作的代理、协作者或自动化工具，应优先遵守本文件；若上层目录也存在 `AGENTS.md`，则以更靠近当前工作目录的文件为准。

---

#### 工作区命令与进程约束

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

`leafergraph` 是一个 Leafer-first workspace，目标是构建一套干净、可扩展、以 Leafer 为核心渲染宿主的节点图系统。

当前工程不是历史 `litegraph.js` 的直接兼容层，也不是旧架构的简单搬运。默认前提如下：

- 这里优先追求清晰架构，而不是历史兼容。
- 这里优先追求模块边界明确，而不是短期堆功能。
- 这里允许借鉴 `litegraph.js` 的能力设计，但不要把旧项目的技术债直接复制过来。
- 除非任务明确要求，否则不要为旧版 API、旧序列化格式、全局桥接、CJS 行为增加兼容负担。

---

## 目录职责

### 根目录

- `README.md`
  - workspace 总入口，说明当前包分层、命令面和文档导航。
- `docs/`
  - 存放事实型专题、AI 索引和提案总览。
- `packages/`
  - 存放正式包源码。
- `example/`
  - 存放当前仍在维护的示例工程。
- `templates/`
  - 存放对外可复制的模板工程。
- `注意事项.md`
  - 存放跨任务复用的踩坑记录，不写方案草案。

### `packages/leafergraph`

这是核心运行时主包，负责：

- 图运行时装配
- Leafer scene 与渲染宿主
- 视口、命中测试、连接、选择等底层交互能力
- 对外实例 façade

它不应承接：

- editor 壳层
- 复杂面板 UI
- 外部宿主的 bundle catalog、authority transport 或页面布局逻辑

### `templates`

这里存放可复制出去的作者层和 browser bundle 模板，原则上应包含：

- 节点 / Widget 作者代码样例
- 对外发布用的 `dist/browser/*` 产物示例
- 最小必要的模板说明与构建入口

不应在这里反向定义核心模型真源或主包长期 API。

---

## 工作原则

### 1. 先理解，再修改

在开始实现前，至少优先阅读以下内容：

1. `README.md`
2. 与任务最相关的当前维护文档，优先从 `docs/节点API方案.md`、`docs/节点插件接入方案.md`、`packages/leafergraph/内部架构地图.md`、`docs/架构演进与提案总览.md` 中选择
3. 目标子包的 `package.json`
4. 目标入口文件与直接依赖文件

如果需求涉及架构边界，先确认修改应该落在核心库还是外层宿主，不要为了图省事把逻辑放错位置。

### 2. 保持 Leafer-first

新增功能时，优先围绕 Leafer 的 retained-mode 思路设计：

- 优先考虑 scene graph 同步，而不是临时 imperative 绘制补丁。
- 优先考虑长期可扩展的数据结构，而不是演示性质的临时拼接。
- 优先把“模型层、渲染层、交互层、宿主壳层”分开。

### 3. 保持边界清楚

任何实现都要先问这三个问题：

1. 这是核心库职责，还是宿主 / 示例职责？
2. 这是长期公共能力，还是 demo / 页面层行为？
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

`leafergraph` 开发时，可以参考 Leafer 官方文档仓库：

- `E:\Code\Node_editor\dora_workbench\libs\leafer-docs`

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
- `E:\Code\Node_editor\leafer-docs\guide\design\tree.md`
- `E:\Code\Node_editor\leafer-docs\guide\advanced\viewport.md`
- `E:\Code\Node_editor\leafer-docs\guide\advanced\bounds.md`
- `E:\Code\Node_editor\leafer-docs\guide\advanced\coordinate.md`
- `E:\Code\Node_editor\leafer-docs\plugin\in\flow\index.md`

### 性能优化相关索引

涉及大量节点、频繁更新、缩放平移、大面积重绘时，优先查阅：

- `E:\Code\Node_editor\leafer-docs\guide\performance.md`
- `E:\Code\Node_editor\leafer-docs\guide\advanced\partRender.md`
- `E:\Code\Node_editor\leafer-docs\guide\advanced\bounds.md`
- `E:\Code\Node_editor\leafer-docs\guide\life\render.md`
- `E:\Code\Node_editor\leafer-docs\reference\UI\forceRender.md`
- `E:\Code\Node_editor\leafer-docs\reference\UI\forceUpdate.md`
- `E:\Code\Node_editor\leafer-docs\reference\config\app\canvas.md`
- `E:\Code\Node_editor\leafer-docs\reference\config\app\type.md`
