import type { NodeDefinition } from "@leafergraph/node";
import type { JSX } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";

import type { GraphViewportWorkspaceState } from "./GraphViewport";
import {
  createNodeLibraryPreviewRequest,
  type NodeLibraryPreviewRequest
} from "./node_library_hover_preview";
import type { WorkspacePanePresentation } from "./workspace_adaptive";

interface NodeLibraryGroup {
  key: string;
  label: string;
  groups: NodeLibraryGroup[];
  definitions: NodeDefinition[];
  totalCount: number;
}

export interface NodeLibraryPaneProps {
  definitions: readonly NodeDefinition[];
  searchQuery: string;
  activeNodeType: string | null;
  presentation: WorkspacePanePresentation;
  hoverPreviewEnabled?: boolean;
  quickCreateNodeType?: string;
  disabled?: boolean;
  focusSearchOnOpen?: boolean;
  onSearchQueryChange(value: string): void;
  onActiveNodeTypeChange(nodeType: string): void;
  onCreateNode(nodeType: string): void;
  onPreviewRequestChange?(request: NodeLibraryPreviewRequest | null): void;
  cleanEntryHint?: {
    onOpenExtensions(): void;
    onOpenNodeAuthorityDemo(): void;
    onOpenPythonAuthorityDemo(): void;
  };
}

export interface InspectorPaneProps {
  presentation: WorkspacePanePresentation;
  workspaceState: GraphViewportWorkspaceState | null;
  authoritySummary: {
    modeLabel: string;
    connectionLabel: string;
    sourceLabel: string;
    pendingCount: number;
    recoveryLabel: string;
    documentLabel: string;
  };
  onOpenRunConsole(): void;
}

function normalizeCategoryPath(category: string | undefined): string[] {
  const safeCategory = category?.trim() || "Other";
  const parts = safeCategory
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.length ? parts : ["Other"];
}

