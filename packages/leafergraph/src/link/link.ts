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

/** 三次贝塞尔连线曲线。 */
export interface LinkBezierCurve {
  start: LinkPoint;
  end: LinkPoint;
  control1: LinkPoint;
  control2: LinkPoint;
  startDirection: PortDirection;
  endDirection: PortDirection;
}

/**
 * 根据节点边界和端口布局计算连线起止点。
 * 这里保持简单且高性能：布局决策放在外部，调用方可自行选择端口。
 *
 * @param input - 输入参数。
 * @returns 处理后的结果。
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
 * 根据起点、终点和端口方向生成共享的三次贝塞尔曲线。
 *
 * @remarks
 * 正式连线渲染与数据流动画都应复用这份曲线，避免路径和采样各算各的。
 *
 * @param start - `start`。
 * @param end - `end`。
 * @param startDir - `startDir` 参数。
 * @param endDir - `endDir` 参数。
 * @returns 处理后的结果。
 */
export function buildLinkCurve(
  start: LinkPoint,
  end: LinkPoint,
  startDir: PortDirection,
  endDir: PortDirection
): LinkBezierCurve {
  const safeStart: [number, number] = [start[0], start[1]];
  const safeEnd: [number, number] = [end[0], end[1]];
  const dx = safeEnd[0] - safeStart[0];
  const dy = safeEnd[1] - safeStart[1];
  const dist = Math.max(Math.hypot(dx, dy), 16);
  const control1: [number, number] = [safeStart[0], safeStart[1]];
  const control2: [number, number] = [safeEnd[0], safeEnd[1]];
  const handle = Math.min(160, Math.max(24, dist * 0.25));

  applyDirectionalHandle(control1, startDir, handle);
  applyDirectionalHandle(control2, endDir, handle);

  return {
    start: safeStart,
    end: safeEnd,
    control1,
    control2,
    startDirection: startDir,
    endDirection: endDir
  };
}

/**
 * 由节点端口几何直接生成共享的三次贝塞尔曲线。
 *
 * @param input - 输入参数。
 * @param startDir - `startDir` 参数。
 * @param endDir - `endDir` 参数。
 * @returns 处理后的结果。
 */
export function resolveLinkCurve(
  input: LinkEndpointInput,
  startDir: PortDirection,
  endDir: PortDirection
): LinkBezierCurve {
  const endpoints = resolveLinkEndpoints(input);
  return buildLinkCurve(endpoints.start, endpoints.end, startDir, endDir);
}

/**
 *  把共享曲线转成最终路径字符串。
 *
 * @param curve - `curve`。
 * @returns 处理后的结果。
 */
export function buildLinkPathFromCurve(curve: LinkBezierCurve): string {
  return `M ${curve.start[0]} ${curve.start[1]} C ${curve.control1[0]} ${curve.control1[1]}, ${curve.control2[0]} ${curve.control2[1]}, ${curve.end[0]} ${curve.end[1]}`;
}

/**
 * 生成三次贝塞尔路径字符串（LiteGraph 思路）：
 * 使用两个控制点沿端口方向外推，形成清晰的出线扩展。
 *
 * @param start - `start`。
 * @param end - `end`。
 * @param startDir - `startDir` 参数。
 * @param endDir - `endDir` 参数。
 * @returns 处理后的结果。
 */
export function buildLinkPath(
  start: LinkPoint,
  end: LinkPoint,
  startDir: PortDirection,
  endDir: PortDirection
): string {
  return buildLinkPathFromCurve(buildLinkCurve(start, end, startDir, endDir));
}

/**
 *  按进度采样共享曲线上的一个世界坐标点。
 *
 * @param curve - `curve`。
 * @param progress - `progress`。
 * @returns 处理后的结果。
 */
export function sampleLinkCurvePoint(
  curve: LinkBezierCurve,
  progress: number
): LinkPoint {
  const safeProgress = Math.min(Math.max(progress, 0), 1);
  const inverse = 1 - safeProgress;
  const x =
    inverse * inverse * inverse * curve.start[0] +
    3 * inverse * inverse * safeProgress * curve.control1[0] +
    3 * inverse * safeProgress * safeProgress * curve.control2[0] +
    safeProgress * safeProgress * safeProgress * curve.end[0];
  const y =
    inverse * inverse * inverse * curve.start[1] +
    3 * inverse * inverse * safeProgress * curve.control1[1] +
    3 * inverse * safeProgress * safeProgress * curve.control2[1] +
    safeProgress * safeProgress * safeProgress * curve.end[1];

  return [x, y];
}

/**
 * 给控制点施加方向偏移，复刻 LiteGraph 的控制柄策略，
 * 让曲线保持稳定可读。
 *
 * @param point - 坐标。
 * @param dir - `dir`。
 * @param distance - `distance`。
 * @returns 无返回值。
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
