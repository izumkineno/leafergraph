/**
 * 基础 Widget 类型模块。
 *
 * @remarks
 * 负责内建基础控件共享的生命周期状态、主题和辅助类型声明。
 */

import type { Rect, Text } from "leafer-ui";
import type {
  LeaferGraphWidgetEntry,
  LeaferGraphWidgetLifecycle,
  LeaferGraphWidgetRendererContext
} from "@leafergraph/core/contracts";
import type { LeaferGraphWidgetThemeTokens } from "@leafergraph/theme";

/**
 * 基础 Widget 主题直接复用 widget runtime 公开的 token 结构。
 * 这样 basic-kit 与外部扩展都能共享同一套亮暗色语义。
 */
export type BasicWidgetTheme = LeaferGraphWidgetThemeTokens;

/**
 * basic-kit 的基础 Widget 注册条目。
 * 每个条目都同时包含定义和 renderer，直接对应正式 Widget 注册表的输入结构。
 */
export type BasicWidgetEntry = LeaferGraphWidgetEntry;

/**
 * 所有基础 Widget 生命周期状态都至少要具备这三项能力：
 * 1. `cleanups` 统一回收事件和焦点绑定
 * 2. `syncValue(...)` 只处理当前值增量同步
 * 3. `syncTheme(...)` 在重建或复用时刷新视觉 token
 */
export interface BasicWidgetLifecycleState {
  /** 需要在销毁时统一回收的清理函数。 */
  cleanups: Array<() => void>;
  /** 把当前值同步到已创建的图元。 */
  syncValue(context: LeaferGraphWidgetRendererContext, newValue: unknown): void;
  /** 按最新主题 token 刷新已创建图元。 */
  syncTheme(context: LeaferGraphWidgetRendererContext): void;
}

/** 基础 Widget 生命周期别名，方便内部统一命名。 */
export type BasicWidgetLifecycle<TState extends BasicWidgetLifecycleState> =
  LeaferGraphWidgetLifecycle<TState>;

/**
 * 字段显示文本的统一结构。
 */
export interface ResolvedTextDisplay {
  /** 最终显示给用户的文本。 */
  text: string;
  /** 当前文本是否来自占位文案。 */
  placeholder: boolean;
}

/**
 * 线性控件的归一化范围。
 */
export interface ResolvedLinearRange {
  /** 归一化后的最小值。 */
  min: number;
  /** 归一化后的最大值。 */
  max: number;
  /** 归一化后的步长。 */
  step: number;
}

/**
 * Widget 锚点换算时需要的最小目标结构。
 */
export interface WidgetAnchorTarget {
  /** 所属 App 的最小定位信息。 */
  app?: {
    clientBounds?: { x: number; y: number };
    tree?: {
      clientBounds?: { x: number; y: number };
    };
  };
  /** 当前目标宽度。 */
  width?: number;
  /** 当前目标高度。 */
  height?: number;
  /** 世界变换矩阵或缩放信息。 */
  worldTransform?: {
    a?: number;
    d?: number;
    e?: number;
    f?: number;
    scaleX?: number;
    scaleY?: number;
  };
}

/**
 * radio 候选项在画布中的图元集合。
 */
export interface ChoiceItemView {
  /** 候选项外层表面图元。 */
  surface: Rect;
  /** 候选项命中层。 */
  hitArea: Rect;
  /** 单选环或外圈图元。 */
  indicatorRing: Rect;
  /** 选中核心点图元。 */
  indicatorDot: Rect;
  /** 候选项文本图元。 */
  text: Text;
  /** 当前候选项是否处于禁用态。 */
  disabled: boolean;
}
