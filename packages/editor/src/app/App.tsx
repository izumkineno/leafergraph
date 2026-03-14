import { useEffect, useMemo, useRef, useState } from "preact/hooks";

import { GraphViewport } from "./GraphViewport";
import {
  EDITOR_THEME_STORAGE_KEY,
  resolveInitialEditorTheme,
  type EditorTheme
} from "../theme";
import {
  createInitialBundleSlotState,
  EDITOR_BUNDLE_SLOTS,
  ensureEditorBundleRuntimeGlobals,
  loadLocalEditorBundle,
  resolveEditorBundleRuntimeSetup,
  toErrorMessage
} from "../loader/runtime";
import type {
  EditorBundleResolvedStatus,
  EditorBundleSlot,
  EditorBundleSlotState
} from "../loader/types";

/** 切换到相反主题。 */
function toggleEditorTheme(theme: EditorTheme): EditorTheme {
  return theme === "dark" ? "light" : "dark";
}

/** 固定的 bundle 槽位标题。 */
const BUNDLE_SLOT_TITLE: Readonly<Record<EditorBundleSlot, string>> = {
  demo: "Demo Bundle",
  node: "Node Bundle",
  widget: "Widget Bundle"
} as const;

/** 固定的 bundle 槽位说明。 */
const BUNDLE_SLOT_DESCRIPTION: Readonly<Record<EditorBundleSlot, string>> = {
  demo: "只负责提供默认图数据，推荐在 node 和 widget 就绪后再启用。",
  node: "安装可独立运行的节点模块，并提供默认快速创建节点类型。",
  widget: "注册外部 widget，并可附带一个消费该 widget 的伴生节点。"
} as const;

/** editor 面板使用的状态文案。 */
const BUNDLE_STATUS_LABEL: Readonly<
  Record<EditorBundleResolvedStatus, string>
> = {
  idle: "未加载",
  ready: "已加载",
  "dependency-missing": "依赖缺失",
  failed: "加载失败",
  loading: "加载中"
} as const;

/** editor 当前阶段的工作分页定义。 */
const WORKSPACE_PAGES = [
  {
    id: "bundle-loader",
    title: "Bundle 接入",
    description: "从本地 dist IIFE 文件加载 demo、node、widget"
  },
  {
    id: "main-canvas",
    title: "主画布",
    description: "当前本地 bundle 的默认渲染页"
  }
] as const;

type EditorWorkspacePageId = (typeof WORKSPACE_PAGES)[number]["id"];

/** 创建 editor 的初始 bundle 槽位映射。 */
function createInitialBundleSlots(): Record<EditorBundleSlot, EditorBundleSlotState> {
  return {
    demo: createInitialBundleSlotState("demo"),
    node: createInitialBundleSlotState("node"),
    widget: createInitialBundleSlotState("widget")
  };
}

/** 读取某个槽位当前的激活提示。 */
function resolveBundleActivationLabel(slot: {
  manifest: unknown;
  enabled: boolean;
  active: boolean;
  missingRequirements: EditorBundleSlot[];
}): string {
  if (!slot.manifest) {
    return "当前未加载";
  }

  if (!slot.enabled) {
    return "当前已停用";
  }

  if (!slot.active && slot.missingRequirements.length > 0) {
    return `等待依赖：${slot.missingRequirements.join(" + ")}`;
  }

  return "当前已启用";
}

