# Viewer-First Root Split Manifest

This manifest records the landed preservation split for `.omx/plans/ralplan-viewer-first-leafergraph-split.md`.

Status values:

- `planned`
- `moved`
- `adapter-left-in-root`
- `merged-into-existing-package`
- `blocked`

## Current split snapshot

- `@leafergraph/scene-runtime` is landed and owns the moved scene/runtime implementation.
- `@leafergraph/api-host` is landed and owns the moved API-host implementation.
- `leafergraph` remains viewer-first and keeps the compatibility adapter for `leafergraph/api/graph_api_host`.

## Source move ledger

| Source path | Destination path | Owner lane | Status | Test destination | Notes |
| --- | --- | --- | --- | --- | --- |
| `packages/leafergraph/src/graph/host/bootstrap.ts` | `packages/scene-runtime/src/graph/host/bootstrap.ts` | Lane 1 | moved | `packages/scene-runtime/tests` | Scene runtime source moved into the extracted package. |
| `packages/leafergraph/src/graph/host/canvas.ts` | `packages/scene-runtime/src/graph/host/canvas.ts` | Lane 1 | moved | `packages/scene-runtime/tests` | Scene runtime source moved into the extracted package. |
| `packages/leafergraph/src/graph/host/mutation.ts` | `packages/scene-runtime/src/graph/host/mutation.ts` | Lane 1 | moved | `packages/scene-runtime/tests` | Scene runtime source moved into the extracted package. |
| `packages/leafergraph/src/graph/host/restore.ts` | `packages/scene-runtime/src/graph/host/restore.ts` | Lane 1 | moved | `packages/scene-runtime/tests` | Scene runtime source moved into the extracted package. |
| `packages/leafergraph/src/graph/host/scene.ts` | `packages/scene-runtime/src/graph/host/scene.ts` | Lane 1 | moved | `packages/scene-runtime/tests` | Scene runtime source moved into the extracted package. |
| `packages/leafergraph/src/graph/host/scene_runtime.ts` | `packages/scene-runtime/src/graph/host/scene_runtime.ts` | Lane 1 | moved | `packages/scene-runtime/tests` | Scene runtime source moved into the extracted package. |
| `packages/leafergraph/src/graph/host/scene_runtime_dispatch.ts` | `packages/scene-runtime/src/graph/host/scene_runtime_dispatch.ts` | Lane 1 | moved | `packages/scene-runtime/tests` | Scene runtime source moved into the extracted package. |
| `packages/leafergraph/src/graph/host/view.ts` | `packages/scene-runtime/src/graph/host/view.ts` | Lane 1 | moved | `packages/scene-runtime/tests` | Scene runtime source moved into the extracted package. |
| `packages/leafergraph/src/graph/assembly/scene.ts` | `packages/scene-runtime/src/graph/assembly/scene.ts` | Lane 1 | moved | `packages/scene-runtime/tests` | Scene runtime source moved into the extracted package. |
| `packages/leafergraph/src/graph/assembly/scene_execution.ts` | `packages/scene-runtime/src/graph/assembly/scene_execution.ts` | Lane 1 | moved | `packages/scene-runtime/tests` | Scene runtime source moved into the extracted package. |
| `packages/leafergraph/src/graph/assembly/scene_interaction.ts` | `packages/scene-runtime/src/graph/assembly/scene_interaction.ts` | Lane 1 | moved | `packages/scene-runtime/tests` | Scene runtime source moved into the extracted package. |
| `packages/leafergraph/src/graph/feedback/local_runtime_adapter.ts` | `packages/scene-runtime/src/graph/feedback/local_runtime_adapter.ts` | Lane 1 | moved | `packages/scene-runtime/tests` | Scene runtime source moved into the extracted package. |
| `packages/leafergraph/src/graph/feedback/projection.ts` | `packages/scene-runtime/src/graph/feedback/projection.ts` | Lane 1 | moved | `packages/scene-runtime/tests` | Scene runtime source moved into the extracted package. |
| `packages/leafergraph/src/graph/theme/host.ts` | `packages/scene-runtime/src/graph/theme/host.ts` | Lane 1 | moved | `packages/scene-runtime/tests` | Scene runtime source moved into the extracted package. |
| `packages/leafergraph/src/graph/theme/runtime.ts` | `packages/scene-runtime/src/graph/theme/runtime.ts` | Lane 1 | moved | `packages/scene-runtime/tests` | Scene runtime source moved into the extracted package. |
| `packages/leafergraph/src/graph/style.ts` | `packages/scene-runtime/src/graph/style.ts` | Lane 1 | moved | `packages/scene-runtime/tests` | Scene runtime source moved into the extracted package. |
| `packages/leafergraph/src/graph/types.ts` | `packages/scene-runtime/src/graph/types.ts` | Lane 1 | moved | `packages/scene-runtime/tests` | Scene runtime source moved into the extracted package. |
| `packages/leafergraph/src/interaction/**/*` | `packages/scene-runtime/src/interaction/**/*` | Lane 1 | moved | `packages/scene-runtime/tests` | Scene runtime interaction sources moved into the extracted package. |
| `packages/leafergraph/src/node/**/*` | `packages/scene-runtime/src/node/**/*` | Lane 1 | moved | `packages/scene-runtime/tests` | Scene runtime node sources moved into the extracted package. |
| `packages/leafergraph/src/link/**/*` | `packages/scene-runtime/src/link/**/*` | Lane 1 | moved | `packages/scene-runtime/tests` | Scene runtime link sources moved into the extracted package. |
| `packages/leafergraph/src/api/graph_api_host.ts` | `packages/api-host/src/graph_api_host.ts` | Lane 2 | adapter-left-in-root | `packages/api-host/tests` | Root compatibility path remains rooted and forwards to the extracted API host. |
| `packages/leafergraph/src/api/host/**/*` | `packages/api-host/src/host/**/*` | Lane 2 | moved | `packages/api-host/tests` | API-host internals moved into the extracted package. |
| `packages/leafergraph/src/public/facade/**/*` | `packages/api-host/src/facade/**/*` | Lane 2 | moved | `packages/api-host/tests` | Public façade implementation moved into the extracted package. |
| `packages/leafergraph/src/graph/assembly/entry.ts` | `packages/scene-runtime/src/assembly/scene.ts` | Lane 3 | adapter-left-in-root | `packages/scene-runtime/tests` | Root-side entry composition remains in place and now delegates to extracted runtime packages. |
| `packages/leafergraph/src/graph/assembly/runtime.ts` | `packages/api-host/src/index.ts` | Lane 3 | adapter-left-in-root | `packages/api-host/tests` | Root-side runtime assembly remains in place and now delegates to extracted runtime packages. |
| `packages/leafergraph/src/graph/assembly/widget_environment.ts` | `packages/api-host/src/widget_environment.ts` | Lane 3 | adapter-left-in-root | `packages/api-host/tests` | Widget environment wiring remains in root as a thin adapter. |
| `packages/leafergraph/src/graph/history.ts` | `packages/api-host/src/history.ts` | Lane 3 | adapter-left-in-root | `packages/api-host/tests` | Root-side history bridge remains in place and forwards to the extracted package. |
| `packages/leafergraph/src/graph/assembly/runtime_api.ts` | `packages/api-host/src/runtime_api.ts` | Lane 3 | adapter-left-in-root | `packages/api-host/tests` | Root-side runtime API bridge remains in place and forwards to the extracted package. |
| `packages/leafergraph/src/graph/assembly/runtime_history.ts` | `packages/api-host/src/runtime_history.ts` | Lane 3 | adapter-left-in-root | `packages/api-host/tests` | Root-side runtime history bridge remains in place and forwards to the extracted package. |

