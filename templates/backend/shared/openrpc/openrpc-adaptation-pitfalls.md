# OpenRPC 适配踩雷清单

这份文档专门给“要接入这套 authority OpenRPC 契约的人”看。

它不重复解释全部 method/schema 细节，而是集中记录最容易踩雷的边界、常见误判和建议做法。

## 1. 不要把 OpenRPC 当成“只有 discover 才会用到的文档”

最常见的误解是：

- 先手写一套服务端 method 常量
- 先手写一套客户端 notification 名字
- 最后再补一个 `rpc.discover`，把 OpenRPC 当展示文档

这在当前仓库里是反过来的。

这里的固定规则是：

- `templates/backend/shared/openrpc/authority.openrpc.json` 是唯一协议真源
- `rpc.discover` 必须直接返回这份文档本体
- Node / Python / editor 三端常量都要与它保持同名

如果你先改代码、后补文档，最后通常会出现：

- discover 返回值和真实实现不一致
- editor 订阅的 notification 名与后端发出的名不一致
- 测试里 method 名正确，但 schema 已经过期

建议做法：

- 先改 OpenRPC 真源
- 再改三端常量与实现
- 最后跑 discover 一致性测试

## 2. `GET /health` 不属于 OpenRPC

这条边界很容易在接入时被误合并。

当前 authority 通道是两条并存的线：

- `GET /health`
- `WS /authority`

其中只有 `WS /authority` 走 JSON-RPC 2.0 + OpenRPC 契约。

不要把下面这些东西塞进 OpenRPC：

- 健康检查响应
- 端口存活探针
- 连接计数或部署态诊断字段

也不要反过来把 method 请求发到 `/health`。

## 3. `rpc.discover` 返回的是“文档本体”，不是自定义 wrapper

这里故意没有再包一层：

```json
{
  "document": { "...": "..." }
}
```

也没有额外加：

```json
{
  "methods": [...],
  "notifications": [...],
  "version": "..."
}
```

固定语义只有一条：

- `rpc.discover` 的 `result` 就是完整 `authority.openrpc.json`

如果你再包一层，最容易炸的地方有：

- editor 或测试侧做“精确相等”断言时失败
- 生成器读取 discover 结果时额外写一层 unwrap 逻辑
- 多语言客户端把 discover 当成特殊 case 处理

## 4. wire 上的动作名全靠 `method`，不要再包旧 envelope

这套协议已经不再使用旧式：

- `authority.request`
- `authority.response`
- `authority.event`

也不再使用：

- `params.type = "authority.submitOperation"`
- `params.payload = {...}`

现在的固定形状是：

- request: `method` 直接是动作名
- notification: `method` 直接是事件名
- `params` 只放该动作自己的业务参数

错误做法通常长这样：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "authority.request",
  "params": {
    "type": "authority.getDocument"
  }
}
```

正确做法是：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "authority.getDocument"
}
```

## 5. notification 不要再塞一层 `{ type: ... }` 外壳

当前 notification 名固定只有 3 个：

- `authority.document`
- `authority.runtimeFeedback`
- `authority.frontendBundlesSync`

wire 上表达事件种类时：

- 第一层由 JSON-RPC `method` 表达
- 第二层如果是联合事件，再由 `params.type` 表达内部事件类型

例如：

- `authority.runtimeFeedback` 的 `params.type` 可以是 `graph.execution`
- 但外层 `method` 仍然必须是 `authority.runtimeFeedback`

不要把它写成：

```json
{
  "jsonrpc": "2.0",
  "method": "authority.event",
  "params": {
    "type": "authority.runtimeFeedback",
    "event": {
      "type": "graph.execution"
    }
  }
}
```

## 6. 业务拒绝不是 JSON-RPC error

这点在运行控制和图操作上特别容易写错。

当前固定约定是：

- 协议层错误走 JSON-RPC `error`
- 业务层拒绝走正常 `result`

也就是说：

- 非法 JSON: `-32700`
- 非法 request: `-32600`
- 未知 method: `-32601`
- 非法 params: `-32602`
- 服务内部异常: `-32603`

但下面这些都不应该直接抛 JSON-RPC error：

