import type { LeaferGraphContextMenuBuiltinFeatureDefinition } from "../types";

export const canvasControlsFeature: LeaferGraphContextMenuBuiltinFeatureDefinition = {
  id: "canvasControls",
  register({ registerResolver, play, step, stop, fitView }) {
    return registerResolver("canvas-controls", (context) => {
      if (context.target.kind !== "canvas") {
        return [];
      }

      return [
        {
          kind: "submenu",
          key: "builtin-canvas-controls",
          label: "画布控制",
          order: 20,
          children: [
            {
              key: "builtin-canvas-controls-play",
              label: "Play",
              async onSelect() {
                await play(context);
              }
            },
            {
              key: "builtin-canvas-controls-step",
              label: "Step",
              async onSelect() {
                await step(context);
              }
            },
            {
              key: "builtin-canvas-controls-stop",
              label: "Stop",
              async onSelect() {
                await stop(context);
              }
            },
            {
              key: "builtin-canvas-controls-fit",
              label: "Fit View",
              async onSelect() {
                await fitView(context);
              }
            }
          ]
        }
      ];
    });
  }
};
