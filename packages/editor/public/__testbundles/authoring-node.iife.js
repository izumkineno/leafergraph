(function () {
  const bridge = globalThis.LeaferGraphEditorBundleBridge;
  const authoring = globalThis.LeaferGraphAuthoring;

  if (!bridge || typeof bridge.registerBundle !== "function") {
    throw new Error("LeaferGraphEditorBundleBridge 不存在");
  }

  if (!authoring) {
    throw new Error("LeaferGraphAuthoring 不存在");
  }

  class AuthoringStatusNode extends authoring.BaseNode {
    static meta = {
      type: "editor/authoring-status-node",
      title: "Authoring Status Node",
      category: "Authoring",
      description: "editor 内的 authoring 节点加载实验",
      size: [288, 164],
      widgets: [
        {
          type: "editor/authoring-status",
          name: "status",
          value: "ready",
          options: {
            label: "Status",
            description: "由 authoring widget 渲染"
          }
        }
      ],
      properties: [
        {
          name: "label",
          type: "string",
          default: "Authoring Demo"
        }
      ]
    };

    onCreate(ctx) {
      if (!ctx.getWidget("status")) {
        ctx.setWidget("status", "ready");
      }

      if (!ctx.props.label) {
        ctx.setProp("label", "Authoring Demo");
      }
    }
  }

  bridge.registerBundle({
    id: "@editor/authoring-experiment/node",
    name: "Authoring Node Bundle",
    kind: "node",
    version: "0.1.0",
    requires: ["@editor/authoring-experiment/widget"],
    plugin: authoring.createAuthoringPlugin({
      name: "@editor/authoring-experiment/node-plugin",
      nodes: [AuthoringStatusNode]
    }),
    quickCreateNodeType: "editor/authoring-status-node"
  });
})();
