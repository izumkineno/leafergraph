import type { GraphDocumentRootState } from "./types";

export function cloneGraphDocumentRootState(
  document: GraphDocumentRootState
): GraphDocumentRootState {
  return {
    documentId: document.documentId,
    revision: document.revision,
    appKind: document.appKind,
    meta: document.meta ? structuredClone(document.meta) : undefined,
    capabilityProfile: document.capabilityProfile
      ? structuredClone(document.capabilityProfile)
      : undefined,
    adapterBinding: document.adapterBinding
      ? structuredClone(document.adapterBinding)
      : undefined
  };
}

