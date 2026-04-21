import { describe, expect, test } from "bun:test";

import type {
  InstallNodeModuleOptions,
  NodeDefinition,
  NodeModule,
  RegisterNodeOptions,
  RegisterWidgetOptions
} from "@leafergraph/core/node";
import type {
  LeaferGraphNodePluginContext,
  LeaferGraphWidgetEntry
} from "@leafergraph/core/contracts";
import {
  BasicWidgetLibrary
} from "../src/widget";
import {
  createBasicSystemNodeModule
} from "../src/node";
import {
  leaferGraphBasicKitPlugin
} from "../src";

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
