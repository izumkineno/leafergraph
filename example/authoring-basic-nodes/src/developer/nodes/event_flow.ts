import { BaseNode } from "@leafergraph/authoring";

import {
  getTriggeredInputSlot,
  readWidgetBoolean,
  readWidgetString,
  toDisplayText,
  updateStatus
} from "../helpers";
import {
  AUTHORING_BASIC_NODE_TYPES,
  createStatusWidgetSpec
} from "../shared";

function createSequenceInputName(index: number): string {
  return `in_${index + 1}`;
}

function createSequenceOutputName(index: number): string {
  return `out_${index + 1}`;
}

function createStepperOutputName(index: number): string {
  return `step_${index + 1}`;
}

function clampIndex(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export class EventLogNode extends BaseNode {
  static meta = {
    type: AUTHORING_BASIC_NODE_TYPES.eventLog,
    title: "Log Event",
    category: "Events/Flow",
    inputs: [{ name: "event", type: "event" }],
    widgets: [
      createStatusWidgetSpec({
        label: "Event Log",
        description: "Writes action and payload into the browser console"
      })
    ]
  };

  onAction(action, param, _options, ctx) {
    console.log(`[events/log] ${action}`, param);
    updateStatus(ctx, `EVENT\n${action}: ${toDisplayText(param)}`);
  }
}

export class TriggerEventNode extends BaseNode {
  static meta = {
    type: AUTHORING_BASIC_NODE_TYPES.eventTrigger,
    title: "TriggerEvent",
    category: "Events/Flow",
    inputs: [{ name: "if", type: 0 as const }],
    outputs: [
      { name: "true", type: "event" },
      { name: "change", type: "event" },
      { name: "false", type: "event" }
    ],
    properties: [{ name: "only_on_change", type: "boolean", default: true }],
    widgets: [
      {
        type: "toggle",
        name: "only_on_change",
        value: true,
        options: {
          label: "On Change",
          onText: "CHANGE",
          offText: "LEVEL"
        }
      },
      createStatusWidgetSpec({
        label: "Trigger",
        description: "Turns a truthy input into event outputs"
      })
    ]
  };

  createState() {
    return {
      initialized: false,
      previous: false
    };
  }

  onExecute(ctx) {
    const value = Boolean(ctx.getInput("if"));
    const onlyOnChange = readWidgetBoolean(ctx, "only_on_change", true);
    const changed = ctx.state.initialized ? value !== ctx.state.previous : false;
    const shouldResend =
      (changed && onlyOnChange) || (!changed && !onlyOnChange);

    ctx.setProp("only_on_change", onlyOnChange);
    if (value && shouldResend) {
      ctx.setOutput("true", value);
    }
    if (!value && shouldResend) {
      ctx.setOutput("false", value);
    }
    if (changed) {
      ctx.setOutput("change", {
        previous: ctx.state.previous,
        value
      });
    }

    ctx.state.previous = value;
    ctx.state.initialized = true;
    updateStatus(
      ctx,
      `${value ? "TRUE" : "FALSE"}\n${onlyOnChange ? "change-only" : "level"}`
    );
  }
}

export class SequenceNode extends BaseNode {
  static meta = {
    type: AUTHORING_BASIC_NODE_TYPES.eventSequence,
    title: "Sequence",
    category: "Events/Flow",
    inputs: [
      { name: createSequenceInputName(0), type: "event" },
      { name: createSequenceInputName(1), type: "event" },
      { name: createSequenceInputName(2), type: "event" }
    ],
    outputs: [
      { name: createSequenceOutputName(0), type: "event" },
      { name: createSequenceOutputName(1), type: "event" },
      { name: createSequenceOutputName(2), type: "event" }
    ],
    widgets: [
      {
        type: "button",
        name: "add_step",
        value: null,
        options: {
          label: "Ports",
          text: "+ Step"
        }
      },
      {
        type: "button",
        name: "remove_step",
        value: null,
        options: {
          label: "Ports",
          text: "- Step"
        }
      },
      createStatusWidgetSpec({
        label: "Sequence",
        description: "Broadcasts the same event payload to every output"
      })
    ]
  };

  onAction(action, param, _options, ctx) {
    if (action === "add_step") {
      const nextIndex = ctx.node.outputs.length;
      ctx.api.addInput(createSequenceInputName(nextIndex), "event");
      ctx.api.addOutput(createSequenceOutputName(nextIndex), "event");
      updateStatus(ctx, `PORTS\n${ctx.node.outputs.length} steps`);
      return;
    }

    if (action === "remove_step") {
      if (ctx.node.outputs.length <= 2 || ctx.node.inputs.length <= 2) {
        updateStatus(ctx, "PORTS\nMinimum 2 steps");
        return;
      }
      ctx.api.removeInput(ctx.node.inputs.length - 1);
      ctx.api.removeOutput(ctx.node.outputs.length - 1);
      updateStatus(ctx, `PORTS\n${ctx.node.outputs.length} steps`);
      return;
    }

    if (!action.startsWith("in_")) {
      return;
    }

    for (let index = 0; index < ctx.node.outputs.length; index += 1) {
      ctx.setOutputAt(index, param);
    }
    updateStatus(ctx, `FIRED\n${ctx.node.outputs.length} outputs`);
  }
}

export class WaitAllNode extends BaseNode {
  static meta = {
    type: AUTHORING_BASIC_NODE_TYPES.eventWaitAll,
    title: "WaitAll",
    category: "Events/Flow",
    inputs: [
      { name: "signal_1", type: "event" },
      { name: "signal_2", type: "event" }
    ],
    outputs: [{ name: "done", type: "event" }],
    widgets: [
      {
        type: "button",
        name: "add_guard",
        value: null,
        options: {
          label: "Guards",
          text: "+ Guard"
        }
      },
      {
        type: "button",
        name: "remove_guard",
        value: null,
        options: {
          label: "Guards",
          text: "- Guard"
        }
      },
      {
        type: "button",
        name: "reset",
        value: null,
        options: {
          label: "Guards",
          text: "Reset"
        }
      },
      createStatusWidgetSpec({
        label: "WaitAll",
        description: "Collects each event input once before releasing output"
      })
    ]
  };

  createState() {
    return {
      ready: [] as boolean[]
    };
  }

  onAction(action, param, options, ctx) {
    if (action === "add_guard") {
      const nextIndex = ctx.node.inputs.length;
      ctx.api.addInput(`signal_${nextIndex + 1}`, "event");
      updateStatus(ctx, `WAIT\n0 / ${ctx.node.inputs.length} ready`);
      return;
    }

    if (action === "remove_guard") {
      if (ctx.node.inputs.length <= 2) {
        updateStatus(ctx, "WAIT\nMinimum 2 guards");
        return;
      }
      ctx.api.removeInput(ctx.node.inputs.length - 1);
      ctx.state.ready.length = Math.min(ctx.state.ready.length, ctx.node.inputs.length);
      updateStatus(ctx, `WAIT\n0 / ${ctx.node.inputs.length} ready`);
      return;
    }

    if (action === "reset") {
      ctx.state.ready = [];
      updateStatus(ctx, `WAIT\n0 / ${ctx.node.inputs.length} ready`);
      return;
    }

    const slotIndex = getTriggeredInputSlot(options);
    if (slotIndex === undefined) {
      return;
    }

    ctx.state.ready.length = ctx.node.inputs.length;
    ctx.state.ready[slotIndex] = true;
    const readyCount = ctx.state.ready.filter(Boolean).length;
    if (readyCount < ctx.node.inputs.length) {
      updateStatus(ctx, `WAIT\n${readyCount} / ${ctx.node.inputs.length} ready`);
      return;
    }

    ctx.state.ready = [];
    ctx.setOutput("done", param);
    updateStatus(ctx, "DONE\nAll guards satisfied");
  }
}

export class StepperNode extends BaseNode {
  static meta = {
    type: AUTHORING_BASIC_NODE_TYPES.eventStepper,
    title: "Stepper",
    category: "Events/Flow",
    inputs: [
      { name: "index", type: "number", optional: true },
      { name: "step", type: "event", optional: true },
      { name: "reset", type: "event", optional: true }
    ],
    outputs: [
      { name: "index", type: "number" },
      { name: createStepperOutputName(0), type: "event" },
      { name: createStepperOutputName(1), type: "event" },
      { name: createStepperOutputName(2), type: "event" }
    ],
    properties: [{ name: "index", type: "number", default: 0 }],
    widgets: [
      {
        type: "button",
        name: "add_output",
        value: null,
        options: {
          label: "Steps",
          text: "+ Output"
        }
      },
      {
        type: "button",
        name: "remove_output",
        value: null,
        options: {
          label: "Steps",
          text: "- Output"
        }
      },
      createStatusWidgetSpec({
        label: "Stepper",
        description: "Steps through event outputs in order"
      })
    ]
  };

  createState() {
    return {
      index: 0
    };
  }

  onExecute(ctx) {
    const eventOutputCount = Math.max(1, ctx.node.outputs.length - 1);
    const inputIndex = ctx.getInput("index");
    if (typeof inputIndex === "number" && Number.isFinite(inputIndex)) {
      const nextIndex = clampIndex(
        Math.floor(inputIndex),
        0,
        eventOutputCount - 1
      );
      if (nextIndex !== ctx.state.index) {
        ctx.state.index = nextIndex;
        ctx.setProp("index", nextIndex);
        ctx.setOutputAt(nextIndex + 1, {
          index: nextIndex
        });
      }
    }

    ctx.setOutput("index", ctx.state.index);
    updateStatus(
      ctx,
      `STEP\n${ctx.state.index + 1} / ${eventOutputCount}`
    );
  }

  onAction(action, param, _options, ctx) {
    if (action === "add_output") {
      const nextIndex = ctx.node.outputs.length - 1;
      ctx.api.addOutput(createStepperOutputName(nextIndex), "event");
      updateStatus(ctx, `STEP\n${ctx.state.index + 1} / ${ctx.node.outputs.length - 1}`);
      return;
    }

    if (action === "remove_output") {
      if (ctx.node.outputs.length <= 3) {
        updateStatus(ctx, "STEP\nMinimum 2 event outputs");
        return;
      }
      ctx.api.removeOutput(ctx.node.outputs.length - 1);
      ctx.state.index = clampIndex(ctx.state.index, 0, ctx.node.outputs.length - 2);
      ctx.setProp("index", ctx.state.index);
      updateStatus(ctx, `STEP\n${ctx.state.index + 1} / ${ctx.node.outputs.length - 1}`);
      return;
    }

    if (action === "reset") {
      ctx.state.index = 0;
      ctx.setProp("index", 0);
      updateStatus(ctx, `STEP\n1 / ${ctx.node.outputs.length - 1}`);
      return;
    }

    if (action === "step") {
      ctx.setOutputAt(ctx.state.index + 1, param);
      const total = Math.max(1, ctx.node.outputs.length - 1);
      ctx.state.index = (ctx.state.index + 1) % total;
      ctx.setProp("index", ctx.state.index);
      updateStatus(ctx, `STEP\n${ctx.state.index + 1} / ${total}`);
    }
  }
}

export class FilterEventNode extends BaseNode {
  static meta = {
    type: AUTHORING_BASIC_NODE_TYPES.eventFilter,
    title: "Filter Event",
    category: "Events/Flow",
    inputs: [{ name: "event", type: "event" }],
    outputs: [{ name: "event", type: "event" }],
    properties: [
      { name: "equal_to", type: "string", default: "" },
      { name: "has_property", type: "string", default: "" },
      { name: "property_equal_to", type: "string", default: "" }
    ],
    widgets: [
      {
        type: "input",
        name: "equal_to",
        value: "",
        options: {
          label: "Equals"
        }
      },
      {
        type: "input",
        name: "has_property",
        value: "",
        options: {
          label: "Property"
        }
      },
      {
        type: "input",
        name: "property_equal_to",
        value: "",
        options: {
          label: "Prop ="
        }
      },
      createStatusWidgetSpec({
        label: "Filter",
        description: "Only forwards payloads matching the configured rules"
      })
    ]
  };

  onAction(action, param, _options, ctx) {
    if (action !== "event" || param == null) {
      return;
    }

    const equalTo = readWidgetString(ctx, "equal_to", "");
    const hasProperty = readWidgetString(ctx, "has_property", "");
    const propertyEqualTo = readWidgetString(ctx, "property_equal_to", "");
    ctx.setProp("equal_to", equalTo);
    ctx.setProp("has_property", hasProperty);
    ctx.setProp("property_equal_to", propertyEqualTo);

    if (equalTo && String(param) !== equalTo) {
      updateStatus(ctx, "BLOCKED\nValue mismatch");
      return;
    }

    if (hasProperty) {
      if (typeof param !== "object" || param === null) {
        updateStatus(ctx, "BLOCKED\nPayload is not an object");
        return;
      }
      const propertyValue = (param as Record<string, unknown>)[hasProperty];
      if (propertyValue == null) {
        updateStatus(ctx, `BLOCKED\nMissing ${hasProperty}`);
        return;
      }
      if (propertyEqualTo && String(propertyValue) !== propertyEqualTo) {
        updateStatus(ctx, `BLOCKED\n${hasProperty} mismatch`);
        return;
      }
    }

    ctx.setOutput("event", param);
    updateStatus(ctx, `PASSED\n${toDisplayText(param)}`);
  }
}

export class BranchEventNode extends BaseNode {
  static meta = {
    type: AUTHORING_BASIC_NODE_TYPES.eventBranch,
    title: "Branch",
    category: "Events/Flow",
    inputs: [
      { name: "in", type: "event" },
      { name: "cond", type: "boolean", optional: true }
    ],
    outputs: [
      { name: "true", type: "event" },
      { name: "false", type: "event" }
    ],
    widgets: [
      createStatusWidgetSpec({
        label: "Branch",
        description: "Routes the event according to cond"
      })
    ]
  };

  createState() {
    return {
      value: false
    };
  }

  onExecute(ctx) {
    ctx.state.value = Boolean(ctx.getInput("cond"));
    updateStatus(ctx, ctx.state.value ? "TRUE\nRoute → true" : "FALSE\nRoute → false");
  }

  onAction(action, param, _options, ctx) {
    if (action !== "in") {
      return;
    }

    ctx.state.value = Boolean(ctx.getInput("cond"));
    ctx.setOutput(ctx.state.value ? "true" : "false", param);
    updateStatus(ctx, ctx.state.value ? "TRUE\nTriggered true" : "FALSE\nTriggered false");
  }
}

export class CounterEventNode extends BaseNode {
  static meta = {
    type: AUTHORING_BASIC_NODE_TYPES.eventCounter,
    title: "Counter",
    category: "Events/Flow",
    inputs: [
      { name: "inc", type: "event", optional: true },
      { name: "dec", type: "event", optional: true },
      { name: "reset", type: "event", optional: true }
    ],
    outputs: [
      { name: "change", type: "event" },
      { name: "num", type: "number" }
    ],
    properties: [{ name: "doCountExecution", type: "boolean", default: false }],
    widgets: [
      {
        type: "toggle",
        name: "doCountExecution",
        value: false,
        options: {
          label: "Count Exec.",
          onText: "ON",
          offText: "OFF"
        }
      },
      {
        type: "button",
        name: "reset_counter",
        value: null,
        options: {
          label: "Counter",
          text: "Reset"
        }
      },
      createStatusWidgetSpec({
        label: "Counter",
        description: "Counts event actions and optional execute pulses"
      })
    ]
  };

  createState() {
    return {
      num: 0
    };
  }

  onExecute(ctx) {
    const shouldCountExecution = readWidgetBoolean(ctx, "doCountExecution", false);
    ctx.setProp("doCountExecution", shouldCountExecution);
    if (shouldCountExecution) {
      ctx.state.num += 1;
    }
    ctx.setOutput("num", ctx.state.num);
    updateStatus(ctx, `COUNT\n${ctx.state.num}`);
  }

  onAction(action, _param, _options, ctx) {
    const previous = ctx.state.num;
    if (action === "inc") {
      ctx.state.num += 1;
    } else if (action === "dec") {
      ctx.state.num -= 1;
    } else if (action === "reset" || action === "reset_counter") {
      ctx.state.num = 0;
    } else {
      return;
    }

    if (ctx.state.num !== previous) {
      ctx.setOutput("change", ctx.state.num);
    }
    ctx.setOutput("num", ctx.state.num);
    updateStatus(ctx, `COUNT\n${ctx.state.num}`);
  }
}

export class OnceEventNode extends BaseNode {
  static meta = {
    type: AUTHORING_BASIC_NODE_TYPES.eventOnce,
    title: "Once",
    category: "Events/Flow",
    inputs: [
      { name: "in", type: "event", optional: true },
      { name: "reset", type: "event", optional: true }
    ],
    outputs: [{ name: "out", type: "event" }],
    widgets: [
      {
        type: "button",
        name: "reset_once",
        value: null,
        options: {
          label: "Lock",
          text: "Reset"
        }
      },
      createStatusWidgetSpec({
        label: "Once",
        description: "Forwards the first event and then locks"
      })
    ]
  };

  createState() {
    return {
      locked: false
    };
  }

  onAction(action, param, _options, ctx) {
    if (action === "reset" || action === "reset_once") {
      ctx.state.locked = false;
      updateStatus(ctx, "READY\nWaiting for first event");
      return;
    }

    if (action !== "in") {
      return;
    }

    if (ctx.state.locked) {
      updateStatus(ctx, "LOCKED\nReset to open again");
      return;
    }

    ctx.state.locked = true;
    ctx.setOutput("out", param);
    updateStatus(ctx, "FIRED\nNow locked");
  }
}

export class SemaphoreEventNode extends BaseNode {
  static meta = {
    type: AUTHORING_BASIC_NODE_TYPES.eventSemaphore,
    title: "Semaphore Event",
    category: "Events/Flow",
    inputs: [
      { name: "go", type: "event", optional: true },
      { name: "green", type: "event", optional: true },
      { name: "red", type: "event", optional: true }
    ],
    outputs: [
      { name: "continue", type: "event" },
      { name: "blocked", type: "event" },
      { name: "is_green", type: "boolean" }
    ],
    widgets: [
      {
        type: "button",
        name: "reset_gate",
        value: null,
        options: {
          label: "Gate",
          text: "Reset"
        }
      },
      createStatusWidgetSpec({
        label: "Semaphore",
        description: "Green opens the gate, red blocks it"
      })
    ]
  };

  createState() {
    return {
      ready: false
    };
  }

  onExecute(ctx) {
    ctx.setOutput("is_green", ctx.state.ready);
    updateStatus(ctx, ctx.state.ready ? "GREEN\nGate open" : "RED\nGate blocked");
  }

  onAction(action, param, _options, ctx) {
    if (action === "green") {
      ctx.state.ready = true;
      ctx.setOutput("is_green", true);
      updateStatus(ctx, "GREEN\nGate open");
      return;
    }

    if (action === "red" || action === "reset_gate") {
      ctx.state.ready = false;
      ctx.setOutput("is_green", false);
      updateStatus(ctx, "RED\nGate blocked");
      return;
    }

    if (action !== "go") {
      return;
    }

    ctx.setOutput(ctx.state.ready ? "continue" : "blocked", param);
    updateStatus(
      ctx,
      ctx.state.ready ? "GREEN\nContinue fired" : "RED\nBlocked fired"
    );
  }
}

export const authoringBasicEventFlowNodeClasses = [
  EventLogNode,
  TriggerEventNode,
  SequenceNode,
  WaitAllNode,
  StepperNode,
  FilterEventNode,
  BranchEventNode,
  CounterEventNode,
  OnceEventNode,
  SemaphoreEventNode
] as const;
