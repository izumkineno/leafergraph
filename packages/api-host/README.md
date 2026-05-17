# @leafergraph/api-host

`@leafergraph/api-host` owns the extracted full API host surface for viewer-first root compatibility.

It is responsible for:

- graph API host and facade groups
- document mutation and diff projection helpers
- history, registry, subscriptions, and execution integration
- the replacement surface for `leafergraph/api/graph_api_host`

## Current status

This package is now landed in this checkout.

Its implementation and package-local tests live under `packages/api-host/`, and the root package installs it through a thin compatibility adapter.

The public entry and subpaths exported by this package are the current source of truth for API-host behavior:

- `@leafergraph/api-host`
- `@leafergraph/api-host/graph_api_host`
- `@leafergraph/api-host/facade/install`
- `@leafergraph/api-host/host/controller`
- `@leafergraph/api-host/host/types`
- `@leafergraph/api-host/history`
- `@leafergraph/api-host/runtime_api`
- `@leafergraph/api-host/runtime_history`
- `@leafergraph/api-host/runtime_types`
- `@leafergraph/api-host/types`

## Relationship to the root package

The root `leafergraph` package keeps only the viewer-first default entry and the compatibility subpath that forwards `leafergraph/api/graph_api_host` here.

That compatibility adapter is part of the preservation strategy and remains intentionally rooted.

## Local commands

- `bun run --filter @leafergraph/api-host test`
- `bun run --filter @leafergraph/api-host build`

## Related docs

- [Viewer-first root migration](../../docs/viewer-first-root-migration.md)
- [Viewer-first root split manifest](../../docs/viewer-first-root-split-manifest.md)
