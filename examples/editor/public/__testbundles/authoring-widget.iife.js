(function () {
  const bridge = globalThis.LeaferGraphEditorBundleBridge;
  const authoring = globalThis.LeaferGraphAuthoring;

  if (!bridge || typeof bridge.registerBundle !== "function") {
    throw new Error("LeaferGraphEditorBundleBridge 不存在");
  }

  if (!authoring) {
    throw new Error("LeaferGraphAuthoring 不存在");
  }

  class AuthoringStatusWidget extends authoring.BaseWidget {
    static meta = {
      type: "editor/authoring-status",
      title: "Authoring Status",
      description: "editor 内部 authoring 外部 widget 实验"
    };

    mount(ctx) {
      const labelFill = ctx.theme?.tokens?.labelFill ?? "#CBD5E1";
      const fontFamily = ctx.theme?.tokens?.fontFamily;
      const label = new ctx.ui.Text({
        x: 0,
        y: 0,
        width: ctx.bounds.width,
        text: "Authoring Status",
        fill: labelFill,
        fontFamily,
        fontSize: 11,
        hittable: false
      });
      const surface = new ctx.ui.Rect({
        x: 0,
        y: 18,
        width: ctx.bounds.width,
        height: 24,
        cornerRadius: 12,
        fill: "#0F766E",
        stroke: "#0B5E58",
        strokeWidth: 1,
        hittable: false
      });
      const valueText = new ctx.ui.Text({
        x: 0,
        y: 23,
        width: ctx.bounds.width,
        text: String(ctx.value ?? "ready"),
        textAlign: "center",
        fill: "#F8FAFC",
        fontFamily,
        fontSize: 12,
        fontWeight: "700",
        hittable: false
      });

      ctx.group.add([label, surface, valueText]);
      return {
        valueText
      };
    }

    update(state, ctx, nextValue) {
      if (!state) {
        return;
      }

      state.valueText.text = String(nextValue ?? ctx.value ?? "ready");
    }
  }

  bridge.registerBundle({
    id: "@editor/authoring-experiment/widget",
    name: "Authoring Widget Bundle",
    kind: "widget",
    version: "0.1.0",
    plugin: authoring.createAuthoringPlugin({
      name: "@editor/authoring-experiment/widget-plugin",
      widgets: [AuthoringStatusWidget]
    }),
    quickCreateNodeType: "editor/authoring-status-node"
  });
})();