## Test move ledger

| Source test | Destination | Owner lane | Status | Notes |
| --- | --- | --- | --- | --- |
| `packages/leafergraph/tests/node_runtime_host.test.ts` | `packages/leafergraph/tests/node_runtime_host.test.ts` | Lane 3 | adapter-left-in-root | Root compatibility smoke remains rooted. |
| `packages/leafergraph/tests/document_facade.test.ts` | `packages/api-host/tests/document_facade.test.ts` | Lane 2 | moved | API-host package now runs these compatibility tests. |
| `packages/leafergraph/tests/graph_document_diff.test.ts` | `packages/api-host/tests/graph_document_diff.test.ts` | Lane 2 | moved | API-host package now runs these compatibility tests. |
| `packages/leafergraph/tests/history_runtime_integration.test.ts` | `packages/api-host/tests/history_runtime_integration.test.ts` | Lane 2 | moved | API-host package now runs these compatibility tests. |
| `packages/leafergraph/tests/interaction_host_integration.test.ts` | `packages/scene-runtime/tests/interaction_host_integration.test.ts` | Lane 1 | moved | Scene-runtime package now runs these compatibility tests. |
| `packages/leafergraph/tests/link_animation_host.test.ts` | `packages/scene-runtime/tests/link_animation_host.test.ts` | Lane 1 | moved | Scene-runtime package now runs these compatibility tests. |
| `packages/leafergraph/tests/link_propagation_animation_style.test.ts` | `packages/scene-runtime/tests/link_propagation_animation_style.test.ts` | Lane 1 | moved | Scene-runtime package now runs these compatibility tests. |
| `packages/leafergraph/tests/link_theme_runtime_integration.test.ts` | `packages/scene-runtime/tests/link_theme_runtime_integration.test.ts` | Lane 1 | moved | Scene-runtime package now runs these compatibility tests. |
| `packages/leafergraph/tests/node_shell_host.test.ts` | `packages/scene-runtime/tests/node_shell_host.test.ts` | Lane 1 | moved | Scene-runtime package now runs these compatibility tests. |
| `packages/leafergraph/tests/progress_ring.test.ts` | `packages/scene-runtime/tests/progress_ring.test.ts` | Lane 1 | moved | Scene-runtime package now runs these compatibility tests. |
| `packages/leafergraph/tests/public_facade_integration.test.ts` | `packages/api-host/tests/public_facade_integration.test.ts` | Lane 2 | moved | API-host package now runs the façade compatibility tests. |
| `packages/leafergraph/tests/runtime_feedback_host.test.ts` | `packages/scene-runtime/tests/runtime_feedback_host.test.ts` | Lane 1 | moved | Scene-runtime package now runs these compatibility tests. |
| `packages/leafergraph/tests/widget_runtime_integration.test.ts` | `packages/api-host/tests/widget_runtime_integration.test.ts` | Lane 2 | moved | API-host package now runs the widget-runtime compatibility tests. |

## Notes

- Production implementation code is only counted as `moved` when the destination package exists in the checkout.
- Root compatibility adapters remain intentionally rooted until a separate deprecation plan exists.
- `packages/api-host/src/runtime_api.ts` and `packages/api-host/src/runtime_history.ts` are intentionally tracked at the package root because that is where the landed files currently exist.
- The manifest records the landed state of the preservation split, not a future deprecation.
