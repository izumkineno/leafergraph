import type { LeaferContextMenuBuiltinFeatureDefinition } from "../types";

export const canvasControlsFeature: LeaferContextMenuBuiltinFeatureDefinition = {
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
              onSelect() {
                play(context);
              }
            },
            {
              key: "builtin-canvas-controls-step",
              label: "Step",
              onSelect() {
                step(context);
              }
            },
            {
              key: "builtin-canvas-controls-stop",
              label: "Stop",
              onSelect() {
                stop(context);
              }
            },
            {
              key: "builtin-canvas-controls-fit",
              label: "Fit View",
              onSelect() {
                fitView(context);
              }
            }
          ]
        }
      ];
    });
  }
};
