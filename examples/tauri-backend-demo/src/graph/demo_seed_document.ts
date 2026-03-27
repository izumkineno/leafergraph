/**
 * Tauri authority demo 共享种子文档模块。
 *
 * @remarks
 * 负责统一提供：
 * - 共享 seed `GraphDocument`
 * - 空文档工厂
 * - 最小示例中的固定节点与类型常量
 *
 * 前端与 Rust 后端都围绕同一份 JSON 种子恢复，避免维护两套初始图真相。
 */
import type { GraphDocument } from "leafergraph";

import seedDocumentJson from "../../shared/demo_seed_document.json";

/** 最小示例中的文档 ID。 */
export const DEMO_DOCUMENT_ID = "tauri-sync-demo";

/** 最小示例中的 On Play 节点 ID。 */
export const ON_PLAY_NODE_ID = "on-play-1";

/** 最小示例中的计数节点 ID。 */
export const COUNTER_NODE_ID = "counter-1";

/** 最小示例中的观察节点 ID。 */
export const WATCH_NODE_ID = "watch-1";

/** 最小示例中的计数节点类型。 */
export const EXAMPLE_COUNTER_NODE_TYPE = "example/counter";

/** 最小示例中的观察节点类型。 */
export const EXAMPLE_WATCH_NODE_TYPE = "example/watch";

const DEMO_SEED_DOCUMENT = seedDocumentJson as GraphDocument;

/** 返回一份深拷贝后的共享种子文档。 */
export function cloneDemoSeedDocument(): GraphDocument {
  return structuredClone(DEMO_SEED_DOCUMENT);
}

/**
 * 创建一份空图文档，供画布初始化阶段使用。
 *
 * @remarks
 * 真正的 authority 基线会在 session 首次连接后由后端快照整体替换。
 */
export function createEmptyDemoDocument(): GraphDocument {
  return {
    documentId: DEMO_SEED_DOCUMENT.documentId,
    revision: DEMO_SEED_DOCUMENT.revision,
    appKind: DEMO_SEED_DOCUMENT.appKind,
    nodes: [],
    links: [],
    meta: structuredClone(DEMO_SEED_DOCUMENT.meta ?? {})
  };
}
