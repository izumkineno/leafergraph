import { describe, expect, it } from "bun:test";

import {
  NodeRegistry,
  applyNodeModuleScope,
  installNodeModule,
  resolveNodeModuleScope,
  resolveScopedNodeType,
  type WidgetDefinitionReader
} from "../src";

const emptyWidgetReader: WidgetDefinitionReader = {
  get() {
    return undefined;
  }
};

describe("@leafergraph/core/node module helpers", () => {
  it("会标准化模块作用域并正确补全 scoped type", () => {
    expect(
      resolveNodeModuleScope(
        { namespace: "/system\\core/", group: "  Runtime  " },
        { namespace: " /app//demo/ " }
      )
    ).toEqual({
      namespace: "app/demo",
      group: "Runtime"
    });

    expect(resolveScopedNodeType("timer", "system/core")).toBe("system/core/timer");
    expect(resolveScopedNodeType("system/timer", "system/core")).toBe("system/timer");
    expect(resolveScopedNodeType("system:timer", "system/core")).toBe("system:timer");
  });

  it("applyNodeModuleScope 会继承默认 group，但不会覆盖节点自己的 category", () => {
    const scoped = applyNodeModuleScope(
      {
        type: "timer",
        title: "Timer"
      },
      {
        namespace: "system",
        group: "Runtime"
      }
    );

    expect(scoped.type).toBe("system/timer");
    expect(scoped.category).toBe("Runtime");

    const keepsOwnCategory = applyNodeModuleScope(
      {
        type: "system/custom",
        title: "Custom",
        category: "Special"
      },
      {
        namespace: "system",
        group: "Runtime"
      }
    );

    expect(keepsOwnCategory.type).toBe("system/custom");
    expect(keepsOwnCategory.category).toBe("Special");
  });

  it("installNodeModule 会安装解析后的节点定义并返回标准结果", () => {
    const registry = new NodeRegistry(emptyWidgetReader);

    const resolved = installNodeModule(registry, {
      scope: {
        namespace: " /system\\core/ ",
        group: "Runtime"
      },
      nodes: [
        {
          type: "timer",
          title: "Timer"
        },
        {
          type: "system/custom",
          title: "Custom",
          category: "Special"
        }
      ]
    });

    expect(resolved.scope).toEqual({
      namespace: "system/core",
      group: "Runtime"
    });
    expect(resolved.nodes.map((node) => `${node.type}:${node.category ?? ""}`)).toEqual([
      "system/core/timer:Runtime",
      "system/custom:Special"
    ]);
    expect(registry.listNodes().map((node) => node.type)).toEqual([
      "system/core/timer",
      "system/custom"
    ]);
  });
});
