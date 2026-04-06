## ADDED Requirements

### Requirement: Stable public default-content surface
`@leafergraph/basic-kit` SHALL continue to expose its current public entry points and default-content helpers without changing their names or import paths.

#### Scenario: Root and subpath exports remain available
- **WHEN** a consumer imports `leaferGraphBasicKitPlugin`, `BasicWidgetLibrary`, `BasicWidgetRendererLibrary`, or `createBasicSystemNodeModule`
- **THEN** the package SHALL expose those symbols through the existing root and subpath entry points

### Requirement: Stable default registration order
`BasicWidgetLibrary.createEntries()` SHALL return the default widget entries in the established order, and `leaferGraphBasicKitPlugin.install(...)` SHALL register widget entries before installing the system node module.

#### Scenario: Plugin installs widgets before nodes
- **WHEN** `leaferGraphBasicKitPlugin.install(...)` runs
- **THEN** widget entries SHALL be registered before the system node module is installed

### Requirement: Button and boolean widgets preserve activation behavior
Button, checkbox, and toggle widgets SHALL respond to pointer activation and primary keyboard activation (`Space` or `Enter`) with the same behavior as before the refactor.

#### Scenario: Pointer and keyboard activation still work
- **WHEN** a user activates one of these widgets through pointer press or focused `Space`/`Enter`
- **THEN** the widget SHALL focus itself and dispatch the same action or value toggle behavior as before

### Requirement: Select and radio widgets preserve option behavior
Select and radio widgets SHALL preserve option opening, option selection, and disabled-option skipping behavior.

#### Scenario: Option widgets keep their selection rules
- **WHEN** a user opens select or radio widgets through pointer or keyboard interaction
- **THEN** the widget SHALL keep its established option ordering, selection, and disabled-item handling

### Requirement: Text and slider widgets preserve editing and range behavior
Text widgets SHALL keep their edit request behavior, and slider widgets SHALL keep their drag and step-based range behavior.

#### Scenario: Text and slider interactions remain stable
- **WHEN** a text widget begins editing or a slider widget is dragged or adjusted with arrow keys
- **THEN** the widget SHALL preserve its current request shape, range bounds, and committed value behavior

### Requirement: Widget lifecycle cleanup remains effective
Mounted widgets SHALL release focus bindings and interaction bindings when destroyed.

#### Scenario: Destroy removes active listeners
- **WHEN** a mounted widget is destroyed
- **THEN** later pointer or keyboard events SHALL no longer update the widget or trigger its bound behavior

