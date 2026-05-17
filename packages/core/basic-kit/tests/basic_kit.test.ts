import { describe, expect, test } from "bun:test";
import * as ui from "leafer-ui";

import type {
  InstallNodeModuleOptions,
  NodeDefinition,
  NodeModule,
  RegisterNodeOptions,
  RegisterWidgetOptions
} from "@leafergraph/core/node";
import type {
  LeaferGraphNodePluginContext,
  LeaferGraphWidgetEntry,
  LeaferGraphWidgetRendererContext
} from "@leafergraph/core/contracts";
import {
  BasicWidgetLibrary
} from "../src/widget";
import { resolveDefaultWidgetTheme } from "@leafergraph/core/theme";
import { WidgetFieldView } from "../src/widget/field_view";
import {
  createBasicSystemNodeModule
} from "../src/node";
import {
  leaferGraphBasicKitPlugin
} from "../src";


function createWidgetRendererContext(width: number, height: number): LeaferGraphWidgetRendererContext {
  return {
    ui,
    group: new ui.Group(),
    node: { id: "node-1", type: "test/node" } as LeaferGraphWidgetRendererContext["node"],
    widget: { type: "input", name: "value" },
    widgetIndex: 0,
    value: "",
    bounds: { x: 0, y: 0, width, height },
    theme: {
      mode: "light",
      tokens: resolveDefaultWidgetTheme("light")
    },
    editing: {} as LeaferGraphWidgetRendererContext["editing"],
    setValue() {},
    commitValue() {},
    requestRender() {},
    emitAction() {
      return false;
    }
  };
}
function createPluginContextRecorder(): {
  context: LeaferGraphNodePluginContext;
  installedModules: NodeModule[];
  registeredWidgets: LeaferGraphWidgetEntry[];
  operations: string[];
} {
  const installedModules: NodeModule[] = [];
  const registeredWidgets: LeaferGraphWidgetEntry[] = [];
  const operations: string[] = [];

  return {
    context: {
      sdk: {} as typeof import("@leafergraph/core/node"),
      ui: {} as typeof import("leafer-ui"),
      installModule(module: NodeModule, _options?: InstallNodeModuleOptions) {
        operations.push("installModule");
        installedModules.push(module);
      },
      registerNode(_definition: NodeDefinition, _options?: RegisterNodeOptions) {},
      registerWidget(
        entry: LeaferGraphWidgetEntry,
        _options?: RegisterWidgetOptions
      ) {
        operations.push(`registerWidget:${entry.type}`);
        registeredWidgets.push(entry);
      },
      hasNode() {
        return false;
      },
      hasWidget() {
        return false;
      },
      getWidget() {
        return undefined;
      },
      listWidgets() {
        return [];
      },
      getNode() {
        return undefined;
      },
      listNodes() {
        return [];
      }
    },
    installedModules,
    registeredWidgets,
    operations
  };
}

describe("@leafergraph/core/basic-kit", () => {
  test("createBasicSystemNodeModule 应返回默认系统节点", () => {
    const module = createBasicSystemNodeModule();
    const nodeTypes = module.nodes?.map((item) => item.type) ?? [];

    expect(nodeTypes).toEqual(["system/on-play", "system/timer"]);
  });

  test("BasicWidgetLibrary 应生成基础 Widget 条目", () => {
    const entries = new BasicWidgetLibrary().createEntries();
    expect(entries.some((entry) => entry.type === "input")).toBe(true);
    expect(entries.some((entry) => entry.type === "button")).toBe(true);
    expect(entries.some((entry) => entry.type === "slider")).toBe(true);
  });


  test("WidgetFieldView keeps input chrome inside widget bounds", () => {
    const context = createWidgetRendererContext(120, 56);
    const view = new WidgetFieldView(context, {
      label: "Value",
      theme: context.theme.tokens
    });

    expect(view.field.x).toBe(0);
    expect(view.field.width).toBe(context.bounds.width);
    expect(view.focusRing.x).toBe(0);
    expect(view.focusRing.width).toBe(context.bounds.width);
    expect((view.focusRing.x ?? 0) + (view.focusRing.width ?? 0)).toBeLessThanOrEqual(
      context.bounds.width
    );
    expect((view.valueText.x ?? 0) + (view.valueText.width ?? 0)).toBeLessThanOrEqual(
      context.bounds.width
    );
  });

  test("leaferGraphBasicKitPlugin 应同时安装系统节点与基础 Widget", async () => {
    const recorder = createPluginContextRecorder();
    await leaferGraphBasicKitPlugin.install(recorder.context);

    expect(recorder.installedModules).toHaveLength(1);
    expect(recorder.operations.at(-1)).toBe("installModule");
    expect(recorder.operations.some((entry) => entry === "registerWidget:input")).toBe(
      true
    );
    expect(
      recorder.installedModules[0]?.nodes?.map((item) => item.type) ?? []
    ).toEqual(["system/on-play", "system/timer"]);
    expect(recorder.registeredWidgets.some((entry) => entry.type === "input")).toBe(
      true
    );
    expect(recorder.registeredWidgets.some((entry) => entry.type === "toggle")).toBe(
      true
    );
  });
});
