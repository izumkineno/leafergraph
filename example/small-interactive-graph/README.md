# `example/small-interactive-graph`

`small-interactive-graph` is the smallest interaction-focused LeaferGraph example in this workspace.

It now showcases **custom node capabilities** through two visually distinct nodes:

- **Dashboard Node** - Demonstrates data visualization with circular progress indicator, real-time metrics, and status indicators
- **Configuration Node** - Demonstrates interactive parameters, editable form controls, and custom styling

## What it covers

- `leafergraph`
  - viewer-first root graph host
  - custom node definitions and styling
- `@leafergraph/core/node`
  - local `NodeDefinition` and `GraphDocument` helpers
- Custom rendering
  - Advanced CSS for node internals (progress rings, animations, gradients)
  - Dynamic data binding and state visualization

## What it does not cover

- add-node UI
- global context menu system
- shortcuts
- undo/redo
- authoring bundle loading
- runtime execution shell features

## Run

From the repository root:

```bash
bun run dev:small-interactive-graph
bun run build:small-interactive-graph
bun run preview:small-interactive-graph
```

You can also run the package directly:

```bash
bun run --filter leafergraph-small-interactive-graph-example dev
bun run --filter leafergraph-small-interactive-graph-example build
bun run --filter leafergraph-small-interactive-graph-example preview
```

## Manual interaction checklist

1. Open the example in a browser.
2. Observe the two custom nodes with distinct visual styles.
3. Select a node.
4. Drag a node to a new position.
5. Reconnect nodes via the ports.
6. Right-click a link to remove it.
7. Pan the canvas.
8. Zoom the canvas.

## Files to inspect first

- `src/main.ts` - Bootstrap and app shell
- `src/graph/node_definitions.ts` - Dashboard and Config node definitions
- `src/graph/example_document.ts` - Graph structure with two custom nodes
- `src/graph/custom_node_renderers.ts` - Render configuration and templates
- `src/style.css` - Advanced styling for node internals
- `tests/example_graph.test.ts` - Test suite
