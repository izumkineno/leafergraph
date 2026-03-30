# @leafergraph/authoring-basic-nodes

`@leafergraph/authoring-basic-nodes` is a pure authoring library package.

It exposes the `basic/*` and `events/*` authoring nodes, the shared status
widget, and the assembled LeaferGraph plugin/module entrypoints. This package
does not ship a browser demo app, presets, or sample registry helpers.

## Exports

- default export: `authoringBasicNodesPlugin`
- named exports:
  - `authoringBasicNodesPlugin`
  - `authoringBasicNodesModule`
  - `authoringBasicNodeClasses`
  - `AUTHORING_BASIC_NODE_TYPES`
  - `StatusReadoutWidget`

## Plugin Usage

```ts
import { createLeaferGraph } from "leafergraph";
import authoringBasicNodesPlugin from "@leafergraph/authoring-basic-nodes";

const graph = createLeaferGraph(container);
await graph.ready;
await graph.use(authoringBasicNodesPlugin);
```

## Module Usage

```ts
import { createLeaferGraph } from "leafergraph";
import { authoringBasicNodesModule } from "@leafergraph/authoring-basic-nodes";

const graph = createLeaferGraph(container);
await graph.ready;
graph.installModule(authoringBasicNodesModule);
```

## Build

```bash
bun run build
```

This build only emits ESM library output into `dist/`.

If your host also needs the default `system/on-play` / `system/timer` nodes or
the basic widget set, install `@leafergraph/basic-kit` separately. This package
only provides the authoring nodes and widget entries it defines itself.
