import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { LeaferGraphNodePlugin } from "leafergraph";
import { createLeaferGraph, type LeaferGraph } from "leafergraph";

import type { EditorTheme } from "../theme";
import {
  createNodeLibraryPreviewDocument,
  NODE_LIBRARY_HOVER_PREVIEW_SIZE,
  resolveNodeLibraryPreviewPlacement,
  type NodeLibraryPreviewAnchorRect,
  type NodeLibraryPreviewPlacement,
  type NodeLibraryPreviewRequest
} from "./node_library_hover_preview";

export interface NodeLibraryHoverPreviewOverlayProps {
  request: NodeLibraryPreviewRequest;
  theme: EditorTheme;
  plugins: readonly LeaferGraphNodePlugin[];
}

function applyNodeLibraryPreviewHostStyle(
  host: HTMLDivElement,
  theme: EditorTheme
): void {
  host.style.background = resolveNodeLibraryPreviewBackground(theme);
  host.style.flex = "1 1 auto";
  host.style.width = "100%";
  host.style.height = "auto";
  host.style.minHeight = "0";
  host.style.alignSelf = "stretch";
}

function resolveNodeLibraryPreviewBackground(theme: EditorTheme): string {
  if (theme === "dark") {
    return "linear-gradient(180deg, rgba(10, 16, 24, 0.98) 0%, rgba(16, 24, 36, 0.98) 100%)";
  }

  return "linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(244, 248, 252, 0.98) 100%)";
}

function createViewportRect(): NodeLibraryPreviewAnchorRect {
  if (typeof window === "undefined") {
    return {
      top: 0,
      left: 0,
      right: NODE_LIBRARY_HOVER_PREVIEW_SIZE.width,
      bottom: NODE_LIBRARY_HOVER_PREVIEW_SIZE.height,
      width: NODE_LIBRARY_HOVER_PREVIEW_SIZE.width,
      height: NODE_LIBRARY_HOVER_PREVIEW_SIZE.height
    };
  }

  return {
    top: 0,
    left: 0,
    right: window.innerWidth,
    bottom: window.innerHeight,
    width: window.innerWidth,
    height: window.innerHeight
  };
}

export function NodeLibraryHoverPreviewOverlay({
  request,
  theme,
  plugins
}: NodeLibraryHoverPreviewOverlayProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<LeaferGraph | null>(null);
  const [viewportRect, setViewportRect] = useState<NodeLibraryPreviewAnchorRect>(
    () => createViewportRect()
  );
  const placement: NodeLibraryPreviewPlacement = useMemo(
    () =>
      resolveNodeLibraryPreviewPlacement({
        anchorRect: request.anchorRect,
        viewportRect,
        previewSize: NODE_LIBRARY_HOVER_PREVIEW_SIZE
      }),
    [request.anchorRect, viewportRect]
  );
  const previewDocument = useMemo(
    () => createNodeLibraryPreviewDocument(request.definition),
    [request.definition]
  );
  const previewTitle = request.definition.title ?? request.definition.type;
  const previewCategory = request.definition.category?.trim() || "Other";

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleResize = (): void => {
      setViewportRect(createViewportRect());
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    applyNodeLibraryPreviewHostStyle(host, theme);

    let cancelled = false;
    let frameId = 0;
    const graph = createLeaferGraph(host, {
      document: previewDocument,
      plugins: [...plugins],
      fill: resolveNodeLibraryPreviewBackground(theme),
      themeMode: theme,
      widgetEditing: {
        enabled: false,
        useOfficialTextEditor: false,
        allowOptionsMenu: false
      }
    });
    graphRef.current = graph;

    void graph.ready.then(() => {
      if (cancelled) {
        return;
      }

      frameId = requestAnimationFrame(() => {
        if (cancelled) {
          return;
        }

        graph.fitView(40);
      });
    });

    return () => {
      cancelled = true;
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
      graphRef.current = null;
      graph.destroy();
    };
  }, [plugins]);

  useEffect(() => {
    const host = hostRef.current;
    const graph = graphRef.current;
    if (!host || !graph) {
      return;
    }

    applyNodeLibraryPreviewHostStyle(host, theme);
    graph.setThemeMode(theme);
  }, [theme]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) {
      return;
    }

    let cancelled = false;
    let frameId = 0;
    void graph.ready.then(() => {
      if (cancelled) {
        return;
      }

      graph.replaceGraphDocument(previewDocument);
      graph.setThemeMode(theme);
      frameId = requestAnimationFrame(() => {
        if (cancelled) {
          return;
        }

        graph.fitView(40);
      });
    });

    return () => {
      cancelled = true;
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [previewDocument]);

  return (
    <div
      class="node-library-preview"
      data-side={placement.side}
      style={{
        top: `${placement.top}px`,
        left: `${placement.left}px`
      }}
      aria-hidden="true"
    >
      <section class="node-library-preview__card">
        <header class="node-library-preview__header">
          <div class="node-library-preview__titleblock">
            <p class="workspace-pane__eyebrow">Node Preview</p>
            <h3>{previewTitle}</h3>
            <p class="node-library-preview__type">{request.definition.type}</p>
          </div>
          <span class="node-library__tag">{previewCategory}</span>
        </header>
        <div class="node-library-preview__stage">
          <div ref={hostRef} class="graph-root node-library-preview__graph" />
        </div>
        {request.definition.description ? (
          <footer class="node-library-preview__footer">
            <p>{request.definition.description}</p>
          </footer>
        ) : null}
      </section>
    </div>
  );
}
