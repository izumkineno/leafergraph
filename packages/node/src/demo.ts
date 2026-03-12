import type { NodeModule } from "./definition";
import type { NodeWidgetSpec } from "./types";

// 这组类型只服务当前 demo / editor 接入，后续可再迁回主包或专门的 demo 包。

export interface LeaferGraphNodeData {
  id: string;
  type?: string;
  title: string;
  subtitle?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  accent?: string;
  category?: string;
  status?: string;
  inputs?: string[];
  outputs?: string[];
  controlLabel?: string;
  controlValue?: string;
  controlProgress?: number;
  properties?: Record<string, unknown>;
  widgets?: NodeWidgetSpec[];
  data?: Record<string, unknown>;
}

export interface LeaferGraphOptions {
  fill?: string;
  nodes?: LeaferGraphNodeData[];
  modules?: NodeModule[];
}
