import type {
  RuntimeBridgeBlueprintCatalogEntry,
  RuntimeBridgeComponentCatalogEntry,
  RuntimeBridgeExtensionsSync,
  RuntimeBridgeNodeCatalogEntry
} from "@leafergraph/runtime-bridge";

export type DemoComponentEntryForm = {
  entryId: string;
  name: string;
  detectedWidgetTypes: string[];
  browserFile: File | null;
  analysisError: string | null;
};

export type DemoNodeEntryForm = {
  entryId: string;
  name: string;
  detectedAuthorityNodeTypes: string[];
  detectedBrowserNodeTypes: string[];
  requiredWidgetTypes: string[];
  exportedWidgetTypes: string[];
  selectedComponentEntryIds: string[];
  authorityFile: File | null;
  browserFile: File | null;
  analysisError: string | null;
};

export type DemoBlueprintEntryForm = {
  entryId: string;
  name: string;
  detectedNodeTypes: string[];
  detectedWidgetTypes: string[];
  selectedNodeEntryIds: string[];
  selectedComponentEntryIds: string[];
  documentFile: File | null;
  analysisError: string | null;
};

export interface RuntimeBridgeCatalogPanelProps {
  ready: boolean;
  busyAction: string | null;
  sync: RuntimeBridgeExtensionsSync;
  componentEntries: RuntimeBridgeComponentCatalogEntry[];
  nodeEntries: RuntimeBridgeNodeCatalogEntry[];
  blueprintEntries: RuntimeBridgeBlueprintCatalogEntry[];
  componentForm: DemoComponentEntryForm;
  nodeForm: DemoNodeEntryForm;
  blueprintForm: DemoBlueprintEntryForm;
  onRefreshCatalog(): void;
  onLoadEntry(entryId: string): void;
  onUnloadEntry(entryId: string): void;
  onUnregisterEntry(entryId: string): void;
  onLoadBlueprint(entryId: string): void;
  onUnloadBlueprint(): void;
  onComponentFormChange(nextForm: DemoComponentEntryForm): void;
  onNodeFormChange(nextForm: DemoNodeEntryForm): void;
  onBlueprintFormChange(nextForm: DemoBlueprintEntryForm): void;
  onRegisterComponentEntry(): void;
  onRegisterNodeEntry(): void;
  onRegisterBlueprintEntry(): void;
}

/**
 * 远端目录与上传面板。
 *
 * @param props - 面板 props。
 * @returns JSX。
 */
