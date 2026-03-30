import type {
  LeaferGraphGraphConfig,
  NormalizedLeaferGraphGraphConfig
} from "./graph";
import type {
  LeaferGraphWidgetConfig,
  NormalizedLeaferGraphWidgetConfig
} from "./widget";
import type {
  LeaferGraphLeaferConfig,
  NormalizedLeaferGraphLeaferConfig
} from "./leafer";

/** 主包正式配置入口。 */
export interface LeaferGraphConfig {
  graph?: LeaferGraphGraphConfig;
  widget?: LeaferGraphWidgetConfig;
  leafer?: LeaferGraphLeaferConfig;
}

/** 主包归一化后的配置。 */
export interface NormalizedLeaferGraphConfig {
  graph: NormalizedLeaferGraphGraphConfig;
  widget: NormalizedLeaferGraphWidgetConfig;
  leafer: NormalizedLeaferGraphLeaferConfig;
}
