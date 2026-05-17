/**
 * 节点进度外圈路径 helper。
 *
 * @remarks
 * 统一负责 rounded-rect 外圈的整圈路径、百分比路径和动态片段路径计算，
 * 让 view 构建与动画驱动共用同一套几何规则。
 */

export interface NodeShellProgressGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  perimeter: number;
  straightWidth: number;
  straightHeight: number;
}

interface ProgressPoint {
  x: number;
  y: number;
}

type ProgressPathSegment =
  | {
      kind: "line";
      length: number;
      start: ProgressPoint;
      end: ProgressPoint;
    }
  | {
      kind: "arc";
      length: number;
      center: ProgressPoint;
      radius: number;
      startAngle: number;
      endAngle: number;
    };

/**
 * 创建节点进度外圈几何。
 *
 * @param input - 外圈包围盒与圆角。
 * @returns 几何快照。
 */
export function createNodeShellProgressGeometry(input: {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
}): NodeShellProgressGeometry {
  const width = Math.max(1, input.width);
  const height = Math.max(1, input.height);
  const radius = Math.max(0, Math.min(input.radius, width / 2, height / 2));
  const straightWidth = Math.max(width - radius * 2, 0);
  const straightHeight = Math.max(height - radius * 2, 0);
  const perimeter =
    straightWidth * 2 + straightHeight * 2 + Math.PI * radius * 2;

  return {
    x: input.x,
    y: input.y,
    width,
    height,
    radius,
    perimeter,
    straightWidth,
    straightHeight
  };
}

/**
 * 构建整圈 track 路径。
 *
 * @param geometry - 目标几何。
 * @returns 完整路径字符串。
 */
export function buildNodeShellProgressTrackPath(
  geometry: NodeShellProgressGeometry
): string {
  return buildNodeShellProgressPathRange(geometry, 0, 1);
}

/**
 * 构建进度片段路径。
 *
 * @param geometry - 目标几何。
 * @param start - 起点进度。
 * @param length - 片段长度。
 * @returns 对应路径字符串。
 */
export function buildNodeShellProgressSegmentPath(
  geometry: NodeShellProgressGeometry,
  start: number,
  length: number
): string {
  const normalizedStart = normalizeProgress(start);
  const normalizedLength = Math.max(0, Math.min(length, 1));

  if (normalizedLength <= 0 || geometry.perimeter <= 0) {
    return "";
  }

  if (normalizedLength >= 1) {
    return buildNodeShellProgressPathRange(geometry, 0, 1);
  }

  const remainingToEnd = 1 - normalizedStart;
  if (normalizedLength <= remainingToEnd) {
    return buildNodeShellProgressPathRange(
      geometry,
      normalizedStart,
      normalizedStart + normalizedLength
    );
  }

  const tailPath = buildNodeShellProgressPathRange(geometry, normalizedStart, 1);
  const headPath = buildNodeShellProgressPathRange(
    geometry,
    0,
    normalizedLength - remainingToEnd
  );
  if (!tailPath) {
    return headPath;
  }
  if (!headPath) {
    return tailPath;
  }
  return `${tailPath} ${headPath}`;
}

/**
 * 把任意进度值归一到 `0..1`。
 *
 * @param value - 原始进度。
 * @returns 归一结果。
 */
export function normalizeProgress(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const wrapped = value % 1;
  return wrapped < 0 ? wrapped + 1 : wrapped;
}

function buildNodeShellProgressPathRange(
  geometry: NodeShellProgressGeometry,
  startRatio: number,
  endRatio: number
): string {
  const safeStart = Math.max(0, Math.min(startRatio, 1));
  const safeEnd = Math.max(0, Math.min(endRatio, 1));
  if (safeEnd <= safeStart || geometry.perimeter <= 0) {
    return "";
  }

  const segments = createProgressPathSegments(geometry);
  if (!segments.length) {
    return "";
  }

  const startLocation = locateDistanceOnProgressPath(
    segments,
    safeStart * geometry.perimeter
  );
  const endLocation = locateDistanceOnProgressPath(
    segments,
    safeEnd * geometry.perimeter
  );

  const startPoint = resolveSegmentPoint(
    startLocation.segment,
    startLocation.segmentProgress
  );
  const commands = [`M ${formatPathNumber(startPoint.x)} ${formatPathNumber(startPoint.y)}`];

  for (
    let segmentIndex = startLocation.segmentIndex;
    segmentIndex <= endLocation.segmentIndex;
    segmentIndex += 1
  ) {
    const segment = segments[segmentIndex];
    const segmentStart =
      segmentIndex === startLocation.segmentIndex
        ? startLocation.segmentProgress
        : 0;
    const segmentEnd =
      segmentIndex === endLocation.segmentIndex ? endLocation.segmentProgress : 1;
    appendSegmentSlice(commands, segment, segmentStart, segmentEnd);
  }

  return commands.join(" ");
}