function matchesNodeSearch(definition: NodeDefinition, query: string): boolean {
  const safeQuery = query.trim().toLowerCase();
  if (!safeQuery) {
    return true;
  }

  const haystack = [
    definition.title,
    definition.type,
    definition.category,
    definition.description,
    ...(definition.keywords ?? [])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(safeQuery);
}

function createGroup(label: string, key: string): NodeLibraryGroup {
  return {
    key,
    label,
    groups: [],
    definitions: [],
    totalCount: 0
  };
}

function buildNodeLibraryGroups(
  definitions: readonly NodeDefinition[]
): NodeLibraryGroup[] {
  const groupMap = new Map<string, NodeLibraryGroup>();

  for (const definition of definitions) {
    let currentPath = "";
    let parentGroup: NodeLibraryGroup | null = null;

    for (const segment of normalizeCategoryPath(definition.category)) {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      let group = groupMap.get(currentPath);
      if (!group) {
        group = createGroup(segment, currentPath);
        groupMap.set(currentPath, group);
        if (parentGroup) {
          parentGroup.groups.push(group);
        }
      }

      group.totalCount += 1;
      parentGroup = group;
    }

    parentGroup?.definitions.push(definition);
  }

  const topLevelGroups = [...groupMap.values()].filter((group) => !group.key.includes("/"));

  const sortGroup = (group: NodeLibraryGroup): NodeLibraryGroup => {
    group.groups = group.groups
      .sort((left, right) => left.label.localeCompare(right.label))
      .map(sortGroup);
    group.definitions = [...group.definitions].sort((left, right) =>
      (left.title ?? left.type).localeCompare(right.title ?? right.type)
    );
    return group;
  };

  return topLevelGroups.sort((left, right) => left.label.localeCompare(right.label)).map(
    sortGroup
  );
}

function formatTimestamp(timestamp: number | null | undefined): string {
  if (!timestamp) {
    return "无";
  }

  return new Date(timestamp).toLocaleTimeString();
}

function formatDuration(startedAt: number, finishedAt: number): string {
  return `${Math.max(0, finishedAt - startedAt)} ms`;
}

function formatJson(value: unknown): string {
  if (value === undefined) {
    return "undefined";
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function renderNodeLibraryGroup(
  group: NodeLibraryGroup,
  props: NodeLibraryPaneProps
): JSX.Element {
  return (
    <details class="node-library__group" open key={group.key}>
      <summary class="node-library__group-summary">
        <span>{group.label}</span>
        <span class="node-library__group-count">{group.totalCount}</span>
      </summary>
      <div class="node-library__group-body">
        {group.groups.map((child) => renderNodeLibraryGroup(child, props))}
        {group.definitions.map((definition) => {
          const isActive = props.activeNodeType === definition.type;
          const isQuickCreate = props.quickCreateNodeType === definition.type;

          return (
            <button
              key={definition.type}
              type="button"
              class="node-library__item"
              data-active={isActive ? "true" : "false"}
              disabled={props.disabled}
              onFocus={(event) => {
                props.onActiveNodeTypeChange(definition.type);
                if (!props.hoverPreviewEnabled) {
                  return;
                }

                props.onPreviewRequestChange?.(
                  createNodeLibraryPreviewRequest(
                    definition,
                    event.currentTarget as HTMLButtonElement,
                    "focus"
                  )
                );
              }}
              onBlur={() => {
                props.onPreviewRequestChange?.(null);
              }}
              onMouseEnter={(event) => {
                props.onActiveNodeTypeChange(definition.type);
                if (!props.hoverPreviewEnabled) {
                  return;
                }

                props.onPreviewRequestChange?.(
                  createNodeLibraryPreviewRequest(
                    definition,
                    event.currentTarget as HTMLButtonElement,
                    "hover"
                  )
                );
              }}
              onMouseLeave={() => {
                props.onPreviewRequestChange?.(null);
              }}
              onClick={() => {
                props.onActiveNodeTypeChange(definition.type);
                props.onCreateNode(definition.type);
              }}
            >
              <span class="node-library__item-title">
                {definition.title ?? definition.type}
              </span>
              <span class="node-library__item-meta">{definition.type}</span>
              {definition.description ? (
                <span class="node-library__item-description">
                  {definition.description}
                </span>
              ) : null}
              <span class="node-library__item-tags">
                <span class="node-library__tag">{definition.category ?? "Other"}</span>
                {isQuickCreate ? (
                  <span class="node-library__tag node-library__tag--accent">
                    Quick Create
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </details>
  );
}

export function NodeLibraryPane(props: NodeLibraryPaneProps) {
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const filteredDefinitions = useMemo(
    () => props.definitions.filter((definition) => matchesNodeSearch(definition, props.searchQuery)),
    [props.definitions, props.searchQuery]
  );
  const groups = useMemo(
    () => buildNodeLibraryGroups(filteredDefinitions),
    [filteredDefinitions]
  );
  const activeDefinition =
    filteredDefinitions.find((definition) => definition.type === props.activeNodeType) ??
    filteredDefinitions[0] ??
    null;
  const createHint =
    props.presentation === "fullscreen"
      ? props.disabled
        ? "等待画布后即可创建"
        : "点击创建后自动回到画布"
      : props.disabled
        ? "画布尚未就绪"
        : "点击任意项即可创建";

  useEffect(() => {
    if (!props.focusSearchOnOpen) {
      return;
    }

    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, [props.focusSearchOnOpen]);

  useEffect(() => {
    if (props.hoverPreviewEnabled && !props.disabled) {
      return;
    }

    props.onPreviewRequestChange?.(null);
  }, [props.disabled, props.hoverPreviewEnabled, props.onPreviewRequestChange]);

  useEffect(() => {
    props.onPreviewRequestChange?.(null);
  }, [props.searchQuery, props.onPreviewRequestChange]);

  useEffect(() => {
    return () => {
      props.onPreviewRequestChange?.(null);
    };
  }, [props.onPreviewRequestChange]);

  return (
    <section
      class="workspace-pane workspace-pane--library"
      aria-label="节点库"
      data-presentation={props.presentation}
      onKeyDown={(event) => {
        if (event.key !== "Enter" || !activeDefinition || props.disabled) {
          return;
        }

        event.preventDefault();
        props.onCreateNode(activeDefinition.type);
      }}
    >
      <header class="workspace-pane__header">
        <div>
          <p class="workspace-pane__eyebrow">Nodes</p>
          <h2>节点库</h2>
        </div>
        <span class="workspace-pane__count">{props.definitions.length}</span>
      </header>
      <label class="workspace-search">
        <span class="workspace-search__label">搜索节点</span>
        <input
          ref={searchInputRef}
          type="search"
          value={props.searchQuery}
          placeholder="搜索 title / type / category / description"
          onInput={(event) => {
            props.onSearchQueryChange(
              (event.currentTarget as HTMLInputElement).value
            );
          }}
        />
      </label>
      <div
        class="node-library__scroll"
        onScroll={() => {
          props.onPreviewRequestChange?.(null);
        }}
      >
        {props.cleanEntryHint ? (
          <div class="workspace-note workspace-note--panel">
            <div class="workspace-note__body">
              <strong class="workspace-note__title">
                当前只显示内建基础节点
              </strong>
              <p>
                这个入口默认不会预加载 node/widget bundle。你可以去 Extensions
                手动加载，或直接进入预载好的 Node / Python Authority Demo。
              </p>
            </div>
            <div class="workspace-note__actions">
              <button
                type="button"
                class="workspace-secondary-button"
                onClick={props.cleanEntryHint.onOpenExtensions}
              >
                打开 Extensions
              </button>
              <button
                type="button"
                class="workspace-primary-button workspace-primary-button--ghost"
                onClick={props.cleanEntryHint.onOpenNodeAuthorityDemo}
              >
                打开 Node Demo
              </button>
              <button
                type="button"
                class="workspace-primary-button workspace-primary-button--ghost"
                onClick={props.cleanEntryHint.onOpenPythonAuthorityDemo}
              >
                打开 Python Demo
              </button>
            </div>
          </div>
        ) : null}
        {groups.length ? (
          groups.map((group) => renderNodeLibraryGroup(group, props))
        ) : (
          <div class="workspace-empty-state">
            <h3>没有匹配节点</h3>
            <p>请调整关键字，或先在 Extensions 里装载 node/widget bundle。</p>
          </div>
        )}
      </div>
      <footer class="workspace-pane__footer">
        <span>当前可创建 {filteredDefinitions.length} / {props.definitions.length} 个节点</span>
        <span>{createHint}</span>
      </footer>
    </section>
  );
}

function InspectorKeyValue({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div class="inspector-kv__item">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function InspectorJsonSection({
  title,
  value,
  emptyLabel
}: {
  title: string;
  value: unknown;
  emptyLabel: string;
}) {
  const hasValue =
    value !== undefined &&
    value !== null &&
    (!(typeof value === "object") || Object.keys(value as object).length > 0);

  return (
    <section class="inspector-section">
      <div class="inspector-section__header">
        <h4>{title}</h4>
      </div>
      {hasValue ? (
        <pre class="inspector-code">{formatJson(value)}</pre>
      ) : (
        <p class="inspector-empty-label">{emptyLabel}</p>
      )}
    </section>
  );
}

export function InspectorPane({
  presentation,
  workspaceState,
  authoritySummary,
  onOpenRunConsole
}: InspectorPaneProps) {
  const [activeTab, setActiveTab] = useState<"properties" | "runtime">(
    "properties"
  );
  const node = workspaceState?.inspector.node ?? null;
  const latestChain = workspaceState?.runtime.latestChain ?? null;

  return (
    <section
      class="workspace-pane workspace-pane--inspector"
      aria-label="检查器"
      data-presentation={presentation}
    >
      <header class="workspace-pane__header">
        <div>
          <p class="workspace-pane__eyebrow">Inspector</p>
          <h2>检查器</h2>
        </div>
        <div class="workspace-tabs" role="tablist" aria-label="检查器标签">
          <button
            type="button"
            class="workspace-tab"
            data-active={activeTab === "properties" ? "true" : "false"}
            onClick={() => {
              setActiveTab("properties");
            }}
          >
            Properties
          </button>
          <button
            type="button"
            class="workspace-tab"
            data-active={activeTab === "runtime" ? "true" : "false"}
            onClick={() => {
              setActiveTab("runtime");
            }}
          >
            Runtime
          </button>
        </div>
      </header>

      <div class="inspector-pane__scroll">
        {!workspaceState ? (
          <div class="workspace-empty-state">
            <h3>等待画布挂载</h3>
            <p>GraphViewport 就绪后，属性检查器会展示当前文档和选区状态。</p>
          </div>
        ) : activeTab === "properties" ? (
          <>
            {workspaceState.inspector.mode === "document" ? (
              <>
                <section class="inspector-section">
                  <div class="inspector-section__header">
                    <h4>当前文档</h4>
                  </div>
                  <dl class="inspector-kv">
                    <InspectorKeyValue
                      label="Document"
                      value={workspaceState.document.documentId}
                    />
                    <InspectorKeyValue
                      label="Revision"
                      value={String(workspaceState.document.revision)}
                    />
                    <InspectorKeyValue
                      label="App Kind"
                      value={workspaceState.document.appKind}
                    />
                    <InspectorKeyValue
                      label="Nodes"
                      value={String(workspaceState.document.nodeCount)}
                    />
                    <InspectorKeyValue
                      label="Links"
                      value={String(workspaceState.document.linkCount)}
                    />
                  </dl>
                </section>

                <section class="inspector-section">
                  <div class="inspector-section__header">
                    <h4>Authority 摘要</h4>
                  </div>
                  <dl class="inspector-kv">
                    <InspectorKeyValue label="模式" value={authoritySummary.modeLabel} />
                    <InspectorKeyValue
                      label="连接"
                      value={authoritySummary.connectionLabel}
                    />
                    <InspectorKeyValue label="来源" value={authoritySummary.sourceLabel} />
                    <InspectorKeyValue
                      label="文档"
                      value={authoritySummary.documentLabel}
                    />
                    <InspectorKeyValue
                      label="Pending"
                      value={String(authoritySummary.pendingCount)}
                    />
                    <InspectorKeyValue
                      label="恢复策略"
                      value={authoritySummary.recoveryLabel}
                    />
                  </dl>
                </section>
              </>
            ) : workspaceState.inspector.mode === "multi" ? (
              <>
                <section class="inspector-section">
                  <div class="inspector-section__header">
                    <h4>多选摘要</h4>
                  </div>
                  <dl class="inspector-kv">
                    <InspectorKeyValue
                      label="已选节点"
                      value={String(workspaceState.selection.count)}
                    />
                    <InspectorKeyValue
                      label="主选中"
                      value={workspaceState.selection.primaryNodeId ?? "无"}
                    />
                  </dl>
                  <div class="inspector-chip-list">
                    {workspaceState.selection.nodeIds.map((nodeId) => (
                      <span class="inspector-chip" key={nodeId}>
                        {nodeId}
                      </span>
                    ))}
                  </div>
                </section>
                <section class="inspector-section">
                  <div class="inspector-section__header">
                    <h4>批量动作说明</h4>
                  </div>
                  <p class="inspector-empty-label">
                    当前可继续通过工具栏执行复制、剪切、删除、撤销和重做；本轮不额外引入新的通用批量表单。
                  </p>
                </section>
              </>
            ) : node ? (
              <>
                <section class="inspector-section inspector-section--hero">
                  <div class="inspector-section__header">
                    <h4>{node.title}</h4>
                    <span class="inspector-pill">{node.type}</span>
                  </div>
                  <p class="inspector-summary">
                    当前聚焦于单选节点，右侧优先展示 layout、flags、properties 和内部 data。
                  </p>
                </section>

                <section class="inspector-section">
                  <div class="inspector-section__header">
                    <h4>Layout</h4>
                  </div>
                  <dl class="inspector-kv">
                    <InspectorKeyValue label="X" value={String(node.layout.x)} />
                    <InspectorKeyValue label="Y" value={String(node.layout.y)} />
                    <InspectorKeyValue
                      label="Width"
                      value={String(node.layout.width ?? "auto")}
                    />
                    <InspectorKeyValue
                      label="Height"
                      value={String(node.layout.height ?? "auto")}
                    />
                  </dl>
                </section>

                <InspectorJsonSection
                  title="Flags"
                  value={node.flags}
                  emptyLabel="当前节点没有 flags。"
                />
                <InspectorJsonSection
                  title="Properties"
                  value={node.properties}
                  emptyLabel="当前节点没有 properties。"
                />
                <InspectorJsonSection
                  title="Data"
                  value={node.data}
                  emptyLabel="当前节点没有内部 data。"
                />
              </>
            ) : (
              <div class="workspace-empty-state">
                <h3>没有可展示的节点上下文</h3>
                <p>当前属性区回退为文档摘要，请重新选择一个节点。</p>
              </div>
            )}
          </>
        ) : (
          <>
            <section class="inspector-section">
              <div class="inspector-section__header">
                <h4>图级运行状态</h4>
                <span class="inspector-pill" data-status={workspaceState.runtime.graphExecutionState.status}>
                  {workspaceState.status.runtimeLabel}
                </span>
              </div>
              <dl class="inspector-kv">
                <InspectorKeyValue
                  label="Run ID"
                  value={workspaceState.runtime.graphExecutionState.runId ?? "无"}
                />
                <InspectorKeyValue
                  label="Queue"
                  value={String(workspaceState.runtime.graphExecutionState.queueSize)}
                />
                <InspectorKeyValue
                  label="Steps"
                  value={String(workspaceState.runtime.graphExecutionState.stepCount)}
                />
                <InspectorKeyValue
                  label="焦点节点"
                  value={workspaceState.runtime.focus.focusNodeTitle ?? "未命中"}
                />
              </dl>
              {workspaceState.status.runtimeDetailLabel ? (
                <p class="workspace-note">
                  {workspaceState.status.runtimeDetailLabel}
                </p>
              ) : null}
            </section>

            <section class="inspector-section">
              <div class="inspector-section__header">
                <h4>焦点节点运行态</h4>
              </div>
              <dl class="inspector-kv">
                <InspectorKeyValue
                  label="来源"
                  value={workspaceState.runtime.focus.focusMode}
                />
                <InspectorKeyValue
                  label="最近成功"
                  value={formatTimestamp(
                    workspaceState.runtime.focus.executionState?.lastSucceededAt
                  )}
                />
                <InspectorKeyValue
                  label="最近失败"
                  value={formatTimestamp(
                    workspaceState.runtime.focus.executionState?.lastFailedAt
                  )}
                />
                <InspectorKeyValue
                  label="执行次数"
                  value={String(
                    workspaceState.runtime.focus.executionState?.runCount ?? 0
                  )}
                />
              </dl>
              {workspaceState.runtime.latestErrorMessage ? (
                <p class="inspector-error">
                  {workspaceState.runtime.latestErrorMessage}
                </p>
              ) : null}
            </section>

            <section class="inspector-section">
              <div class="inspector-section__header">
                <h4>最近检查链</h4>
              </div>
              {latestChain ? (
                <dl class="inspector-kv">
                  <InspectorKeyValue label="根节点" value={latestChain.rootNodeTitle} />
                  <InspectorKeyValue
                    label="持续时间"
                    value={formatDuration(latestChain.startedAt, latestChain.finishedAt)}
                  />
                  <InspectorKeyValue
                    label="命中步数"
                    value={String(latestChain.stepCount)}
                  />
                  <InspectorKeyValue
                    label="失败节点"
                    value={String(latestChain.errorCount)}
                  />
                </dl>
              ) : (
                <p class="inspector-empty-label">当前还没有执行链记录。</p>
              )}
            </section>

            <button
              type="button"
              class="workspace-primary-button"
              onClick={() => {
                onOpenRunConsole();
              }}
            >
              打开运行控制台
            </button>
          </>
        )}
      </div>
    </section>
  );
}
