## Context

`basic-kit` is the default content package for LeaferGraph. Its widget controllers share the same lifecycle shape: build a field view, register focus handling, bind press/drag handling, and clean up bindings on destroy. Existing tests only cover package-level smoke behavior, so the refactor needs stronger coverage first.

## Goals / Non-Goals

**Goals:**
- Remove repeated widget-shell boilerplate inside `packages/basic-kit`.
- Keep public exports, entry points, and widget behavior stable.
- Add characterization tests that fail if lifecycle behavior changes.

**Non-Goals:**
- Move behavior into `widget-runtime`.
- Change public package boundaries or exported names.
- Redesign widget visuals or editor UX.

## Decisions

- Add small helper methods in `template.ts` for focus binding, press binding, render requests, and primary-key activation.
- Keep widget-specific action/value/menu logic in each controller so the refactor stays readable and local.
- Use characterization tests that exercise real controller lifecycles instead of testing only helper internals.
- Avoid a new cross-widget abstraction layer; the goal is deduplication, not a new framework.

## Risks / Trade-offs

- Over-general helper methods could hide widget-specific behavior. Mitigation: keep helpers small and explicit.
- If the characterization suite misses a widget path, a regression could slip through. Mitigation: cover each built-in widget class with at least one focused test.
- Changing cleanup order could affect focus or press behavior. Mitigation: verify destroy behavior with listener cleanup checks.

## Migration Plan

1. Add tests for current behavior.
2. Extract shared helper methods incrementally.
3. Update each widget controller to use the helpers.
4. Run `basic-kit` tests and build after each batch of edits.

## Open Questions

- None.