- 图里没有 `system/on-play`
- 节点不存在
- 当前运行状态不允许执行某个动作
- 业务决定 `accepted=false`

这些场景应该返回合法 `result`，例如：

```json
{
  "accepted": false,
  "changed": false,
  "reason": "图中没有 On Play 入口节点"
}
```

如果你把业务拒绝直接映射成 `error`，前端通常会把它当成“协议坏了”而不是“动作被拒绝了”。

## 7. 宽松 schema 不等于字段可以随便改名

当前文档里确实有一部分字段故意保留宽松：

- `meta`
- 节点 `properties`
- 节点 `data`
- runtime `payload`
- 某些 widget/property `options`

这表示：

- 这些字段的内部业务内容可扩展

不表示：

- 顶层字段名可以改
- 判别字段可以丢
- 稳定对象结构可以随意换层级

最常见的误判是“schema 里这里是 object，所以我可以把 `node.update.input` 整体换成另一套 shape”。这会直接破坏跨语言兼容。

## 8. `oneOf` 联合必须保住判别字段

这套 schema 里大量联合都依赖判别字段，例如：

- `GraphOperation.type`
- `RuntimeControlRequest.type`
- `RuntimeFeedbackEvent.type`
- 部分 bundle/source/event 子对象里的 `type` / `mode` / `format`

接入时最容易出现两类问题：

- 代码生成侧没有保住判别字段，最后全退化成 `dict[str, Any]`
- 手写模型把不同分支揉成一个“大对象 + 一堆可选字段”

前者会让校验失效，后者会让非法组合也通过。

建议做法：

- 生成器和手写模型都优先保住判别字段
- 校验时优先根据判别字段分派分支
- 不要把联合模型压扁成“全字段 optional”

## 9. 前端最容易把 runtime feedback 和 document restore 打架

如果后端每个 tick 都推整份 `authority.document`，前端很容易出现：

- runtime feedback 刚投影出动画
- 紧接着整图 restore 把动画态冲掉

这不是 OpenRPC schema 的问题，而是 authority 适配层的行为问题。

当前模板里已经采用的经验是：

- 运行中的文档变化先在后端内部缓存
- 在安全边界再 flush 成 `authority.document`
- runtime feedback 继续实时推送

如果你在新后端里看见“协议都对，但前端没有动画”，先不要急着怀疑 editor，先检查是不是 document 推送策略把动画冲掉了。

## 10. 外部文档修改要区分 structural 和 live-safe

运行中最容易踩的另一个坑，是把所有文档变更都当成“必须停机重建”。

当前更稳妥的分类是：

- `structural`
  - 改图结构，会停止当前运行
- `live-safe`
  - 只改值级字段，可以热应用

通常可以视为 `live-safe` 的变更：

- `document.update`
- `node.move`
- `node.resize`
- 只改 `title / properties / widgets / data / flags` 的 `node.update`

如果你把 widget/property 修改也当成 structural，最直观的用户感受就是：

- 一边运行一边调参数
- 图立刻被后端停掉

## 11. `_generated/` 不是第二份协议真源

Python OpenRPC 模板里有按需生成的 `_generated/` 目录，但它只是派生产物。

不要做这些事：

- 先手改 `_generated/models.py`
- 手改 `_generated/methods.py`
- 让 `_generated/` 比 OpenRPC 真源更新得更快

正确顺序永远是：

1. 改 `authority.openrpc.json` 或共享 schema
2. 跑生成器
3. 让服务端、客户端、测试一起追齐

如果你发现“改完 schema 但 Python 端还是旧模型”，先检查生成链是否重新执行，而不是继续补手写兼容层。

## 12. 最后检查这 5 个地方，能挡掉大多数接入事故

每次改协议或接入新后端前，至少确认：

1. `authority.openrpc.json` 的 method / notification 名是否已经更新
2. `rpc.discover` 返回值是否与共享文档精确一致
3. 服务端常量与 editor 常量是否仍然同名
4. `-32700 / -32600 / -32601 / -32602 / -32603` 是否仍按协议层错误使用
5. 运行中 widget/property 修改是否会误停机或误触发整图 restore

如果这 5 项都过了，通常已经避开了 OpenRPC authority 适配中最常见的坑。
