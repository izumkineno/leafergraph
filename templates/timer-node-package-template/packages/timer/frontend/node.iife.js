(function () {
  const runtime = globalThis.LeaferGraphRuntime;
  const bridge = globalThis.LeaferGraphEditorBundleBridge;
  if (!runtime || !bridge || typeof bridge.registerBundle !== "function") {
    throw new Error("LeaferGraphRuntime / LeaferGraphEditorBundleBridge 不可用");
  }

  const timerNodeDefinition = {
    type: "system/timer",
    title: "Timer",
    category: "System",
    description: "图级定时触发节点（Start -> Tick）",
    properties: [
      { name: "intervalMs", type: "number", default: 1000 },
      { name: "immediate", type: "boolean", default: true },
      { name: "runCount", type: "number", default: 0 },
      { name: "status", type: "string", default: "READY" }
    ],
    widgets: [
      {
        type: "input",
        name: "intervalMs",
        value: 1000,
        options: {
          label: "Interval (ms)",
          placeholder: "1000"
        }
      },
      {
        type: "toggle",
        name: "immediate",
        value: true,
        options: {
          label: "Immediate",
          onText: "ON",
          offText: "WAIT"
        }
      }
    ],
    inputs: [{ name: "Start", type: "event" }],
    outputs: [{ name: "Tick", type: "event", label: "Tick" }]
  };

  const timerNodePlugin = {
    name: "@template/timer-node-package/browser-node",
    version: "0.1.0",
    install(ctx) {
      ctx.registerNode(timerNodeDefinition, { overwrite: true });
    }
  };

  bridge.registerBundle({
    id: "@template/timer-node-package/node",
    name: "Timer Node Bundle",
    kind: "node",
    version: "0.1.0",
    plugin: timerNodePlugin,
    quickCreateNodeType: "system/timer"
  });
})();

