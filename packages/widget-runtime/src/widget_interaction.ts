/**
 * Widget 交互工具模块。
 *
 * @remarks
 * 负责 Widget 命中识别、按压交互和线性拖拽绑定。
 */

import type { Group } from "leafer-ui";
import type { LeaferGraphWidgetBounds } from "@leafergraph/contracts";

/**
 * Widget 命中热区统一使用的图元名称。
 * 节点拖拽、选区和未来的命中分析都可以借助这组约定快速识别“事件来自 Widget 内部”。
 */
export const LEAFER_GRAPH_WIDGET_HIT_AREA_NAME = "widget-hit-area";

/**
 * Widget 命中图元使用的最小事件目标结构。
 * 当前只读取名称和父子链，用于判断事件是否来自 Widget 内部。
 */
export interface LeaferGraphWidgetEventTargetLike {
  /** 当前图元名称。 */
  name?: string;
  /** 当前图元的父节点。 */
  parent?: LeaferGraphWidgetEventTargetLike | null;
}

/**
 * 主包当前关心的 Widget 指针事件最小子集。
 * 这里只保留交互型 Widget 会真正消费的字段，避免把整份 Leafer 事件类型扩散到宿主各层。
 */
export interface LeaferGraphWidgetPointerEvent {
  /** 图坐标系中的 X。 */
  x: number;
  /** 图坐标系中的 Y。 */
  y: number;
  /** 原始事件对象中可读取的客户端坐标。 */
  origin?: {
    /** 客户端 X。 */
    clientX?: number;
    /** 客户端 Y。 */
    clientY?: number;
  };
  /** 当前是否为左键。 */
  left?: boolean;
  /** 当前是否为中键。 */
  middle?: boolean;
  /** 当前是否为右键。 */
  right?: boolean;
  /** 当前命中的目标。 */
  target?: LeaferGraphWidgetEventTargetLike | null;
  /** 把当前事件转换到给定 Group 局部坐标系。 */
  getLocalPoint?(relative?: Group): { x: number; y: number };
  /** 停止当前事件继续传播。 */
  stop?(): void;
  /** 立即停止当前事件。 */
  stopNow?(): void;
}

/**
 * Widget 交互层当前依赖的最小事件源能力。
 * `Rect`、`Group` 等 Leafer 图元都满足这组结构约束。
 */
export interface LeaferGraphWidgetEventSource {
  /** 绑定事件监听。 */
  on(type: string, listener: (event: LeaferGraphWidgetPointerEvent) => void): void;
  /** 解绑事件监听。 */
  off(
    type?: string | string[],
    listener?: (event: LeaferGraphWidgetPointerEvent) => void
  ): void;
}

/**
 * 线性拖拽型 Widget 的绑定参数。
 * 当前主要服务 slider，一旦后续增加 progress、seek、range 一类控件，也可以继续复用。
 */
export interface LeaferGraphLinearWidgetDragOptions {
  /** 当前 Widget 的命中层。 */
  hitArea: LeaferGraphWidgetEventSource;
  /** 当前 Widget 所属 Group。 */
  group: Group;
  /** 当前 Widget 在节点内的布局边界。 */
  bounds: LeaferGraphWidgetBounds;
  /** 读取节点在图中的 X 坐标。 */
  getNodeX(): number;
  /** 根据拖拽进度写入新值。 */
  onValue(nextProgress: number, event: LeaferGraphWidgetPointerEvent): void;
  /** 额外的指针过滤条件。 */
  allowPointer?(event: LeaferGraphWidgetPointerEvent): boolean;
  /** 拖拽开始回调。 */
  onStart?(event: LeaferGraphWidgetPointerEvent): void;
  /** 拖拽结束回调。 */
  onEnd?(event: LeaferGraphWidgetPointerEvent): void;
}

/**
 * 按压触发型 Widget 的绑定参数。
 * 适合 toggle、button、stepper 等“一次点击触发一次动作”的交互件。
 */
export interface LeaferGraphPressWidgetInteractionOptions {
  /** 当前 Widget 的命中层。 */
  hitArea: LeaferGraphWidgetEventSource;
  /** 命中后触发的按压回调。 */
  onPress(event: LeaferGraphWidgetPointerEvent): void;
  /** 额外的指针过滤条件。 */
  allowPointer?(event: LeaferGraphWidgetPointerEvent): boolean;
  /** hover 状态变化回调。 */
  onHoverChange?(hovered: boolean): void;
  /** press 状态变化回调。 */
  onPressChange?(pressed: boolean): void;
}

