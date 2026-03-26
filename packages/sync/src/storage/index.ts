/**
 * storage 子出口入口。
 *
 * @remarks
 * 负责聚合浏览器缓存 helper 与 storage 解析工具，供 session 与外部宿主复用。
 */
export {
  createBrowserCacheStorage,
  hasBrowserPersistenceHost,
  type CreateBrowserCacheStorageOptions
} from "./browser_cache_storage";
export { resolveSyncStorage, type ResolvedSyncStorage } from "./resolve_storage";
