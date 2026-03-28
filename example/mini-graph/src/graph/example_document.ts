/**
 * mini-graph demo 的文档工具。
 *
 * 当前 demo 已经收口成默认空画布，所以这里只保留最小文档工厂。
 */
import type { GraphDocument } from "leafergraph";

/** 创建一份新的空图文档，供初始化与 reset 共用。 */
export function createEmptyExampleDocument(): GraphDocument {
  return {
    documentId: "mini-graph-demo",
    revision: 1,
    appKind: "leafergraph-local",
    nodes: [],
    links: []
  };
}
