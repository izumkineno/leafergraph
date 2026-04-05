import {
  collectGraphDocumentUsedTypes,
  collectNodeWidgetTypesExport,
  readGraphDocumentFromArtifact,
  resolveNodeTypesExport,
  resolveWidgetTypesExport,
  type RuntimeBridgeArtifactData
} from "@leafergraph/runtime-bridge";
import { rewriteAnalysisRuntimeDependencies } from "./analysis_runtime_dependencies";

export async function analyzeLocalComponentArtifactFile(file: File): Promise<{
  widgetTypes: string[];
}> {
  const namespace = await importLocalJavaScriptFile(file);
  return {
    widgetTypes: resolveWidgetTypesExport(namespace)
  };
}

export async function analyzeLocalNodeArtifactFile(file: File): Promise<{
  nodeTypes: string[];
  widgetTypes: string[];
  exportedWidgetTypes: string[];
}> {
  const namespace = await importLocalJavaScriptFile(file);
  let exportedWidgetTypes: string[] = [];
  try {
    exportedWidgetTypes = resolveWidgetTypesExport(namespace);
  } catch {
    exportedWidgetTypes = [];
  }
  return {
    nodeTypes: resolveNodeTypesExport(namespace),
    widgetTypes: collectNodeWidgetTypesExport(namespace),
    exportedWidgetTypes
  };
}

export async function analyzeLocalBlueprintDocumentFile(file: File): Promise<{
  nodeTypes: string[];
  widgetTypes: string[];
}> {
  const document = await readGraphDocumentFromArtifact(await createJsonArtifact(file));
  return collectGraphDocumentUsedTypes(document);
}

async function importLocalJavaScriptFile(file: File): Promise<Record<string, unknown>> {
  const sourceText = await file.text();
  const rewrittenSource = await rewriteAnalysisRuntimeDependencies(sourceText);
  const moduleUrl = URL.createObjectURL(
    new Blob([rewrittenSource], {
      type: "text/javascript"
    })
  );

  try {
    return (await import(
      /* @vite-ignore */ moduleUrl
    )) as Record<string, unknown>;
  } finally {
    URL.revokeObjectURL(moduleUrl);
  }
}

async function createJavaScriptArtifact(file: File): Promise<RuntimeBridgeArtifactData> {
  return {
    kind: "bytes",
    bytes: new Uint8Array(await file.arrayBuffer()),
    contentType: file.type || "text/javascript"
  };
}

async function createJsonArtifact(file: File): Promise<RuntimeBridgeArtifactData> {
  return {
    kind: "bytes",
    bytes: new Uint8Array(await file.arrayBuffer()),
    contentType: file.type || "application/json"
  };
}
