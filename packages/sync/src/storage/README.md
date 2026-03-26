# `src/storage`

## 作用

`src/storage` 负责 `@leafergraph/sync` 当前的存储边界：  
一方面提供 storage 三态解析，另一方面提供默认浏览器缓存实现。

## 当前目录内容

- `resolve_storage.ts`
  - 把 session 入口里的 storage 三态解析成真实 `storage + scope + ownsStorage`
- `browser_cache_storage.ts`
  - 基于 IndexedDB 的默认浏览器缓存实现

## 边界

当前这一层负责：

- 启动恢复资料的读取与保存
- 浏览器缓存 key 组合
- storage ownership 执行边界
- `dispose?()` 释放行为

当前这一层不负责：

- 协议请求与通知收发
- session 的 resync 策略
- `authorityKey` 自动生成
- recovery snapshot 何时对订阅者可见

## 当前公开合同

当前根层 storage 合同固定为：

```ts
export interface SyncStorageScope {
  documentId: string;
  authorityKey: string;
}

export interface SyncStoredState {
  snapshot?: DocumentSnapshot;
  recoveryMeta?: {
    revision?: DocumentRevision;
    savedAt?: number;
  };
}

export interface SyncStorage {
  load(scope: SyncStorageScope): Promise<SyncStoredState | undefined>;
  save(scope: SyncStorageScope, state: SyncStoredState): Promise<void>;
  clear(scope: SyncStorageScope): Promise<void>;
  dispose?(): void | Promise<void>;
}
```

session 对外只要求 `authorityKey`，完整 `SyncStorageScope` 由 session 在调用前补齐。

## 默认浏览器缓存

当前 `createBrowserCacheStorage(...)` 固定采用：

- 底层介质：`IndexedDB`
- 默认 `namespace`：`@leafergraph/sync`
- 实际 key：`namespace::authorityKey::documentId`

它当前不会隐式回退到：

- `localStorage`
- 文件系统
- 其他宿主介质

## storage 三态解析

当前 `resolveSyncStorage(...)` 固定遵守：

- 缺少 `authorityKey`
  - 直接退化为关闭
- `storage === false`
  - 明确禁用
- `storage` 显式传入
  - 使用注入的 storage
  - `ownsStorage = false`
- `storage` 省略且宿主支持 `IndexedDB`
  - 隐式创建默认浏览器缓存
  - `ownsStorage = true`

## recovery snapshot 当前语义

当前 storage 保存的是：

- authority 已确认的正式快照
- 最小 `recoveryMeta`

当前 storage 不保存：

- pending 队列
- 未确认命令
- 运行反馈

因此当前 recovery 语义只有一条：

- 启动时可以先读出 recovery snapshot 做临时基线
- authority 首快照与 resync 快照整体替换它

## ownership 与 `dispose`

当前 ownership 规则固定为：

- 调用者注入的 storage
  - 由调用者负责生命周期
- session 隐式创建的默认浏览器缓存
  - 由 session 在 `dispose()` 时释放

当前 `dispose?()` 只负责：

- flush / cleanup
- 关闭底层资源

当前 `clear(...)` 只负责：

- 清空某个 scope 的持久化数据

## 推荐的 `authorityKey`

当前文档仍然保留这三条建议：

- 应稳定
- 不应包含 token 或临时敏感信息
- 优先使用宿主分配的逻辑 authority ID

这些是建议，不是当前代码里的硬校验规则。

## 推荐阅读顺序

1. [../../README.md](../../README.md)
2. [../session/README.md](../session/README.md)
3. [../openrpc/README.md](../openrpc/README.md)
