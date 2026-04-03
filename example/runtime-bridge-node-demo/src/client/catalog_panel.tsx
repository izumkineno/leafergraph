import type {
  RuntimeBridgeBlueprintCatalogEntry,
  RuntimeBridgeComponentCatalogEntry,
  RuntimeBridgeExtensionsSync,
  RuntimeBridgeNodeCatalogEntry
} from "@leafergraph/runtime-bridge";

export type DemoComponentEntryForm = {
  entryId: string;
  name: string;
  widgetTypes: string;
  browserFile: File | null;
};

export type DemoNodeEntryForm = {
  entryId: string;
  name: string;
  nodeTypes: string;
  componentEntryIds: string;
  authorityFile: File | null;
  browserFile: File | null;
};

export type DemoBlueprintEntryForm = {
  entryId: string;
  name: string;
  nodeEntryIds: string;
  componentEntryIds: string;
  documentFile: File | null;
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
          <h3>注册组件</h3>
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
          <input
            value={props.componentForm.widgetTypes}
            onInput={(event) =>
              props.onComponentFormChange({
                ...props.componentForm,
                widgetTypes: event.currentTarget.value
              })
            }
            placeholder="widgetTypes，逗号分隔"
          />
          <input
            type="file"
            accept=".js,.mjs,.ts"
            onInput={(event) =>
              props.onComponentFormChange({
                ...props.componentForm,
                browserFile: event.currentTarget.files?.[0] ?? null
              })
            }
          />
          <button
            disabled={!props.ready || props.busyAction !== null}
            onClick={props.onRegisterComponentEntry}
          >
            上传并注册组件
          </button>
        </section>

        <section className="catalog-form">
          <h3>注册节点</h3>
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
          <input
            value={props.nodeForm.nodeTypes}
            onInput={(event) =>
              props.onNodeFormChange({
                ...props.nodeForm,
                nodeTypes: event.currentTarget.value
              })
            }
            placeholder="nodeTypes，逗号分隔"
          />
          <input
            value={props.nodeForm.componentEntryIds}
            onInput={(event) =>
              props.onNodeFormChange({
                ...props.nodeForm,
                componentEntryIds: event.currentTarget.value
              })
            }
            placeholder="依赖 componentEntryIds，逗号分隔"
          />
          <label className="catalog-upload">
            <span>Authority artifact</span>
            <input
              type="file"
              accept=".js,.mjs,.ts"
              onInput={(event) =>
                props.onNodeFormChange({
                  ...props.nodeForm,
                  authorityFile: event.currentTarget.files?.[0] ?? null
                })
              }
            />
          </label>
          <label className="catalog-upload">
            <span>Browser artifact</span>
            <input
              type="file"
              accept=".js,.mjs,.ts"
              onInput={(event) =>
                props.onNodeFormChange({
                  ...props.nodeForm,
                  browserFile: event.currentTarget.files?.[0] ?? null
                })
              }
            />
          </label>
          <button
            disabled={!props.ready || props.busyAction !== null}
            onClick={props.onRegisterNodeEntry}
          >
            上传并注册节点
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
          <input
            value={props.blueprintForm.nodeEntryIds}
            onInput={(event) =>
              props.onBlueprintFormChange({
                ...props.blueprintForm,
                nodeEntryIds: event.currentTarget.value
              })
            }
            placeholder="依赖 nodeEntryIds，逗号分隔"
          />
          <input
            value={props.blueprintForm.componentEntryIds}
            onInput={(event) =>
              props.onBlueprintFormChange({
                ...props.blueprintForm,
                componentEntryIds: event.currentTarget.value
              })
            }
            placeholder="依赖 componentEntryIds，逗号分隔"
          />
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
