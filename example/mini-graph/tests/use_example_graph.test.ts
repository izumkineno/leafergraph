import { describe, expect, test } from "bun:test";

describe("mini-graph example config", () => {
  test("启用 widget 文本编辑，避免标题重命名和 input widget 编辑失效", async () => {
    const module = await import("../src/graph/use_example_graph");

    expect("EXAMPLE_MINI_GRAPH_CONFIG" in module).toBe(true);
    expect((module as Record<string, any>).EXAMPLE_MINI_GRAPH_CONFIG).toMatchObject({
      graph: {
        widget: {
          editing: {
            enabled: true
          }
        }
      }
    });
  });
});
