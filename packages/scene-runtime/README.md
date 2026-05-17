# @leafergraph/scene-runtime

`@leafergraph/scene-runtime` owns the viewer-side scene/runtime implementation that was moved out of the root `leafergraph` package.

It is responsible for:

- retained-mode Leafer scene assembly
- node and link visual shells
- interaction hosts and runtime adapters
- theme runtime and runtime-feedback projection

## Current status

This package is now landed in this checkout.

Its implementation and package-local tests live under `packages/scene-runtime/`, and the root package consumes it through normal workspace dependencies.

The public entry and subpaths exported by this package are the current source of truth for scene/runtime behavior:

- `@leafergraph/scene-runtime`
- `@leafergraph/scene-runtime/assembly`
- `@leafergraph/scene-runtime/feedback`
- `@leafergraph/scene-runtime/host`
- `@leafergraph/scene-runtime/interaction`
- `@leafergraph/scene-runtime/link`
- `@leafergraph/scene-runtime/node`
- `@leafergraph/scene-runtime/style`
- `@leafergraph/scene-runtime/theme`
- `@leafergraph/scene-runtime/types`

## Relationship to the root package

The root `leafergraph` package is now viewer-first and composes its runtime surface from this package.

Root-facing composition files can remain in `packages/leafergraph` as thin adapters, but the concrete scene/interaction/link/node/theme implementation now belongs here.

## Local commands

- `bun run --filter @leafergraph/scene-runtime test`
- `bun run --filter @leafergraph/scene-runtime build`

## Related docs

- [Viewer-first root migration](../../docs/viewer-first-root-migration.md)
- [Viewer-first root split manifest](../../docs/viewer-first-root-split-manifest.md)
