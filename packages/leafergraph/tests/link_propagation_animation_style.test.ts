import { describe, expect, test } from "bun:test";

import { createDefaultDataFlowAnimationStyleConfig } from "../src/graph/graph_runtime_style";

describe("link_propagation_animation_style", () => {
  test("performance 预设应默认开启 pulse 并关闭 travelling 粒子", () => {
    const style = createDefaultDataFlowAnimationStyleConfig("performance");

    expect(style.enabled).toBe(true);
    expect(style.preset).toBe("performance");
    expect(style.maxPulses).toBeGreaterThan(0);
    expect(style.maxParticles).toBe(0);
  });

  test("balanced 预设应只保留 travelling 粒子", () => {
    const style = createDefaultDataFlowAnimationStyleConfig("balanced");

    expect(style.enabled).toBe(true);
    expect(style.preset).toBe("balanced");
    expect(style.maxPulses).toBe(0);
    expect(style.maxParticles).toBeGreaterThan(0);
  });

  test("expressive 预设应同时启用 pulse 和 travelling 粒子", () => {
    const style = createDefaultDataFlowAnimationStyleConfig("expressive");

    expect(style.enabled).toBe(true);
    expect(style.preset).toBe("expressive");
    expect(style.maxPulses).toBeGreaterThan(0);
    expect(style.maxParticles).toBeGreaterThan(0);
  });

  test("false 配置应关闭全部连线传播动画", () => {
    const style = createDefaultDataFlowAnimationStyleConfig(false);

    expect(style.enabled).toBe(false);
    expect(style.maxPulses).toBe(0);
    expect(style.maxParticles).toBe(0);
  });
});
