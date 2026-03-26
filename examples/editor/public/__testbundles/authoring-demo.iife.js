(function () {
  const bridge = globalThis.LeaferGraphEditorBundleBridge;

  if (!bridge || typeof bridge.registerBundle !== "function") {
    throw new Error("LeaferGraphEditorBundleBridge 不存在");
  }

  bridge.registerBundle({
    id: "@editor/authoring-experiment/demo",
    name: "Authoring Demo Bundle",
    kind: "demo",
    version: "0.1.0",
    requires: [
      "@editor/authoring-experiment/widget",
      "@editor/authoring-experiment/node"
    ],
    document: {
      documentId: "editor-authoring-demo-document",
      revision: 1,
      appKind: "leafergraph-local",
      nodes: [
        {
          id: "editor-authoring-node",
          type: "editor/authoring-status-node",
          title: "Authoring Demo Node",
          layout: {
            x: 180,
            y: 128
          },
          properties: {
            label: "Authoring Demo"
          },
          widgets: [
            {
              type: "editor/authoring-status",
              name: "status",
              value: "ready",
              options: {
                label: "Status",
                description: "通过 authoring widget 渲染"
              }
            }
          ]
        }
      ],
      links: []
    }
  });
})();
