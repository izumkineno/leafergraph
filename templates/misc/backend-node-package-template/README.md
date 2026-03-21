# Backend Node Package Template

这份模板是“后端驱动节点包”的最小基线，示例包仍使用 `timer` 作为业务样例。

## 目录结构

```text
templates/misc/backend-node-package-template/
  README.md
  packages/
    timer/
      package.manifest.json
      frontend/
        node.bundle.json
        demo.bundle.json
      backend/
        node/
          executors.cjs
        python/
          executors.py
```

## 角色边界

### 需要改

- `package.manifest.json` 的包元信息、前端 bundle 声明与后端执行器入口。
- `frontend/*.bundle.json` 里的节点定义、demo 文档与展示文案。
- `backend/node/*` 与 `backend/python/*` 的业务执行语义。

### 不要改

- manifest 的基本结构。
- `node/demo/widget` 槽位语义。
- 后端通过 `authority.frontendBundlesSync` 推送结构化前端 bundle 的契约。

## 前端 bundle 格式

当前模板固定采用三类前端内容格式：

- `node-json`
  - 只承载声明式 `NodeDefinition`
- `demo-json`
  - 只承载正式 `GraphDocument`
- `script`
  - 只留给 `widget` 或必须执行前端逻辑的 bundle

当前 `timer` 示例里：

- `frontend/node.bundle.json` 使用 `node-json`
- `frontend/demo.bundle.json` 使用 `demo-json`
- 暂时没有 `widget` 脚本 bundle

也就是说，`node/demo` 已经不再依赖 IIFE 自注册；后端会解析这些 JSON，然后直接通过 `authority.frontendBundlesSync` 推送结构化内容给 editor。

## 节点开发约定

### 1. 运行配置优先走“同名 widget + 同名 property”

如果一个节点的运行行为会被前端 widget 改动，例如：

- `intervalMs`
- `immediate`

建议固定采用下面这组结构：

- widget 的 `name` 与 property 的 `name` 保持同名
- `properties` 作为正式持久化事实源
- `widgets` 作为 editor 内部编辑镜像

### 2. 后端执行器读取顺序固定为“widget 优先，property 回退”

Node / Python 执行器建议按下面顺序解析配置：

1. 先读同名 widget 值
2. widget 缺失时再回退到 `properties`
3. 解析后把规范化结果同时写回 `properties` 和 `widgets`

### 3. 节点包不要依赖前端本地补偿运行

remote authority 模式下要以后端运行为准：

- Node 后端执行器负责真正的循环调度
- Python 后端执行器负责真正的循环调度
- editor 只负责展示 authority 回推的文档和 runtime feedback

### 4. `node-json` 只放静态定义

`node-json` 只允许声明式字段，例如：

- `type`
- `title`
- `properties`
- `widgets`
- `inputs`
- `outputs`
- `size`
- `resize`

不要把生命周期函数塞进 JSON；如果需要前端执行逻辑，就应该退回 `script` bundle。