export function RuntimeBridgeCatalogPanel(
  props: RuntimeBridgeCatalogPanelProps
) {
  const selectedNodeComponentWidgetTypes = collectCoveredWidgetTypes(
    props.componentEntries,
    props.nodeForm.selectedComponentEntryIds
  );
  const selectedBlueprintNodeTypes = collectCoveredNodeTypes(
    props.nodeEntries,
    props.blueprintForm.selectedNodeEntryIds
  );
  const selectedBlueprintWidgetTypes = collectCoveredWidgetTypes(
    props.componentEntries,
    props.blueprintForm.selectedComponentEntryIds
  );
  const missingNodeComponentWidgetTypes = props.nodeForm.requiredWidgetTypes.filter(
    (type) => !selectedNodeComponentWidgetTypes.has(type)
  );
  const missingBlueprintNodeTypes = props.blueprintForm.detectedNodeTypes.filter(
    (type) => !selectedBlueprintNodeTypes.has(type)
  );
  const missingBlueprintWidgetTypes = props.blueprintForm.detectedWidgetTypes.filter(
    (type) => !selectedBlueprintWidgetTypes.has(type)
  );

  return (
    <section className="catalog-card">
      <div className="catalog-heading">
        <div>
          <p className="eyebrow">远端扩展</p>
          <h2>目录与加载</h2>
        </div>
        <div className="catalog-heading-side">
          <span className="catalog-count">
            节点 {props.sync.activeNodeEntryIds.length} / 组件{" "}
            {props.sync.activeComponentEntryIds.length}
          </span>
          <button
            className="catalog-refresh"
            disabled={!props.ready || props.busyAction !== null}
            onClick={props.onRefreshCatalog}
          >
            刷新
          </button>
        </div>
      </div>

      <div className="catalog-groups">
        <div className="catalog-group">
          <div className="catalog-group-title">组件条目</div>
          {props.componentEntries.map((entry) => {
            const active = props.sync.activeComponentEntryIds.includes(entry.entryId);
            return (
              <article className="catalog-entry" key={entry.entryId}>
                <div className="catalog-entry-head">
                  <div>
                    <strong>{entry.name}</strong>
                    <span>{entry.entryId}</span>
                  </div>
                  <span className={`catalog-badge ${active ? "active" : ""}`}>
                    {active ? "已加载" : "未加载"}
                  </span>
                </div>
                <p>{entry.widgetTypes.join(", ") || "无 widgetTypes"}</p>
                <div className="catalog-entry-actions">
                  <button
                    disabled={!props.ready || props.busyAction !== null}
                    onClick={() =>
                      active
                        ? props.onUnloadEntry(entry.entryId)
                        : props.onLoadEntry(entry.entryId)
                    }
                  >
                    {active ? "卸载" : "加载"}
                  </button>
                  <button
                    disabled={!props.ready || props.busyAction !== null}
                    onClick={() => props.onUnregisterEntry(entry.entryId)}
                  >
                    注销
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <div className="catalog-group">
          <div className="catalog-group-title">节点条目</div>
          {props.nodeEntries.map((entry) => {
            const active = props.sync.activeNodeEntryIds.includes(entry.entryId);
            return (
              <article className="catalog-entry" key={entry.entryId}>
                <div className="catalog-entry-head">
                  <div>
                    <strong>{entry.name}</strong>
                    <span>{entry.entryId}</span>
                  </div>
                  <span className={`catalog-badge ${active ? "active" : ""}`}>
                    {active ? "已加载" : "未加载"}
                  </span>
                </div>
                <p>节点: {entry.nodeTypes.join(", ") || "无"}</p>
                <p>依赖组件: {entry.componentEntryIds.join(", ") || "无"}</p>
                <div className="catalog-entry-actions">
                  <button
                    disabled={!props.ready || props.busyAction !== null}
                    onClick={() =>
                      active
                        ? props.onUnloadEntry(entry.entryId)
                        : props.onLoadEntry(entry.entryId)
                    }
                  >
                    {active ? "卸载" : "加载"}
                  </button>
                  <button
                    disabled={!props.ready || props.busyAction !== null}
                    onClick={() => props.onUnregisterEntry(entry.entryId)}
                  >
                    注销
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <div className="catalog-group">
          <div className="catalog-group-title">蓝图条目</div>
          {props.blueprintEntries.map((entry) => {
            const active = props.sync.currentBlueprintId === entry.entryId;
            return (
              <article className="catalog-entry" key={entry.entryId}>
                <div className="catalog-entry-head">
                  <div>
                    <strong>{entry.name}</strong>
                    <span>{entry.entryId}</span>
                  </div>
                  <span className={`catalog-badge ${active ? "active" : ""}`}>
                    {active ? "当前蓝图" : "可加载"}
                  </span>
                </div>
                <p>节点依赖: {entry.nodeEntryIds.join(", ") || "无"}</p>
                <p>组件依赖: {entry.componentEntryIds.join(", ") || "无"}</p>
                <div className="catalog-entry-actions">
                  <button
                    disabled={!props.ready || props.busyAction !== null}
                    onClick={() =>
                      active
                        ? props.onUnloadBlueprint()
                        : props.onLoadBlueprint(entry.entryId)
                    }
                  >
                    {active ? "卸载蓝图" : "加载蓝图"}
                  </button>
                  <button
                    disabled={!props.ready || props.busyAction !== null}
                    onClick={() => props.onUnregisterEntry(entry.entryId)}
                  >
                    注销
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <div className="catalog-forms">
        <section className="catalog-form">
          <h3>纯组件 Artifact</h3>
          <input
            value={props.componentForm.entryId}
            onInput={(event) =>
              props.onComponentFormChange({
                ...props.componentForm,
                entryId: event.currentTarget.value
              })
            }
            placeholder="entryId"
          />
          <input
            value={props.componentForm.name}
            onInput={(event) =>
              props.onComponentFormChange({
                ...props.componentForm,
                name: event.currentTarget.value
              })
            }
            placeholder="名称"
          />
          <label className="catalog-upload">
            <span>Browser artifact</span>
            <input
              type="file"
              accept=".js,.mjs"
              onInput={(event) =>
                props.onComponentFormChange({
                  ...props.componentForm,
                  browserFile: event.currentTarget.files?.[0] ?? null
                })
              }
            />
          </label>
          <TypeSummary
            title="检测到的 widget types"
            values={props.componentForm.detectedWidgetTypes}
          />
          <FormError message={props.componentForm.analysisError} />
          <button
            disabled={!props.ready || props.busyAction !== null}
            onClick={props.onRegisterComponentEntry}
          >
            注册纯组件
          </button>
        </section>

        <section className="catalog-form">
          <h3>注册扩展 JS</h3>
          <input
            value={props.nodeForm.entryId}
            onInput={(event) =>
              props.onNodeFormChange({
                ...props.nodeForm,
                entryId: event.currentTarget.value
              })
            }
            placeholder="entryId"
          />
          <input
            value={props.nodeForm.name}
            onInput={(event) =>
              props.onNodeFormChange({
                ...props.nodeForm,
                name: event.currentTarget.value
              })
            }
            placeholder="名称"
          />
          <label className="catalog-upload">
            <span>扩展 JS（推荐）</span>
            <input
              type="file"
              accept=".js,.mjs"
              onInput={(event) => {
                const file = event.currentTarget.files?.[0] ?? null;
                props.onNodeFormChange({
                  ...props.nodeForm,
                  authorityFile: file,
                  browserFile: file
                });
              }}
            />
          </label>
          <label className="catalog-upload">
            <span>Authority artifact（可选）</span>
            <input
              type="file"
              accept=".js,.mjs"
              onInput={(event) =>
                props.onNodeFormChange({
                  ...props.nodeForm,
                  authorityFile: event.currentTarget.files?.[0] ?? null
                })
              }
            />
          </label>
          <label className="catalog-upload">
            <span>Browser artifact（可选）</span>
            <input
              type="file"
              accept=".js,.mjs"
              onInput={(event) =>
                props.onNodeFormChange({
                  ...props.nodeForm,
                  browserFile: event.currentTarget.files?.[0] ?? null
                })
              }
            />
          </label>
          <TypeSummary
            title="Authority 节点 types"
            values={props.nodeForm.detectedAuthorityNodeTypes}
          />
          <TypeSummary
            title="Browser 节点 types"
            values={props.nodeForm.detectedBrowserNodeTypes}
          />
          <p className="catalog-helper-text">
            统一入口会自动识别这份 JS 里有没有 node、widget，必要时自动补
            companion component-entry；只提供一份 JS 时也会同时作为 authority
            与 browser 产物。
          </p>
          <TypeSummary
            title="节点声明使用的 widget types"
            values={props.nodeForm.requiredWidgetTypes}
          />
          <TypeSummary
            title="Artifact 直接导出的 widget entries"
            values={props.nodeForm.exportedWidgetTypes}
          />
          <SelectionField
            title="依赖组件条目"
            helper="从当前 catalog 中选择提供这些 widget types 的组件条目。"
            emptyLabel="当前没有可选组件条目"
            options={props.componentEntries.map((entry) => ({
              id: entry.entryId,
              label: entry.name,
              detail: entry.widgetTypes.join(", ") || "无 widgetTypes"
            }))}
            selectedIds={props.nodeForm.selectedComponentEntryIds}
            onToggle={(entryId) =>
              props.onNodeFormChange({
                ...props.nodeForm,
                selectedComponentEntryIds: toggleSelectedId(
                  props.nodeForm.selectedComponentEntryIds,
                  entryId
                )
              })
            }
          />
          <MissingTypes
            title="未覆盖的 widget types"
            values={missingNodeComponentWidgetTypes}
          />
          <FormError message={props.nodeForm.analysisError} />
          <button
            disabled={!props.ready || props.busyAction !== null}
            onClick={props.onRegisterNodeEntry}
          >
            自动注册扩展
          </button>
        </section>

        <section className="catalog-form">
          <h3>注册蓝图</h3>
          <input
            value={props.blueprintForm.entryId}
            onInput={(event) =>
              props.onBlueprintFormChange({
                ...props.blueprintForm,
                entryId: event.currentTarget.value
              })
            }
            placeholder="entryId"
          />
          <input
            value={props.blueprintForm.name}
            onInput={(event) =>
              props.onBlueprintFormChange({
                ...props.blueprintForm,
                name: event.currentTarget.value
              })
            }
            placeholder="名称"
          />
          <label className="catalog-upload">
            <span>Blueprint JSON</span>
            <input
              type="file"
              accept=".json"
              onInput={(event) =>
                props.onBlueprintFormChange({
                  ...props.blueprintForm,
                  documentFile: event.currentTarget.files?.[0] ?? null
                })
              }
            />
          </label>
          <TypeSummary
            title="蓝图节点 types"
            values={props.blueprintForm.detectedNodeTypes}
          />
          <TypeSummary
            title="蓝图 widget types"
            values={props.blueprintForm.detectedWidgetTypes}
          />
          <SelectionField
            title="蓝图节点依赖"
            helper="选择能覆盖蓝图节点 types 的 node-entry。"
            emptyLabel="当前没有可选节点条目"
            options={props.nodeEntries.map((entry) => ({
              id: entry.entryId,
              label: entry.name,
              detail: entry.nodeTypes.join(", ") || "无 nodeTypes"
            }))}
            selectedIds={props.blueprintForm.selectedNodeEntryIds}
            onToggle={(entryId) =>
              props.onBlueprintFormChange({
                ...props.blueprintForm,
                selectedNodeEntryIds: toggleSelectedId(
                  props.blueprintForm.selectedNodeEntryIds,
                  entryId
                )
              })
            }
          />
          <SelectionField
            title="蓝图组件依赖"
            helper="选择能覆盖蓝图 widget types 的 component-entry。"
            emptyLabel="当前没有可选组件条目"
            options={props.componentEntries.map((entry) => ({
              id: entry.entryId,
              label: entry.name,
              detail: entry.widgetTypes.join(", ") || "无 widgetTypes"
            }))}
            selectedIds={props.blueprintForm.selectedComponentEntryIds}
            onToggle={(entryId) =>
              props.onBlueprintFormChange({
                ...props.blueprintForm,
                selectedComponentEntryIds: toggleSelectedId(
                  props.blueprintForm.selectedComponentEntryIds,
                  entryId
                )
              })
            }
          />
          <MissingTypes title="未覆盖的节点 types" values={missingBlueprintNodeTypes} />
          <MissingTypes
            title="未覆盖的 widget types"
            values={missingBlueprintWidgetTypes}
          />
          <FormError message={props.blueprintForm.analysisError} />
          <button
            disabled={!props.ready || props.busyAction !== null}
            onClick={props.onRegisterBlueprintEntry}
          >
            上传并注册蓝图
          </button>
        </section>
      </div>
    </section>
  );
}

function TypeSummary(props: { title: string; values: readonly string[] }) {
  return (
    <div className="catalog-analysis">
      <div className="catalog-analysis-title">{props.title}</div>
      {props.values.length > 0 ? (
        <div className="catalog-chip-list">
          {props.values.map((value) => (
            <span className="catalog-chip" key={`${props.title}-${value}`}>
              {value}
            </span>
          ))}
        </div>
      ) : (
        <p className="catalog-helper-text">等待分析 artifact / blueprint。</p>
      )}
    </div>
  );
}

function MissingTypes(props: { title: string; values: readonly string[] }) {
  if (props.values.length === 0) {
    return null;
  }

  return (
    <div className="catalog-analysis catalog-analysis-error">
      <div className="catalog-analysis-title">{props.title}</div>
      <div className="catalog-chip-list">
        {props.values.map((value) => (
          <span className="catalog-chip catalog-chip-warning" key={`${props.title}-${value}`}>
            {value}
          </span>
        ))}
      </div>
    </div>
  );
}

function FormError(props: { message: string | null }) {
  if (!props.message) {
    return null;
  }

  return <p className="catalog-form-error">{props.message}</p>;
}

function SelectionField(props: {
  title: string;
  helper: string;
  emptyLabel: string;
  options: Array<{ id: string; label: string; detail: string }>;
  selectedIds: readonly string[];
  onToggle(entryId: string): void;
}) {
  return (
    <div className="catalog-analysis">
      <div className="catalog-analysis-title">{props.title}</div>
      <p className="catalog-helper-text">{props.helper}</p>
      {props.options.length === 0 ? (
        <p className="catalog-helper-text">{props.emptyLabel}</p>
      ) : (
        <div className="catalog-checkbox-list">
          {props.options.map((option) => (
            <label className="catalog-checkbox-item" key={option.id}>
              <input
                type="checkbox"
                checked={props.selectedIds.includes(option.id)}
                onInput={() => props.onToggle(option.id)}
              />
              <span>
                <strong>{option.label}</strong>
                <small>{option.id}</small>
                <small>{option.detail}</small>
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function collectCoveredNodeTypes(
  entries: readonly RuntimeBridgeNodeCatalogEntry[],
  selectedEntryIds: readonly string[]
): Set<string> {
  const selectedIds = new Set(selectedEntryIds);
  const types = new Set<string>();

  for (const entry of entries) {
    if (!selectedIds.has(entry.entryId)) {
      continue;
    }

    for (const nodeType of entry.nodeTypes) {
      types.add(nodeType);
    }
  }

  return types;
}

function collectCoveredWidgetTypes(
  entries: readonly RuntimeBridgeComponentCatalogEntry[],
  selectedEntryIds: readonly string[]
): Set<string> {
  const selectedIds = new Set(selectedEntryIds);
  const types = new Set<string>();

  for (const entry of entries) {
    if (!selectedIds.has(entry.entryId)) {
      continue;
    }

    for (const widgetType of entry.widgetTypes) {
      types.add(widgetType);
    }
  }

  return types;
}

function toggleSelectedId(current: readonly string[], entryId: string): string[] {
  return current.includes(entryId)
    ? current.filter((value) => value !== entryId)
    : [...current, entryId];
}
