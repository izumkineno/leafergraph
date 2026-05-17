import { createLeaferGraph } from "leafergraph";
import type { LeaferGraph } from "leafergraph";
import { SMALL_GRAPH_NODE_DEFINITIONS } from "./graph/node_definitions";
import { createSmallInteractiveGraphDocument } from "./graph/example_document";
import { installSmallInteractiveGraphLinkDisconnect } from "./graph/link_disconnect";
import "./style.css";

interface SmallInteractiveGraphDebugSurface {
  getGraph(): LeaferGraph;
  fit(): void;
  destroy(): void;
}

function createAppShell(): HTMLDivElement {
  const app = document.getElementById("app");
  if (!app) {
    throw new Error("Missing #app container");
  }

  const shell = document.createElement("div");
  shell.className = "app-shell";
  shell.innerHTML = `
    <section class="hero">
      <p class="eyebrow">LeaferGraph sample</p>
      <h1>Small interactive graph</h1>
      <p>
        A minimal native DOM example. Drag nodes, reconnect ports, pan, and zoom.
      </p>
    </section>
    <section class="layout">
      <div class="card stage-card">
        <div class="card-header">
          <div>
            <h2>Graph</h2>
            <p>Preseeded three-node chain, ready for interaction.</p>
          </div>
          <div class="actions">
            <button type="button" data-action="fit">Fit view</button>
          </div>
        </div>
        <div id="stage-host" class="stage-host" aria-label="Graph stage"></div>
      </div>
      <aside class="card notes-card">
        <h2>What to try</h2>
        <ol>
          <li>Select a node.</li>
          <li>Drag a node to a new position.</li>
          <li>Reconnect the chain using the ports.</li>
          <li>Pan and zoom the canvas.</li>
        </ol>
        <p class="note">This example intentionally avoids Preact and editor-shell extras.</p>
      </aside>
    </section>
  `;

  app.replaceChildren(shell);
  return shell;
}

function installStageControls(
  graph: LeaferGraph,
  shell: HTMLElement,
  signal: AbortSignal
): void {
  const fitButton = shell.querySelector<HTMLButtonElement>("[data-action='fit']");

  fitButton?.addEventListener(
    "click",
    () => {
      graph.fitView();
    },
    { signal }
  );
}

async function bootstrap(): Promise<void> {
  const shell = createAppShell();
  const stageHost = shell.querySelector<HTMLElement>("#stage-host");
  if (!stageHost) {
    throw new Error("Missing stage host");
  }

  const graph = createLeaferGraph(stageHost, {
    modules: [
      {
        nodes: [...SMALL_GRAPH_NODE_DEFINITIONS]
      }
    ],
    document: createSmallInteractiveGraphDocument(),
    themeMode: "dark"
  });

  await graph.ready;
  graph.fitView();

  const linkDisconnectController = installSmallInteractiveGraphLinkDisconnect(graph);

  const controlsAbort = new AbortController();
  installStageControls(graph, shell, controlsAbort.signal);

  const destroy = (): void => {
    controlsAbort.abort();
    linkDisconnectController.destroy();
    graph.destroy();
    const app = document.getElementById("app");
    if (app) {
      app.innerHTML = '<pre class="error">small-interactive-graph destroyed.</pre>';
    }
    delete (window as Window & { __SMALL_INTERACTIVE_GRAPH__?: unknown }).__SMALL_INTERACTIVE_GRAPH__;
  };

  (window as Window & { __SMALL_INTERACTIVE_GRAPH__?: SmallInteractiveGraphDebugSurface })
    .__SMALL_INTERACTIVE_GRAPH__ = {
    getGraph: () => graph,
    fit: () => graph.fitView(),
    destroy
  };
}

void bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  const app = document.getElementById("app");
  if (app) {
    app.innerHTML = `<pre class="error">Failed to start example: ${message}</pre>`;
  }
  console.error("[small-interactive-graph] bootstrap failed", error);
});
