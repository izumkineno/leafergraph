## Why

`packages/basic-kit` repeats the same widget-shell wiring across several controllers. The duplication makes behavior drift more likely and obscures the package's actual behavior, so we need a test-backed cleanup before consolidating the shared logic.

## What Changes

- Add characterization tests for the `basic-kit` public surface before refactoring.
- Extract shared focus, press, render, and cleanup wiring into `template.ts`.
- Keep widget-specific behavior inside each controller.
- Preserve public exports, install order, and runtime behavior.

## Capabilities

### New Capabilities
- `basic-kit-default-content`: `@leafergraph/basic-kit` keeps its public entries stable while the internal widget shell implementation is simplified.

### Modified Capabilities
- none

## Impact

- `packages/basic-kit/src/widget/*`
- `packages/basic-kit/tests/*`
- No public API or package boundary changes.

