# Timer Node Package Template

这份模板是“前后端一体节点包”的最小基线，目标是把：

- 前端节点/Widget 与 demo bundle
- Node 后端执行器
- Python 后端执行器

收口到同一个包目录里，由后端在运行时加载并推送前端源码给 editor 自动注册。

## 目录结构

```text
templates/timer-node-package-template/
  README.md
  packages/
    timer/
      package.manifest.json
      frontend/
        node.iife.js
        demo.iife.js
      backend/
        node/
          executors.cjs
        python/
          executors.py
```

## 角色边界

### 需要改

- `package.manifest.json` 的 `packageId/version/nodeTypes/frontendBundles`。
- `frontend/*.iife.js` 内的节点定义、demo 文档与显示文案。
- `backend/node/executors.cjs` 与 `backend/python/executors.py` 的业务执行语义。
- 如果节点带有可编辑运行配置，前后端执行器也要一起维护这套配置的读写约定。

### 按需改

- 是否拆更多 bundle（例如单独 widget bundle）。
- nodeTypes 与执行器的映射策略。
- bundle 的依赖关系（`requires`）与默认启用态（`enabled`）。

### 不要改

- manifest 基本结构：`packageId/version/frontendBundles/backend/nodeTypes`。
- bundle 槽位语义：`demo/node/widget`。
- 后端推送事件的基本形状：`frontendBundles.sync`。

## 节点开发约定

这次 `system/timer` 的远端问题已经收口成一套节点侧约定，后续做新的“一体化节点包”时建议直接沿用。

### 1. 运行配置优先走“同名 widget + 同名 property”

如果一个节点的运行行为会被前端 widget 改动，例如：

- `intervalMs`
- `immediate`
- 其他会直接影响执行频率、分支、输入输出格式的配置

建议固定采用下面这组结构：

- widget 的 `name` 与 property 的 `name` 保持同名。
- `properties` 作为正式持久化事实源。
- `widgets` 作为 editor 内部编辑镜像。

也就是说，像 `system/timer` 这样的节点，前端定义里：

- `widgets[].name = "intervalMs"` 对应 `properties.intervalMs`
- `widgets[].name = "immediate"` 对应 `properties.immediate`

不要把“界面可编辑值”和“后端真正读取的值”拆成两套不同名字，否则远端 authority 下很容易出现“widget 看起来改了，但执行器没生效”。

### 2. 后端执行器读取顺序固定为“widget 优先，property 回退”

Node / Python 执行器现在已经按下面的顺序解析 timer 配置：

1. 先读同名 widget 值
2. widget 缺失时，再回退到 `properties`
3. 解析后把规范化结果同时写回 `properties` 和 `widgets`

这样做的目的有两个：

- editor 远端提交 `node.update` 时，即使只先改到了 widget，也不会导致后端继续读旧配置。
- 后端每次运行后回推的文档快照里，`widgets` 和 `properties` 始终保持一致，不会越跑越分叉。

如果后续新增节点也有类似行为，请保持同样模式：

- `resolveConfig(widgetValue ?? propertyValue)`
- `properties.xxx = normalizedValue`
- `widgets[name=xxx].value = normalizedValue`

### 3. 节点包不要依赖前端本地补偿运行

像 timer 这类会持续触发的节点，在 remote authority 模式下要以后端运行为准：

- Node 后端执行器负责真正的循环调度
- Python 后端执行器负责真正的循环调度
- editor 只负责展示 authority 回推的文档和 runtime feedback

节点包本身不要假设前端会帮你补一次本地执行，也不要把“远端运行是否继续”的判断塞进前端 bundle。节点行为应该完整收口在后端执行器里。

### 4. Timer 当前语义

`system/timer` 现在固定遵守这些规则：

- `graph.play` 下持续循环触发
- `graph.step` 命中 timer 后升级成 `running`
- `node.play` 只执行一次，不进入循环
- 重复收到 `Start` 时重置并重新计时
- `intervalMs` 非法时回退默认值
- `immediate` 缺省视为 `true`

如果你把这个模板扩成新的节点包，建议把这类“前后端必须完全一致”的执行语义也写进各自 README，而不是只留在实现里。
