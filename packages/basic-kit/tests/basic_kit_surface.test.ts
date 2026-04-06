import { describe, expect, test } from "bun:test";

import { leaferGraphBasicKitPlugin } from "../src";
import { createBasicSystemNodeModule } from "../src/node";
import {
  BasicWidgetLibrary,
  BasicWidgetRendererLibrary
} from "../src/widget";

function createPluginContextRecorder(): {
  context: any;
  operations: string[];
  registeredWidgets: string[];
  installedModules: any[];
} {
  const operations: string[] = [];
  const registeredWidgets: string[] = [];
  const installedModules: any[] = [];

  return {
    context: {
      sdk: {},
      ui: {},
      installModule(module: any) {
        operations.push("installModule");
        installedModules.push(module);
      },
      registerNode() {},
      registerWidget(entry: { type: string }) {
        operations.push(`registerWidget:${entry.type}`);
        registeredWidgets.push(entry.type);
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
    operations,
    registeredWidgets,
    installedModules
  };
}

describe("@leafergraph/basic-kit surface", () => {
  test("default widget entries and aliases stay stable", () => {
    const entries = new BasicWidgetLibrary().createEntries();

    expect(entries.map((entry) => entry.type)).toEqual([
      "number",
      "string",
      "custom",
      "input",
      "textarea",
      "select",
      "checkbox",
      "toggle",
      "slider",
      "button",
      "radio"
    ]);
    expect(entries.map((entry) => entry.title)).toEqual(entries.map((entry) => entry.type));
    expect(BasicWidgetRendererLibrary).toBe(BasicWidgetLibrary);
  });

  test("basic system module keeps the default node order", () => {
    const module = createBasicSystemNodeModule();
    expect(module.nodes?.map((item) => item.type) ?? []).toEqual([
      "system/on-play",
      "system/timer"
    ]);
  });

  test("plugin installs widget entries before the system module", async () => {
    const recorder = createPluginContextRecorder();

    await leaferGraphBasicKitPlugin.install(recorder.context);

    expect(recorder.operations).toEqual([
      "registerWidget:number",
      "registerWidget:string",
      "registerWidget:custom",
      "registerWidget:input",
      "registerWidget:textarea",
      "registerWidget:select",
      "registerWidget:checkbox",
      "registerWidget:toggle",
      "registerWidget:slider",
      "registerWidget:button",
      "registerWidget:radio",
      "installModule"
    ]);
    expect(recorder.registeredWidgets).toEqual([
      "number",
      "string",
      "custom",
      "input",
      "textarea",
      "select",
      "checkbox",
      "toggle",
      "slider",
      "button",
      "radio"
    ]);
    expect(recorder.installedModules[0]?.nodes?.map((item: any) => item.type) ?? []).toEqual([
      "system/on-play",
      "system/timer"
    ]);
  });
});