export function App() {
  const [theme, setTheme] = useState<EditorTheme>(() =>
    resolveInitialEditorTheme()
  );
  const [activeWorkspacePageId, setActiveWorkspacePageId] =
    useState<EditorWorkspacePageId>("bundle-loader");
  const [hasStartedRendering, setHasStartedRendering] = useState(false);
  const viewportSectionRef = useRef<HTMLElement | null>(null);
  const [bundleSlots, setBundleSlots] = useState<
    Record<EditorBundleSlot, EditorBundleSlotState>
  >(() => createInitialBundleSlots());

  useEffect(() => {
    ensureEditorBundleRuntimeGlobals();
  }, []);

  useEffect(() => {
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem(EDITOR_THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (!hasStartedRendering) {
      return;
    }

    const ownerWindow =
      viewportSectionRef.current?.ownerDocument.defaultView ?? window;

    ownerWindow.requestAnimationFrame(() => {
      viewportSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  }, [hasStartedRendering]);

  const runtimeSetup = useMemo(
    () => resolveEditorBundleRuntimeSetup(bundleSlots),
    [bundleSlots]
  );
  const activeWorkspacePage = WORKSPACE_PAGES.find(
    (page) => page.id === activeWorkspacePageId
  )!;

  /** 统一进入主画布渲染态，避免多个入口各自维护同一组状态。 */
  const startRendering = (): void => {
    setActiveWorkspacePageId("main-canvas");
    setHasStartedRendering(true);
  };

  /** 卸载当前画布宿主，让 GraphViewport 走完整销毁链路。 */
  const stopRendering = (): void => {
    setHasStartedRendering(false);
  };

  const handleBundleFileChange = async (
    slot: EditorBundleSlot,
    event: Event
  ): Promise<void> => {
    const input = event.currentTarget as HTMLInputElement | null;
    const file = input?.files?.[0];

    if (input) {
      input.value = "";
    }

    if (!file) {
      return;
    }

    setBundleSlots((current) => ({
      ...current,
      [slot]: {
        ...current[slot],
        loading: true,
        error: null
      }
    }));

    try {
      const manifest = await loadLocalEditorBundle(slot, file);

      setBundleSlots((current) => ({
        ...current,
        [slot]: {
          slot,
          manifest,
          fileName: file.name,
          enabled: true,
          loading: false,
          error: null
        }
      }));
    } catch (error) {
      const errorMessage = toErrorMessage(error);

      setBundleSlots((current) => ({
        ...current,
        [slot]: {
          ...current[slot],
          loading: false,
          error: errorMessage
        }
      }));
    }
  };

  const toggleBundleEnabled = (slot: EditorBundleSlot): void => {
    setBundleSlots((current) => ({
      ...current,
      [slot]: {
        ...current[slot],
        enabled: !current[slot].enabled
      }
    }));
  };

  const unloadBundle = (slot: EditorBundleSlot): void => {
    setBundleSlots((current) => ({
      ...current,
      [slot]: createInitialBundleSlotState(slot)
    }));
  };

  return (
    <div class="shell" data-theme={theme}>
      <aside class="sidebar">
        <p class="eyebrow">LeaferGraph</p>
        <h1>Editor Sandbox</h1>
        <p class="lead">
          编辑器控制层现在由 <code>Preact</code> 承担，LeaferGraph 继续作为底层
          画布与图形宿主。
        </p>

        <section class="panel">
          <h2>当前结构</h2>
          <ul>
            <li>核心库：LeaferGraph API 与渲染宿主</li>
            <li>编辑器：Preact 组件树管理布局和状态</li>
            <li>本地接入：通过 IIFE bundle 装载 demo、node、widget</li>
          </ul>
        </section>

        <section class="panel">
          <h2>当前建议顺序</h2>
          <ul>
            <li>先加载 Widget Bundle，确保外部 widget 已注册</li>
            <li>再加载 Node Bundle，挂上可独立使用的节点模块</li>
            <li>最后加载 Demo Bundle，让默认图数据一次性落图</li>
          </ul>
        </section>
      </aside>

      <main class="workspace">
        <header class="toolbar">
          <div>
            <p class="toolbar__label">Workspace</p>
            <h2>Leafer-first Node Graph</h2>
          </div>
          <div class="toolbar__actions">
            <span class="badge">
              {theme === "dark" ? "暗色工作区" : "亮色工作区"}
            </span>
            <button
              type="button"
              class="theme-toggle"
              data-theme={theme}
              aria-label={`切换到${theme === "dark" ? "亮色" : "暗色"}模式`}
              title={`切换到${theme === "dark" ? "亮色" : "暗色"}模式`}
              onClick={() => {
                setTheme((currentTheme) => toggleEditorTheme(currentTheme));
              }}
            >
              <span class="theme-toggle__thumb" aria-hidden="true" />
              <span class="theme-toggle__option theme-toggle__option--light">
                亮色
              </span>
              <span class="theme-toggle__option theme-toggle__option--dark">
                暗色
              </span>
            </button>
          </div>
        </header>

        <section class="canvas-pages" aria-label="工作分页">
          <div class="canvas-pages__header">
            <div>
              <p class="toolbar__label">Workspace Pages</p>
              <h3>工作分页</h3>
            </div>
            <div class="canvas-pages__actions">
              <p class="canvas-pages__summary">
                当前页：
                <strong>{activeWorkspacePage.title}</strong>
                ，
                {hasStartedRendering ? "已挂载渲染宿主" : "尚未开始渲染"}
              </p>
              {hasStartedRendering ? (
                <button
                  type="button"
                  class="render-toggle render-toggle--stop"
                  onClick={stopRendering}
                >
                  停止渲染
                </button>
              ) : (
                <button
                  type="button"
                  class="render-toggle"
                  onClick={startRendering}
                >
                  开始渲染
                </button>
              )}
            </div>
          </div>

          <div class="canvas-pages__tabs" role="tablist" aria-label="工作分页标签">
            {WORKSPACE_PAGES.map((page) => {
              const active = page.id === activeWorkspacePageId;

              return (
                <button
                  key={page.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  class="canvas-pages__tab"
                  data-active={active ? "true" : "false"}
                  onClick={() => {
                    setActiveWorkspacePageId(page.id);
                  }}
                >
                  <span class="canvas-pages__tab-title">{page.title}</span>
                  <span class="canvas-pages__tab-description">
                    {page.description}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {activeWorkspacePage.id === "bundle-loader" ? (
          <section
            ref={viewportSectionRef}
            class="workspace-page-shell"
            aria-live="polite"
          >
            <div class="canvas-page">
              <div class="canvas-page__header">
                <div>
                  <p class="toolbar__label">Bundle Center</p>
                  <h3>{activeWorkspacePage.title}</h3>
                </div>
                <p class="canvas-page__description">
                  {activeWorkspacePage.description}
                </p>
              </div>

              <div class="canvas-page__body canvas-page__body--scroll">
                <section
                  class="bundle-panel bundle-panel--embedded"
                  aria-label="本地 bundle 加载面板"
                >
                  <div class="bundle-panel__header">
                    <div>
                      <p class="toolbar__label">Local Bundles</p>
                      <h3>从本地 dist IIFE 文件加载</h3>
                    </div>
                    <p class="bundle-panel__summary">
                      当前激活：
                      <strong>{runtimeSetup.plugins.length}</strong>
                      个插件，
                      <strong>{runtimeSetup.quickCreateNodeType ?? "无"}</strong>
                      作为优先创建节点
                    </p>
                  </div>

                  <div class="bundle-grid">
                    {EDITOR_BUNDLE_SLOTS.map((slot) => {
                      const state = runtimeSetup.slots[slot];
                      const manifest = state.manifest;
                      const quickCreateNodeType =
                        manifest?.kind === "node" || manifest?.kind === "widget"
                          ? manifest.quickCreateNodeType
                          : undefined;

                      return (
                        <article class="bundle-card" key={slot}>
                          <div class="bundle-card__header">
                            <div>
                              <h4>{BUNDLE_SLOT_TITLE[slot]}</h4>
                              <p>{BUNDLE_SLOT_DESCRIPTION[slot]}</p>
                            </div>
                            <span
                              class="bundle-card__status"
                              data-status={state.status}
                            >
                              {BUNDLE_STATUS_LABEL[state.status]}
                            </span>
                          </div>

                          <div class="bundle-card__meta">
                            <span>{resolveBundleActivationLabel(state)}</span>
                            <span>
                              {manifest?.version
                                ? `v${manifest.version}`
                                : "未声明版本"}
                            </span>
                          </div>

                          <dl class="bundle-card__info">
                            <div>
                              <dt>文件</dt>
                              <dd>{state.fileName ?? "未选择"}</dd>
                            </div>
                            <div>
                              <dt>名称</dt>
                              <dd>{manifest?.name ?? "未加载"}</dd>
                            </div>
                            <div>
                              <dt>ID</dt>
                              <dd>{manifest?.id ?? "未加载"}</dd>
                            </div>
                            <div>
                              <dt>依赖</dt>
                              <dd>
                                {manifest?.requires?.length
                                  ? manifest.requires.join(" + ")
                                  : "无"}
                              </dd>
                            </div>
                            {quickCreateNodeType !== undefined ? (
                              <div>
                                <dt>快速创建</dt>
                                <dd>{quickCreateNodeType}</dd>
                              </div>
                            ) : null}
                          </dl>

                          {state.error ? (
                            <p class="bundle-card__error">{state.error}</p>
                          ) : null}

                          <div class="bundle-card__actions">
                            <label class="bundle-card__button bundle-card__button--primary">
                              选择文件
                              <input
                                type="file"
                                class="bundle-card__file-input"
                                accept=".js,text/javascript,application/javascript"
                                onChange={(event) => {
                                  void handleBundleFileChange(slot, event);
                                }}
                              />
                            </label>
                            <button
                              type="button"
                              class="bundle-card__button"
                              disabled={!manifest || state.loading}
                              onClick={() => {
                                toggleBundleEnabled(slot);
                              }}
                            >
                              {state.enabled ? "停用" : "启用"}
                            </button>
                            <button
                              type="button"
                              class="bundle-card__button"
                              disabled={state.loading && !manifest}
                              onClick={() => {
                                unloadBundle(slot);
                              }}
                            >
                              卸载
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              </div>
            </div>
          </section>
        ) : hasStartedRendering ? (
          <section
            ref={viewportSectionRef}
            class="graph-viewport graph-viewport--active"
            aria-live="polite"
          >
            <div class="canvas-page">
              <div class="canvas-page__header">
                <div>
                  <p class="toolbar__label">Canvas View</p>
                  <h3>{activeWorkspacePage.title}</h3>
                </div>
                <p class="canvas-page__description">
                  {activeWorkspacePage.description}
                </p>
              </div>

              <div class="canvas-page__body">
                <GraphViewport
                  graph={runtimeSetup.graph}
                  plugins={runtimeSetup.plugins}
                  quickCreateNodeType={runtimeSetup.quickCreateNodeType}
                  theme={theme}
                />
              </div>
            </div>
          </section>
        ) : (
          <section
            ref={viewportSectionRef}
            class="graph-viewport graph-viewport--idle"
            aria-live="polite"
          >
            <div class="canvas-page">
              <div class="canvas-page__header">
                <div>
                  <p class="toolbar__label">Canvas View</p>
                  <h3>{activeWorkspacePage.title}</h3>
                </div>
                <p class="canvas-page__description">
                  {activeWorkspacePage.description}
                </p>
              </div>

              <div class="canvas-page__body">
                <div class="graph-root graph-root--idle">
                  <div class="graph-empty-state">
                    <p class="toolbar__label">Viewport</p>
                    <h3>等待开始渲染</h3>
                    <p>
                      你可以先加载本地 bundle，再点击上方画布分页里的“开始渲染”挂载画布。
                    </p>
                    <button
                      type="button"
                      class="render-toggle render-toggle--hero"
                      onClick={startRendering}
                    >
                      在主画布开始渲染
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
