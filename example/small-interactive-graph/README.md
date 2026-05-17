# `example/small-interactive-graph`

`small-interactive-graph` is the smallest interaction-focused LeaferGraph example in this workspace.

It exists to show the minimum browser integration needed to work with a real graph:

- native DOM, not Preact
- a preseeded three-node chain
- node select and drag
- port connection interaction
- right-click link disconnect
- canvas pan and zoom

## What it covers

- `leafergraph`
  - viewer-first root graph host
- `@leafergraph/core/node`
  - local `NodeDefinition` and `GraphDocument` helpers

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
2. Select a node.
3. Drag a node to a new position.
4. Reconnect the chain through the ports.
5. Right-click a link to remove it.
6. Pan the canvas.
7. Zoom the canvas.

## Files to inspect first

- `src/main.ts`
- `src/graph/node_definitions.ts`
- `src/graph/example_document.ts`
- `tests/example_graph.test.ts`
