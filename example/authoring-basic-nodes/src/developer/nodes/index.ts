export * from "./shared";
export * from "./basic_primitives";
export * from "./basic_data";
export * from "./basic_io_logic";
export * from "./event_flow";
export * from "./event_timing";

import { authoringBasicDataNodeClasses } from "./basic_data";
import { authoringBasicIoLogicNodeClasses } from "./basic_io_logic";
import { authoringBasicPrimitiveNodeClasses } from "./basic_primitives";
import { authoringBasicEventFlowNodeClasses } from "./event_flow";
import { authoringBasicEventTimingNodeClasses } from "./event_timing";

export const authoringBasicNodeClasses = [
  ...authoringBasicPrimitiveNodeClasses,
  ...authoringBasicDataNodeClasses,
  ...authoringBasicIoLogicNodeClasses,
  ...authoringBasicEventFlowNodeClasses,
  ...authoringBasicEventTimingNodeClasses
] as const;