/**
 * Widget 交互绑定对象。
 * 当前只需要统一销毁入口，便于宿主在 renderer.destroy() 中稳定回收监听。
 */
export interface LeaferGraphWidgetInteractionBinding {
  /** 销毁当前交互绑定。 */
  destroy(): void;
}

/**
 *  将任意数值压缩到 0~1 区间。
 *
 * @param value - 当前值。
 * @returns 限制Widget `Progress`的结果。
 */
function clampWidgetProgress(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}

/**
 * 阻止 Widget 事件继续冒泡到节点拖拽和 editor 选区层。
 * 交互型 Widget 一旦消费事件，就不应该再让宿主把它误判成“拖节点”。
 *
 * @param event - 当前事件对象。
 * @returns 无返回值。
 */
export function stopWidgetPointerEvent(
  event: LeaferGraphWidgetPointerEvent
): void {
  if (event.stopNow) {
    event.stopNow();
    return;
  }

  event.stop?.();
}

/**
 * 判断一次指针命中是否来自 Widget 内部。
 * 当前通过图元名称前缀和父子链做约定式识别，避免把 Widget 交互混进节点拖拽层。
 *
 * @param target - 当前目标对象。
 * @returns 对应的判断结果。
 */
export function isWidgetInteractionTarget(
  target: LeaferGraphWidgetEventTargetLike | null | undefined
): boolean {
  let current = target;

  while (current) {
    const name = current.name ?? "";
    if (
      name === LEAFER_GRAPH_WIDGET_HIT_AREA_NAME ||
      name.startsWith("widget-")
    ) {
      return true;
    }
    current = current.parent ?? null;
  }

  return false;
}

/**
 * 将指针事件转换成线性 Widget 进度值。
 * 优先依赖 Leafer 的局部坐标转换；当某些宿主事件没有暴露转换函数时，再退回到节点世界坐标。
 *
 * @param event - 当前事件对象。
 * @param group - 分组。
 * @param bounds - `bounds`。
 * @param getNodeX - `get` 节点 X。
 * @returns 处理后的结果。
 */
export function resolveLinearWidgetProgressFromEvent(
  event: LeaferGraphWidgetPointerEvent,
  group: Group,
  bounds: LeaferGraphWidgetBounds,
  getNodeX: () => number
): number {
  const localPoint = event.getLocalPoint?.(group);
  const localX = localPoint?.x ?? event.x - getNodeX();
  return clampWidgetProgress((localX - bounds.x) / Math.max(bounds.width, 1));
}

/**
 * 绑定线性拖拽型 Widget 的最小交互链路。
 * 它统一处理命中判断、事件阻断、进度解析和销毁解绑。
 *
 * @param options - 可选配置项。
 * @returns 用于解除当前绑定的清理函数。
 */
export function bindLinearWidgetDrag(
  options: LeaferGraphLinearWidgetDragOptions
): LeaferGraphWidgetInteractionBinding {
  // 先准备宿主依赖、初始状态和需要挂载的资源。
  const allowPointer =
    options.allowPointer ??
    ((event: LeaferGraphWidgetPointerEvent) => !event.middle && !event.right);

  let dragging = false;

  /**
   * 处理指针`Down`。
   *
   * @param event - 当前事件对象。
   * @returns 无返回值。
   */
  const handlePointerDown = (event: LeaferGraphWidgetPointerEvent): void => {
    if (!allowPointer(event)) {
      return;
    }

    dragging = true;
    stopWidgetPointerEvent(event);
    options.onStart?.(event);
    options.onValue(
      resolveLinearWidgetProgressFromEvent(
        event,
        options.group,
        options.bounds,
        options.getNodeX
      ),
      event
    );
  };

  /**
   * 处理指针`Move`。
   *
   * @param event - 当前事件对象。
   * @returns 无返回值。
   */
  const handlePointerMove = (event: LeaferGraphWidgetPointerEvent): void => {
    if (!dragging) {
      return;
    }

    stopWidgetPointerEvent(event);
    options.onValue(
      resolveLinearWidgetProgressFromEvent(
        event,
        options.group,
        options.bounds,
        options.getNodeX
      ),
      event
    );
  };

  /**
   * 处理指针`Up`。
   *
   * @param event - 当前事件对象。
   * @returns 无返回值。
   */
  // 再建立绑定与同步关系，让运行期交互能够稳定生效。
  const handlePointerUp = (event: LeaferGraphWidgetPointerEvent): void => {
    if (!dragging) {
      return;
    }

    stopWidgetPointerEvent(event);
    options.onValue(
      resolveLinearWidgetProgressFromEvent(
        event,
        options.group,
        options.bounds,
        options.getNodeX
      ),
      event
    );
    dragging = false;
    options.onEnd?.(event);
  };

  options.hitArea.on("pointer.down", handlePointerDown);
  options.hitArea.on("pointer.move", handlePointerMove);
  options.hitArea.on("pointer.up", handlePointerUp);

  return {
    destroy() {
      dragging = false;
      options.hitArea.off("pointer.down", handlePointerDown);
      options.hitArea.off("pointer.move", handlePointerMove);
      options.hitArea.off("pointer.up", handlePointerUp);
    }
  };
}

