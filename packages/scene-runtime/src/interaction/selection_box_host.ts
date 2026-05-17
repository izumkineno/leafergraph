/**
 * 框选矩形可视化宿主模块。
 *
 * @remarks
 * 参考 editor 里的 selection preview 视觉层次，
 * 这里采用“淡填充 + 主描边 + 内高光”三层矩形组合，
 * 让左键框选在亮暗两种主题下都更容易辨认。
 */

import { Group, Rect, type Group as LeaferGroup } from "leafer-ui";

interface LeaferGraphSelectionBoxHostOptions {
  selectionLayer: LeaferGroup;
  requestRender(): void;
  resolveStroke(): string;
}

/**
 * 封装 LeaferGraphSelectionBoxHost 的宿主能力。
 */
export class LeaferGraphSelectionBoxHost {
  private readonly options: LeaferGraphSelectionBoxHostOptions;
  private readonly group: Group;
  private readonly fillRect: Rect;
  private readonly frameRect: Rect;
  private readonly highlightRect: Rect;

  /**
   * 初始化 LeaferGraphSelectionBoxHost 实例。
   *
   * @param options - 可选配置项。
   */
  constructor(options: LeaferGraphSelectionBoxHostOptions) {
    // 先整理当前阶段需要的输入、状态与依赖。
    this.options = options;
    this.fillRect = new Rect({
      name: "graph-selection-box-fill",
      visible: false,
      fill: "#3b82f624",
      stroke: "transparent",
      cornerRadius: 14,
      hitSelf: false,
      hittable: false
    });
    this.frameRect = new Rect({
      name: "graph-selection-box-frame",
      visible: false,
      fill: "transparent",
      stroke: this.options.resolveStroke(),
      strokeWidth: 1.2,
      cornerRadius: 14,
      hitSelf: false,
      hittable: false
    });
    // 再执行核心逻辑，并把结果或副作用统一收口。
    this.highlightRect = new Rect({
      name: "graph-selection-box-highlight",
      visible: false,
      fill: "transparent",
      stroke: "#ffffff47",
      strokeWidth: 1,
      cornerRadius: 13,
      opacity: 0.96,
      hitSelf: false,
      hittable: false
    });
    this.group = new Group({
      name: "graph-selection-box",
      visible: false,
      hitSelf: false,
      hitChildren: false,
      hittable: false
    });
    this.group.add([this.fillRect, this.frameRect, this.highlightRect]);
    this.options.selectionLayer.add(this.group);
  }

  /**
   *  按当前主题色刷新并显示框选矩形。
   *
   * @param bounds - `bounds`。
   * @returns 无返回值。
   */
  show(bounds: { x: number; y: number; width: number; height: number }): void {
    const normalizedBounds = normalizeRectBounds(bounds);
    const visible = normalizedBounds.width > 0 || normalizedBounds.height > 0;

    this.group.visible = visible;
    this.fillRect.visible = visible;
    this.frameRect.visible = visible;
    this.highlightRect.visible = visible;

    if (!visible) {
      this.options.requestRender();
      return;
    }

    this.fillRect.x = normalizedBounds.x;
    this.fillRect.y = normalizedBounds.y;
    this.fillRect.width = normalizedBounds.width;
    this.fillRect.height = normalizedBounds.height;

    this.frameRect.x = normalizedBounds.x;
    this.frameRect.y = normalizedBounds.y;
    this.frameRect.width = normalizedBounds.width;
    this.frameRect.height = normalizedBounds.height;
    this.frameRect.stroke = this.options.resolveStroke();

    this.highlightRect.x = normalizedBounds.x + 1;
    this.highlightRect.y = normalizedBounds.y + 1;
    this.highlightRect.width = Math.max(0, normalizedBounds.width - 2);
    this.highlightRect.height = Math.max(0, normalizedBounds.height - 2);

    this.options.requestRender();
  }

  /**
   *  隐藏当前框选矩形。
   *
   * @returns 无返回值。
   */
  hide(): void {
    if (!this.group.visible) {
      return;
    }

    this.group.visible = false;
    this.fillRect.visible = false;
    this.frameRect.visible = false;
    this.highlightRect.visible = false;
    this.options.requestRender();
  }

  /**
   *  销毁 overlay 图元。
   *
   * @returns 无返回值。
   */
  destroy(): void {
    this.group.remove();
  }
}

/**
 * 处理 `normalizeRectBounds` 相关逻辑。
 *
 * @param bounds - `bounds`。
 * @returns 处理后的结果。
 */
function normalizeRectBounds(bounds: {
  x: number;
  y: number;
  width: number;
  height: number;
}): { x: number; y: number; width: number; height: number } {
  const nextX = bounds.width >= 0 ? bounds.x : bounds.x + bounds.width;
  const nextY = bounds.height >= 0 ? bounds.y : bounds.y + bounds.height;

  return {
    x: nextX,
    y: nextY,
    width: Math.abs(bounds.width),
    height: Math.abs(bounds.height)
  };
}
