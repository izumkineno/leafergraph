/**
 * 连线路径与几何工具模块。
 *
 * @remarks
 * 负责连线端点、切线和路径数据的几何计算。
 */

export const PORT_DIRECTION_LEFT = 1;
export const PORT_DIRECTION_RIGHT = 2;
export const PORT_DIRECTION_UP = 3;
export const PORT_DIRECTION_DOWN = 4;

/** 二维点坐标。 */
export type LinkPoint = readonly [number, number];

/** 端口方向类型。 */
export type PortDirection =
  | typeof PORT_DIRECTION_LEFT
  | typeof PORT_DIRECTION_RIGHT
  | typeof PORT_DIRECTION_UP
  | typeof PORT_DIRECTION_DOWN;

/**
 * 计算连线端点时需要的节点与端口布局输入。
 */
export interface LinkEndpointInput {
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  targetX: number;
  targetY: number;
  sourcePortY: number;
  targetPortY: number;
  portSize: number;
}

/** 最终计算出的起点和终点。 */
export interface LinkEndpoints {
  start: LinkPoint;
  end: LinkPoint;
}

/**
 * 根据节点边界和端口布局计算连线起止点。
 * 这里保持简单且高性能：布局决策放在外部，调用方可自行选择端口。
 */
export function resolveLinkEndpoints(input: LinkEndpointInput): LinkEndpoints {
  const start: LinkPoint = [
    input.sourceX + input.sourceWidth + input.portSize / 2,
    input.sourceY + input.sourcePortY
  ];
  const end: LinkPoint = [
    input.targetX - input.portSize / 2,
    input.targetY + input.targetPortY
  ];

  return { start, end };
}

/**
 * 生成三次贝塞尔路径字符串（LiteGraph 思路）：
 * 使用两个控制点沿端口方向外推，形成清晰的出线扩展。
 */
export function buildLinkPath(
  start: LinkPoint,
  end: LinkPoint,
  startDir: PortDirection,
  endDir: PortDirection
): string {
  const safeStart: [number, number] = [start[0], start[1]];
  const safeEnd: [number, number] = [end[0], end[1]];
  const dx = safeEnd[0] - safeStart[0];
  const dy = safeEnd[1] - safeStart[1];
  const dist = Math.max(Math.hypot(dx, dy), 16);
  const c1: [number, number] = [safeStart[0], safeStart[1]];
  const c2: [number, number] = [safeEnd[0], safeEnd[1]];
  const handle = Math.min(160, Math.max(24, dist * 0.25));

  applyDirectionalHandle(c1, startDir, handle);
  applyDirectionalHandle(c2, endDir, handle);

  return `M ${safeStart[0]} ${safeStart[1]} C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${safeEnd[0]} ${safeEnd[1]}`;
}

/**
 * 给控制点施加方向偏移，复刻 LiteGraph 的控制柄策略，
 * 让曲线保持稳定可读。
 */
export function applyDirectionalHandle(
  point: [number, number],
  dir: PortDirection,
  distance: number
): void {
  switch (dir) {
    case PORT_DIRECTION_LEFT:
      point[0] -= distance;
      break;
    case PORT_DIRECTION_RIGHT:
      point[0] += distance;
      break;
    case PORT_DIRECTION_UP:
      point[1] -= distance;
      break;
    case PORT_DIRECTION_DOWN:
      point[1] += distance;
      break;
    default:
      break;
  }
}
