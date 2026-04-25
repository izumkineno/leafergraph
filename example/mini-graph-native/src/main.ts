import {
  createMiniGraphDiagnosticController,
  type DiagnosticControllerState,
  type MiniGraphDiagnosticController
} from "@mini-graph-diagnostic";

import "./style.css";

declare global {
  interface Window {
    __MINI_GRAPH_NATIVE_TEST__?: MiniGraphNativeTestSurface;
  }
}

interface MiniGraphNativeTestSurface {
  createChain(): void;
  setIntervalMs(value: number): void;
  play(): boolean;
  stop(): boolean;
  reset(): void;
  fit(): void;
  destroy(): void;
  getState(): DiagnosticControllerState;
}

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("缺少 #app 挂载点，无法启动原生诊断 demo");
}

app.innerHTML = `
  <main class="native-demo">
    <section class="toolbar" aria-label="mini-graph 原生内存诊断控制台">
      <div class="title-block">
        <p class="eyebrow">Native TypeScript comparison</p>
        <h1>MiniGraph 内存泄漏对照 demo</h1>
        <p class="description">
          这个页面不使用 Preact/React/Vue/lit/signals，只用原生 DOM 与共享诊断控制器，
          用来和 Preact mini-graph 对比 stop/reset 后的页面内存回落情况。
        </p>
      </div>
      <label class="field">
        <span>Timer 间隔(ms)</span>
        <input id="interval-input" type="number" min="1" step="1" value="25" />
      </label>
      <div class="actions">
        <button id="create-chain-button" type="button">创建诊断链</button>
        <button id="play-button" type="button">Play</button>
        <button id="stop-button" type="button">Stop</button>
        <button id="reset-button" type="button">Reset</button>
        <button id="fit-button" type="button">Fit</button>
        <button id="destroy-button" type="button" class="danger">Destroy</button>
      </div>
      <dl class="status-grid" id="status-grid"></dl>
    </section>
    <section class="stage-panel" aria-label="LeaferGraph 画布">
      <div id="stage-host" class="stage-host"></div>
    </section>
    <section class="log-panel" aria-label="诊断日志">
      <h2>诊断日志</h2>
      <ol id="log-list"></ol>
    </section>
  </main>
`;

const stageHost = getRequiredElement<HTMLDivElement>("stage-host");
const intervalInput = getRequiredElement<HTMLInputElement>("interval-input");
const statusGrid = getRequiredElement<HTMLElement>("status-grid");
const logList = getRequiredElement<HTMLOListElement>("log-list");
const createChainButton = getRequiredElement<HTMLButtonElement>("create-chain-button");
const playButton = getRequiredElement<HTMLButtonElement>("play-button");
const stopButton = getRequiredElement<HTMLButtonElement>("stop-button");
const resetButton = getRequiredElement<HTMLButtonElement>("reset-button");
const fitButton = getRequiredElement<HTMLButtonElement>("fit-button");
const destroyButton = getRequiredElement<HTMLButtonElement>("destroy-button");

const controller = createMiniGraphDiagnosticController({ maxLogs: 80 });
let currentController: MiniGraphDiagnosticController | null = controller;
let unsubscribeState: (() => void) | null = controller.subscribeState(renderState);
let ownsTestSurface = false;

controller
  .bootstrap(stageHost)
  .catch((error: unknown) => {
    if (controller.getState().status !== "destroyed") {
      renderBootstrapError(error);
    }
  });

intervalInput.addEventListener("change", () => {
  controller.setIntervalMs(readIntervalInput());
});

createChainButton.addEventListener("click", () => {
  controller.setIntervalMs(readIntervalInput());
  controller.createDiagnosticChain();
});

playButton.addEventListener("click", () => {
  controller.play();
});

stopButton.addEventListener("click", () => {
  controller.stop();
});

resetButton.addEventListener("click", () => {
  controller.reset();
});

fitButton.addEventListener("click", () => {
  controller.fit();
});

destroyButton.addEventListener("click", () => {
  destroyDemo();
});

const testSurface: MiniGraphNativeTestSurface = {
  createChain() {
    controller.createDiagnosticChain();
  },
  setIntervalMs(value: number) {
    controller.setIntervalMs(value);
  },
  play() {
    return controller.play();
  },
  stop() {
    return controller.stop();
  },
  reset() {
    controller.reset();
  },
  fit() {
    controller.fit();
  },
  destroy() {
    destroyDemo();
  },
  getState() {
    return controller.getState();
  }
};

window.__MINI_GRAPH_NATIVE_TEST__ = testSurface;
ownsTestSurface = true;

window.addEventListener("beforeunload", destroyDemo, { once: true });

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    destroyDemo();
  });
}

function getRequiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`缺少 #${id} 元素，无法启动原生诊断 demo`);
  }
  return element as T;
}

function readIntervalInput(): number {
  return Math.max(1, Math.floor(intervalInput.valueAsNumber || 25));
}

function renderState(state: DiagnosticControllerState): void {
  intervalInput.value = String(state.intervalMs);
  statusGrid.innerHTML = `
    <div><dt>状态</dt><dd>${escapeHtml(state.status)}</dd></div>
    <div><dt>节点数</dt><dd>${state.nodeCount}</dd></div>
    <div><dt>连线数</dt><dd>${state.linkCount}</dd></div>
    <div><dt>播放次数</dt><dd>${state.runCount}</dd></div>
    <div><dt>诊断链</dt><dd>${state.hasDiagnosticChain ? "已创建" : "未创建"}</dd></div>
    <div><dt>最后错误</dt><dd>${escapeHtml(state.lastError ?? "无")}</dd></div>
  `;
  logList.innerHTML = state.logs
    .map((entry) => {
      const timestamp = new Date(entry.timestamp).toLocaleTimeString();
      return `<li><time>${escapeHtml(timestamp)}</time><span>${escapeHtml(entry.message)}</span></li>`;
    })
    .join("");
}

function renderBootstrapError(error: unknown): void {
  const message = error instanceof Error ? error.message : "诊断图初始化失败";
  statusGrid.insertAdjacentHTML(
    "beforeend",
    `<div class="error"><dt>初始化异常</dt><dd>${escapeHtml(message)}</dd></div>`
  );
}

function destroyDemo(): void {
  if (!currentController) {
    return;
  }

  unsubscribeState?.();
  unsubscribeState = null;
  currentController.destroy();
  currentController = null;
  if (ownsTestSurface && window.__MINI_GRAPH_NATIVE_TEST__ === testSurface) {
    delete window.__MINI_GRAPH_NATIVE_TEST__;
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return char;
    }
  });
}
