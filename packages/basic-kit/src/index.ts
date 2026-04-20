/**
 * `@leafergraph/basic-kit` 的统一公共入口。
 *
 * @remarks
 * 负责提供默认内容的一键安装入口；
 * 更细的 widgets 和系统节点导出分别通过 `./widget` 与 `./node` 子路径暴露。
 */

import type { LeaferGraphNodePlugin } from "@leafergraph/contracts";
import { BasicWidgetLibrary } from "./widget";
import { createBasicSystemNodeModule } from "./node";

/**
 * 默认内容包的一键安装插件。
 *
 * @remarks
 * 它会按固定顺序安装：
 * 1. 基础 Widget 条目
 * 2. 系统节点模块
 *
 * 这样像 `system/timer` 这类直接引用 `input` / `toggle` Widget 的节点，
 * 在进入节点注册表校验时就已经能命中对应 Widget 定义。
 */
export const leaferGraphBasicKitPlugin: LeaferGraphNodePlugin = {
  name: "@leafergraph/basic-kit",
  install(context) {
    for (const entry of new BasicWidgetLibrary().createEntries()) {
      context.registerWidget(entry, { overwrite: true });
    }

    context.installModule(createBasicSystemNodeModule(), { overwrite: true });
  }
};
