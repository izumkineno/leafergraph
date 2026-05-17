# Package Split Verification

## Purpose

This document records the current viewer-first root split verification evidence.

## Current state

The split is landed in this checkout:

- `@leafergraph/scene-runtime` exists and owns the moved scene/runtime implementation.
- `@leafergraph/api-host` exists and owns the moved API-host implementation.
- `leafergraph` is now a viewer-first root with a compatibility adapter for `leafergraph/api/graph_api_host`.

## Evidence observed in this checkout

- `git status --short`
  - shows `packages/scene-runtime/**` and `packages/api-host/**` as landed package trees
  - shows root-facing docs updated to reflect the viewer-first split
- `rg --files packages/scene-runtime packages/api-host`
  - shows both extracted packages with source and test files
- `packages/leafergraph/src/public/leafer_graph.ts`
  - installs the extracted API-host façade
- `packages/leafergraph/src/api/graph_api_host.ts`
  - forwards to `@leafergraph/api-host/graph_api_host`

## Verification commands to run

- `bun run --filter @leafergraph/scene-runtime test`
- `bun run --filter @leafergraph/scene-runtime build`
- `bun run --filter @leafergraph/api-host test`
- `bun run --filter @leafergraph/api-host build`
- `bun run --filter leafergraph test`
- `bun run test:workspace-boundaries`
- `bun run check:boundaries`

## Notes

- The split manifest is the authoritative source for move destinations and preservation status.
- If any of the commands above fail, the failure should be treated as a code or boundary issue, not as a doc issue.
