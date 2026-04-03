# @leafergraph/diff

LeaferGraph diff 功能包，提供文档差异计算、应用和传输的完整解决方案。

## 功能特性

- **核心 diff 引擎**：计算两个文档之间的差异
- **Find 更新器**：支持按 ID、路径、条件等方式查找和更新节点
- **运行时投影**：将 diff 增量投影到运行时视图
- **传输适配器**：支持 HTTP、WebSocket、消息队列等多种传输协议
- **工具函数**：提供深度克隆、验证、合并等辅助功能
- **类型安全**：完整的 TypeScript 类型定义

## 安装

```bash
# 使用 npm
npm install @leafergraph/diff

# 使用 pnpm
pnpm add @leafergraph/diff

# 使用 yarn
yarn add @leafergraph/diff
```

## 快速开始

### 1. 计算文档差异

```typescript
import { DiffEngine } from '@leafergraph/diff';

const engine = new DiffEngine();

// 计算差异
const diff = engine.computeDiff(oldDocument, newDocument);

// 应用差异
const result = engine.applyDiff(currentDocument, diff);

if (result.success) {
  console.log('Diff applied successfully');
  console.log('Affected nodes:', result.affectedNodeIds);
  console.log('Affected links:', result.affectedLinkIds);
} else {
  console.log('Diff application failed:', result.reason);
  if (result.requiresFullReplace) {
    console.log('Needs full document replace');
  }
}
```

### 2. 使用 Find 更新器

```typescript
import { FindUpdater } from '@leafergraph/diff';

const updater = new FindUpdater(document);

// 按 ID 查找节点
const node = updater.findById('node1');

// 按 ID 更新节点
updater.updateById('node1', {
  title: 'Updated Node',
  layout: {
    x: 200,
    y: 200
  }
});

// 批量更新
const batchResult = updater.batchUpdate([
  { id: 'node1', changes: { title: 'Node 1' } },
  { id: 'node2', changes: { title: 'Node 2' } }
]);

console.log('Batch update result:', batchResult);
```

### 3. 使用运行时投影器

```typescript
import { DiffProjector } from '@leafergraph/diff';

const projector = new DiffProjector();

// 投影 diff 到运行时
const result = projector.project(currentDocument, diff);

if (result.success) {
  console.log('Diff projected successfully');
  console.log('Updated document:', result.document);
}
```

### 4. 使用传输适配器

#### HTTP 传输

```typescript
import { HttpTransportAdapter } from '@leafergraph/diff';

const adapter = new HttpTransportAdapter({
  url: 'http://localhost:3000/api/diff'
});

// 发送 diff
await adapter.connect();
await adapter.send(diff);

// 接收 diff
const receivedDiff = await adapter.receive();
await adapter.disconnect();
```

#### WebSocket 传输

```typescript
import { WebSocketTransportAdapter } from '@leafergraph/diff';

const adapter = new WebSocketTransportAdapter({
  url: 'ws://localhost:3000/ws/diff'
});

// 发送 diff
await adapter.connect();
await adapter.send(diff);

// 接收 diff
const receivedDiff = await adapter.receive();
await adapter.disconnect();
```

## API 文档

### DiffEngine

- `computeDiff(oldDocument, newDocument, options)`: 计算两个文档之间的差异
- `applyDiff(currentDocument, diff)`: 应用差异到文档

### FindUpdater

- `findById(id)`: 按 ID 查找节点
- `findByPath(path)`: 按路径查找节点
- `findByCondition(condition)`: 按条件查找节点
- `findAllByCondition(condition)`: 按条件查找所有节点
- `updateById(id, changes)`: 按 ID 更新节点
- `updateByPath(path, changes)`: 按路径更新节点
- `updateByCondition(condition, changes)`: 按条件更新节点
- `batchUpdate(updates)`: 批量更新节点
- `setNodeProperty(nodeId, key, value)`: 设置节点属性
- `setNodeData(nodeId, key, value)`: 设置节点数据
- `setNodeFlag(nodeId, key, value)`: 设置节点标志
- `setNodeWidgetValue(nodeId, widgetIndex, value)`: 设置节点 Widget 值
- `replaceNodeWidget(nodeId, widgetIndex, widget)`: 替换节点 Widget
- `removeNodeWidget(nodeId, widgetIndex)`: 删除节点 Widget

### DiffProjector

- `project(document, diff)`: 投影 diff 到运行时

### 传输适配器

- `HttpTransportAdapter`: HTTP 传输适配器
- `WebSocketTransportAdapter`: WebSocket 传输适配器
- `MQTransportAdapter`: 消息队列传输适配器

## 工具函数

- `deepClone(obj)`: 深度克隆对象
- `generateId(prefix)`: 生成唯一 ID
- `deepEqual(a, b)`: 深度比较两个对象
- `findNodeById(document, nodeId)`: 从文档中查找节点
- `findLinkById(document, linkId)`: 从文档中查找连线
- `validateDocument(document)`: 验证文档结构
- `mergeDocuments(base, update)`: 合并两个文档
- `validateDiff(diff)`: 验证 diff 结构

## 类型定义

- `GraphDocumentDiff`: 文档差异结构
- `GraphDocumentFieldChange`: 字段变更结构
- `ApplyGraphDocumentDiffResult`: 应用结果结构
- `DiffOptions`: 差异计算选项
- `TransportOptions`: 传输适配器选项
- `BatchResult`: 批处理结果

## 测试

运行测试：

```bash
bun test
```

## 构建

构建包：

```bash
bun run build
```

## 许可证

MIT