/**
 * 绑定按压触发型 Widget 的最小交互链路。
 * 当前阶段默认在 `pointer.down` 即触发动作，以保证节点拖拽不会抢走首次交互。
 *
 * @param options - 可选配置项。
 * @returns 用于解除当前绑定的清理函数。
 */
export function bindPressWidgetInteraction(
  options: LeaferGraphPressWidgetInteractionOptions
): LeaferGraphWidgetInteractionBinding {
  // 先准备宿主依赖、初始状态和需要挂载的资源。
  const allowPointer =
    options.allowPointer ??
    ((event: LeaferGraphWidgetPointerEvent) => !event.middle && !event.right);
  let hovered = false;
  let pressed = false;

  /**
   * 设置`Hovered`。
   *
   * @param nextHovered - 下一步`Hovered`。
   * @returns 无返回值。
   */
  const setHovered = (nextHovered: boolean): void => {
    if (hovered === nextHovered) {
      return;
    }

    hovered = nextHovered;
    options.onHoverChange?.(hovered);
  };

  /**
   * 设置`Pressed`。
   *
   * @param nextPressed - 下一步`Pressed`。
   * @returns 无返回值。
   */
  const setPressed = (nextPressed: boolean): void => {
    if (pressed === nextPressed) {
      return;
    }

    pressed = nextPressed;
    options.onPressChange?.(pressed);
  };

  /**
   * 处理指针`Enter`。
   *
   * @param event - 当前事件对象。
   * @returns 无返回值。
   */
  const handlePointerEnter = (event: LeaferGraphWidgetPointerEvent): void => {
    if (!allowPointer(event)) {
      return;
    }

    setHovered(true);
  };

  /**
   * 处理指针`Leave`。
   *
   * @returns 无返回值。
   */
  const handlePointerLeave = (): void => {
    setHovered(false);
    setPressed(false);
  };

  /**
   * 处理指针`Down`。
   *
   * @param event - 当前事件对象。
   * @returns 无返回值。
   */
  // 再建立绑定与同步关系，让运行期交互能够稳定生效。
  const handlePointerDown = (event: LeaferGraphWidgetPointerEvent): void => {
    if (!allowPointer(event)) {
      return;
    }

    setHovered(true);
    setPressed(true);
    stopWidgetPointerEvent(event);
    options.onPress(event);
  };

  /**
   * 处理指针`Up`。
   *
   * @returns 无返回值。
   */
  const handlePointerUp = (): void => {
    setPressed(false);
  };

  options.hitArea.on("pointer.enter", handlePointerEnter);
  options.hitArea.on("pointer.leave", handlePointerLeave);
  options.hitArea.on("pointer.down", handlePointerDown);
  options.hitArea.on("pointer.up", handlePointerUp);
  options.hitArea.on("pointer.cancel", handlePointerUp);

  return {
    destroy() {
      setHovered(false);
      setPressed(false);
      options.hitArea.off("pointer.enter", handlePointerEnter);
      options.hitArea.off("pointer.leave", handlePointerLeave);
      options.hitArea.off("pointer.down", handlePointerDown);
      options.hitArea.off("pointer.up", handlePointerUp);
      options.hitArea.off("pointer.cancel", handlePointerUp);
    }
  };
}
