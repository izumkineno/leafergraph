/**
 * editor UI 聚合导出入口。
 *
 * @remarks
 * 负责统一暴露基础组件和各区域 UI 模块，减少外部按路径逐个导入的成本。
 */
/** 导出 shell 层最常用的壳层组件和上下文入口。 */
export {
  EditorShell,
  useEditorContext
} from "./shell/provider";
/** 导出基础组件与各区域 UI 模块。 */
export * from "./ui/foundation";
export * from "./ui/titlebar";
export * from "./ui/workspace";
export * from "./ui/node-library";
export * from "./ui/viewport";
export * from "./ui/inspector";
export * from "./ui/statusbar";
export * from "./ui/workspace-settings";
export * from "./ui/run-console";
export * from "./ui/node-library-preview";
/** 导出 app 层当前仍在复用的过渡面板组件。 */
export {
  InspectorPane,
  NodeLibraryPane,
  type InspectorPaneProps,
  type NodeLibraryPaneProps
} from "./app/WorkspacePanels";
/** 导出节点库 hover 预览浮层。 */
export {
  NodeLibraryHoverPreviewOverlay,
  type NodeLibraryHoverPreviewOverlayProps
} from "./ui/node-library-preview";
