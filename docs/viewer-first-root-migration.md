# Viewer-first Root Migration

This note records the landed viewer-first split for the current checkout.

## What landed

- `leafergraph` is now the viewer-first root package.
- `@leafergraph/scene-runtime` owns the scene/runtime implementation.
- `@leafergraph/api-host` owns the full API host implementation.
- `leafergraph/api/graph_api_host` remains as a compatibility path that forwards to `@leafergraph/api-host`.

## Current root shape

The root package now keeps:

- `LeaferGraph`
- `createLeaferGraph(...)`
- a thin compatibility adapter layer
- viewer-first composition code

The concrete scene, interaction, node, link, theme, and API-host implementations now live in the extracted packages.

## Current package responsibilities

| Package | Responsibility |
| --- | --- |
| `leafergraph` | viewer-first root and compatibility surface |
| `@leafergraph/scene-runtime` | scene, interaction, node shell, link visuals, theme runtime, feedback projection |
| `@leafergraph/api-host` | API host, facade groups, history, registry, document/mutation/execution integration |

## Evidence

- `packages/scene-runtime/package.json` and `packages/scene-runtime/tests/*` exist.
- `packages/api-host/package.json` and `packages/api-host/tests/*` exist.
- `packages/leafergraph/src/api/graph_api_host.ts` forwards to `@leafergraph/api-host/graph_api_host`.
- `packages/leafergraph/src/public/leafer_graph.ts` installs the extracted API-host façade.

## Notes

- This is a preservation split, not a deletion split.
- If future work removes the compatibility subpath, that should be tracked in a separate deprecation plan.