function createProgressPathSegments(
  geometry: NodeShellProgressGeometry
): ProgressPathSegment[] {
  const { x, y, width, height, radius, straightWidth, straightHeight } = geometry;
  const topCenter = { x: x + width / 2, y };
  const topRightStart = { x: x + width - radius, y };
  const rightTop = { x: x + width, y: y + radius };
  const rightBottom = { x: x + width, y: y + height - radius };
  const bottomRightStart = { x: x + width - radius, y: y + height };
  const bottomLeftStart = { x: x + radius, y: y + height };
  const leftBottom = { x, y: y + height - radius };
  const leftTop = { x, y: y + radius };
  const topLeftStart = { x: x + radius, y };

  const rawSegments: ProgressPathSegment[] = [
    {
      kind: "line",
      length: straightWidth / 2,
      start: topCenter,
      end: topRightStart
    },
    {
      kind: "arc",
      length: (Math.PI * radius) / 2,
      center: { x: x + width - radius, y: y + radius },
      radius,
      startAngle: -Math.PI / 2,
      endAngle: 0
    },
    {
      kind: "line",
      length: straightHeight,
      start: rightTop,
      end: rightBottom
    },
    {
      kind: "arc",
      length: (Math.PI * radius) / 2,
      center: { x: x + width - radius, y: y + height - radius },
      radius,
      startAngle: 0,
      endAngle: Math.PI / 2
    },
    {
      kind: "line",
      length: straightWidth,
      start: bottomRightStart,
      end: bottomLeftStart
    },
    {
      kind: "arc",
      length: (Math.PI * radius) / 2,
      center: { x: x + radius, y: y + height - radius },
      radius,
      startAngle: Math.PI / 2,
      endAngle: Math.PI
    },
    {
      kind: "line",
      length: straightHeight,
      start: leftBottom,
      end: leftTop
    },
    {
      kind: "arc",
      length: (Math.PI * radius) / 2,
      center: { x: x + radius, y: y + radius },
      radius,
      startAngle: Math.PI,
      endAngle: Math.PI * 1.5
    },
    {
      kind: "line",
      length: straightWidth / 2,
      start: topLeftStart,
      end: topCenter
    }
  ];

  return rawSegments.filter((segment) => segment.length > 0.00001);
}

function locateDistanceOnProgressPath(
  segments: readonly ProgressPathSegment[],
  distance: number
): {
  segment: ProgressPathSegment;
  segmentIndex: number;
  segmentProgress: number;
} {
  let consumed = 0;
  const clampedDistance = Math.max(
    0,
    Math.min(
      distance,
      segments.reduce((sum, segment) => sum + segment.length, 0)
    )
  );

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const nextConsumed = consumed + segment.length;
    if (clampedDistance <= nextConsumed || index === segments.length - 1) {
      const segmentDistance = clampedDistance - consumed;
      return {
        segment,
        segmentIndex: index,
        segmentProgress:
          segment.length > 0
            ? Math.max(0, Math.min(1, segmentDistance / segment.length))
            : 1
      };
    }
    consumed = nextConsumed;
  }

  const lastSegment = segments[segments.length - 1];
  return {
    segment: lastSegment,
    segmentIndex: segments.length - 1,
    segmentProgress: 1
  };
}

function appendSegmentSlice(
  commands: string[],
  segment: ProgressPathSegment,
  from: number,
  to: number
): void {
  const safeFrom = Math.max(0, Math.min(from, 1));
  const safeTo = Math.max(0, Math.min(to, 1));
  if (safeTo <= safeFrom) {
    return;
  }

  const endPoint = resolveSegmentPoint(segment, safeTo);
  if (segment.kind === "line" || segment.radius <= 0) {
    commands.push(`L ${formatPathNumber(endPoint.x)} ${formatPathNumber(endPoint.y)}`);
    return;
  }

  const angleSpan =
    (segment.endAngle - segment.startAngle) * (safeTo - safeFrom);
  const largeArcFlag = Math.abs(angleSpan) > Math.PI ? 1 : 0;
  commands.push(
    `A ${formatPathNumber(segment.radius)} ${formatPathNumber(segment.radius)} 0 ${largeArcFlag} 1 ${formatPathNumber(endPoint.x)} ${formatPathNumber(endPoint.y)}`
  );
}

function resolveSegmentPoint(
  segment: ProgressPathSegment,
  progress: number
): ProgressPoint {
  const safeProgress = Math.max(0, Math.min(progress, 1));
  if (segment.kind === "line") {
    return {
      x: segment.start.x + (segment.end.x - segment.start.x) * safeProgress,
      y: segment.start.y + (segment.end.y - segment.start.y) * safeProgress
    };
  }

  const angle =
    segment.startAngle + (segment.endAngle - segment.startAngle) * safeProgress;
  return {
    x: segment.center.x + Math.cos(angle) * segment.radius,
    y: segment.center.y + Math.sin(angle) * segment.radius
  };
}

function formatPathNumber(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}
