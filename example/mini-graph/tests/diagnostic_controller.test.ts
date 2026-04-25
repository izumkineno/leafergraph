import "../../../packages/leafergraph/tests/setup";
import { describe, expect, test } from "bun:test";

import {
  createMiniGraphDiagnosticController,
  type DiagnosticControllerState
} from "../src/graph/diagnostic_controller";

function createHostElement(): HTMLElement {
  return document.createElement("div");
}

describe("mini-graph diagnostic controller", () => {
  test("subscribeState immediately emits an immutable snapshot and unsubscribe is idempotent", () => {
    const controller = createMiniGraphDiagnosticController({ now: () => 1000 });
    const states: DiagnosticControllerState[] = [];

    const unsubscribe = controller.subscribeState((state) => {
      states.push(state);
    });

    expect(states).toHaveLength(1);
    expect(states[0]?.status).toBe("idle");

    const firstSnapshot = states[0];
    firstSnapshot?.logs.push({ id: 999, timestamp: 0, message: "mutated" });
    expect(controller.getState().logs).toHaveLength(0);

    unsubscribe();
    unsubscribe();
    controller.setIntervalMs(25);

    expect(states).toHaveLength(1);
  });

  test("bootstrap reaches ready and repeated bootstrap resolves as no-op", async () => {
    const controller = createMiniGraphDiagnosticController({ now: () => 1000 });
    const states: DiagnosticControllerState[] = [];
    controller.subscribeState((state) => {
      states.push(state);
    });

    await controller.bootstrap(createHostElement());
    await controller.bootstrap(createHostElement());

    expect(controller.getState().status).toBe("ready");
    expect(states.some((state) => state.status === "bootstrapping")).toBe(true);
    expect(states.at(-1)?.status).toBe("ready");
  });

  test("bootstrapping returns the same in-flight promise", () => {
    const controller = createMiniGraphDiagnosticController();
    const host = createHostElement();

    const firstBootstrap = controller.bootstrap(host);
    const secondBootstrap = controller.bootstrap(host);

    expect(secondBootstrap).toBe(firstBootstrap);
    controller.destroy();
    return expect(firstBootstrap).rejects.toThrow(/销毁|取消|destroy/i);
  });


  test("bootstrap failure moves the controller to error state with lastError", async () => {
    const controller = createMiniGraphDiagnosticController({
      graphFactory: () => {
        throw new Error("forced bootstrap failure");
      }
    } as MiniGraphDiagnosticControllerOptions);
    const states: DiagnosticControllerState[] = [];
    controller.subscribeState((state) => {
      states.push(state);
    });

    await expect(controller.bootstrap(createHostElement())).rejects.toThrow(
      "forced bootstrap failure"
    );
    expect(controller.getState()).toMatchObject({
      status: "error",
      lastError: "forced bootstrap failure"
    });
    expect(states.some((state) => state.status === "error")).toBe(true);
  });

  test("destroy during in-flight bootstrap rejects and leaves final state destroyed", async () => {
    const controller = createMiniGraphDiagnosticController();
    const bootstrap = controller.bootstrap(createHostElement());

    controller.destroy();

    await expect(bootstrap).rejects.toThrow(/销毁|取消|destroy/i);
    expect(controller.getState()).toMatchObject({
      status: "destroyed",
      nodeCount: 0,
      linkCount: 0,
      hasDiagnosticChain: false
    });
  });
  test("bootstrap after destroy rejects with a controlled error", async () => {
    const controller = createMiniGraphDiagnosticController();
    controller.destroy();

    await expect(controller.bootstrap(createHostElement())).rejects.toThrow(/销毁|destroy/i);
    expect(controller.getState().status).toBe("destroyed");
  });

  test("setIntervalMs normalizes values and createDiagnosticChain updates state", async () => {
    const controller = createMiniGraphDiagnosticController({ now: () => 1000 });

    await controller.bootstrap(createHostElement());
    controller.setIntervalMs(25);
    controller.createDiagnosticChain();

    const state = controller.getState();
    expect(state.intervalMs).toBe(25);
    expect(state.hasDiagnosticChain).toBe(true);
    expect(state.nodeCount).toBe(4);
    expect(state.linkCount).toBe(3);
  });

  test("play returns false until the controller is ready and a chain exists", async () => {
    const controller = createMiniGraphDiagnosticController();

    expect(controller.play()).toBe(false);
    await controller.bootstrap(createHostElement());
    expect(controller.play()).toBe(false);

    controller.createDiagnosticChain();
    const firstPlay = controller.play();
    const secondPlay = controller.play();

    expect(firstPlay).toBe(true);
    expect(secondPlay).toBe(false);
    expect(controller.getState().status).toBe("playing");
  });

  test("reset stops playback, clears the chain, and keeps the controller reusable", async () => {
    const controller = createMiniGraphDiagnosticController();

    await controller.bootstrap(createHostElement());
    controller.createDiagnosticChain();
    controller.play();
    controller.reset();

    expect(controller.getState()).toMatchObject({
      status: "ready",
      hasDiagnosticChain: false,
      nodeCount: 0,
      linkCount: 0
    });

    controller.createDiagnosticChain();
    expect(controller.getState().hasDiagnosticChain).toBe(true);
  });

  test("destroy is idempotent and makes later actions no-op", async () => {
    const controller = createMiniGraphDiagnosticController();
    const states: DiagnosticControllerState[] = [];
    controller.subscribeState((state) => {
      states.push(state);
    });

    await controller.bootstrap(createHostElement());
    controller.createDiagnosticChain();
    controller.destroy();
    controller.destroy();
    controller.setIntervalMs(10);
    controller.createDiagnosticChain();
    controller.reset();
    controller.fit();

    expect(controller.play()).toBe(false);
    expect(controller.stop()).toBe(false);
    expect(controller.getState()).toMatchObject({
      status: "destroyed",
      nodeCount: 0,
      linkCount: 0,
      hasDiagnosticChain: false
    });
    expect(states.at(-1)?.status).toBe("destroyed");

    const postDestroyStates: DiagnosticControllerState[] = [];
    const unsubscribe = controller.subscribeState((state) => {
      postDestroyStates.push(state);
    });
    unsubscribe();
    expect(postDestroyStates).toHaveLength(1);
    expect(postDestroyStates[0]?.status).toBe("destroyed");
  });
});
