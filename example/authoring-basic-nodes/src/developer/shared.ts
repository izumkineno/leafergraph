import type { NodeWidgetSpec } from "@leafergraph/node";

export const AUTHORING_BASIC_NODES_PACKAGE_NAME =
  "@leafergraph/authoring-basic-nodes";
export const AUTHORING_BASIC_NODES_VERSION = "0.1.0";

export const AUTHORING_BASIC_STATUS_WIDGET_TYPE =
  "authoring-basic/status-readout";
export const AUTHORING_BASIC_STATUS_WIDGET_NAME = "status";

export const AUTHORING_BASIC_NODE_TYPES = {
  time: "basic/time",
  constNumber: "basic/const",
  constBoolean: "basic/boolean",
  constString: "basic/string",
  constObject: "basic/object",
  file: "basic/file",
  jsonparse: "basic/jsonparse",
  data: "basic/data",
  array: "basic/array",
  setArray: "basic/set_array",
  arrayElement: "basic/array[]",
  tableElement: "basic/table[][]",
  objectProperty: "basic/object_property",
  objectKeys: "basic/object_keys",
  setObject: "basic/set_object",
  mergeObjects: "basic/merge_objects",
  variable: "basic/variable",
  dataStore: "basic/data_store",
  download: "basic/download",
  watch: "basic/watch",
  cast: "basic/cast",
  console: "basic/console",
  alert: "basic/alert",
  script: "basic/script",
  compare: "basic/CompareValues",
  eventLog: "events/log",
  eventTrigger: "events/trigger",
  eventSequence: "events/sequence",
  eventWaitAll: "events/waitAll",
  eventStepper: "events/stepper",
  eventFilter: "events/filter",
  eventBranch: "events/branch",
  eventCounter: "events/counter",
  eventOnce: "events/once",
  eventSemaphore: "events/semaphore",
  eventDelay: "events/delay",
  eventTimer: "events/timer"
} as const;

export type AuthoringBasicNodeType =
  (typeof AUTHORING_BASIC_NODE_TYPES)[keyof typeof AUTHORING_BASIC_NODE_TYPES];

export const AUTHORING_BASIC_PRIMITIVE_NODE_TYPES = [
  AUTHORING_BASIC_NODE_TYPES.time,
  AUTHORING_BASIC_NODE_TYPES.constNumber,
  AUTHORING_BASIC_NODE_TYPES.constBoolean,
  AUTHORING_BASIC_NODE_TYPES.constString,
  AUTHORING_BASIC_NODE_TYPES.constObject
] as const;

export const AUTHORING_BASIC_DATA_NODE_TYPES = [
  AUTHORING_BASIC_NODE_TYPES.file,
  AUTHORING_BASIC_NODE_TYPES.jsonparse,
  AUTHORING_BASIC_NODE_TYPES.data,
  AUTHORING_BASIC_NODE_TYPES.array,
  AUTHORING_BASIC_NODE_TYPES.setArray,
  AUTHORING_BASIC_NODE_TYPES.arrayElement,
  AUTHORING_BASIC_NODE_TYPES.tableElement,
  AUTHORING_BASIC_NODE_TYPES.objectProperty,
  AUTHORING_BASIC_NODE_TYPES.objectKeys,
  AUTHORING_BASIC_NODE_TYPES.setObject,
  AUTHORING_BASIC_NODE_TYPES.mergeObjects,
  AUTHORING_BASIC_NODE_TYPES.variable,
  AUTHORING_BASIC_NODE_TYPES.dataStore
] as const;

export const AUTHORING_BASIC_IO_NODE_TYPES = [
  AUTHORING_BASIC_NODE_TYPES.download,
  AUTHORING_BASIC_NODE_TYPES.watch,
  AUTHORING_BASIC_NODE_TYPES.cast,
  AUTHORING_BASIC_NODE_TYPES.console,
  AUTHORING_BASIC_NODE_TYPES.alert,
  AUTHORING_BASIC_NODE_TYPES.script,
  AUTHORING_BASIC_NODE_TYPES.compare
] as const;

export const AUTHORING_BASIC_EVENT_NODE_TYPES = [
  AUTHORING_BASIC_NODE_TYPES.eventLog,
  AUTHORING_BASIC_NODE_TYPES.eventTrigger,
  AUTHORING_BASIC_NODE_TYPES.eventSequence,
  AUTHORING_BASIC_NODE_TYPES.eventWaitAll,
  AUTHORING_BASIC_NODE_TYPES.eventStepper,
  AUTHORING_BASIC_NODE_TYPES.eventFilter,
  AUTHORING_BASIC_NODE_TYPES.eventBranch,
  AUTHORING_BASIC_NODE_TYPES.eventCounter,
  AUTHORING_BASIC_NODE_TYPES.eventOnce,
  AUTHORING_BASIC_NODE_TYPES.eventSemaphore,
  AUTHORING_BASIC_NODE_TYPES.eventDelay,
  AUTHORING_BASIC_NODE_TYPES.eventTimer
] as const;

export function createStatusWidgetSpec(options: {
  label: string;
  description: string;
  value?: string;
}): NodeWidgetSpec {
  return {
    type: AUTHORING_BASIC_STATUS_WIDGET_TYPE,
    name: AUTHORING_BASIC_STATUS_WIDGET_NAME,
    value: options.value ?? "IDLE",
    options: {
      label: options.label,
      description: options.description,
      emptyText: "IDLE"
    }
  };
}
