/**
 * 主包 public façade 方法安装器。
 *
 * @remarks
 * 负责把分散在 `src/public/facade/*` 的方法一次性挂到
 * `LeaferGraph.prototype`，保持根入口类文件尽量精简。
 */

import type { LeaferGraph } from "../leafer_graph";
import { leaferGraphConnectionFacadeMethods } from "./connection";
import { leaferGraphDocumentFacadeMethods } from "./document";
import { leaferGraphExecutionFacadeMethods } from "./execution";
import { leaferGraphMutationFacadeMethods } from "./mutations";
import { leaferGraphQueryFacadeMethods } from "./query";
import { leaferGraphRegistryFacadeMethods } from "./registry";
import { leaferGraphSelectionFacadeMethods } from "./selection";
import { leaferGraphSubscriptionFacadeMethods } from "./subscriptions";
import { leaferGraphViewFacadeMethods } from "./view";

const leaferGraphFacadeInstalledMarker = Symbol("leafergraph.public.facade.installed");

type LeaferGraphInstallablePrototype = LeaferGraph & {
  [leaferGraphFacadeInstalledMarker]?: boolean;
};

/**
 * 以类方法语义把一组 façade 方法挂到原型上。
 *
 * @param prototype - 目标原型对象。
 * @param methods - 需要安装的方法集合。
 * @returns 无返回值。
 */
function defineLeaferGraphFacadeMethods(
  prototype: LeaferGraphInstallablePrototype,
  methods: object
): void {
  const methodEntries = Object.entries(methods as Record<
    string,
    (this: LeaferGraph, ...args: any[]) => unknown
  >);
  for (const [name, method] of methodEntries) {
    Object.defineProperty(prototype, name, {
      configurable: true,
      writable: true,
      value: method
    });
  }
}

/**
 * 把全部 public façade 方法安装到 `LeaferGraph.prototype`。
 *
 * @param LeaferGraphClass - 目标类构造器。
 * @returns 无返回值。
 */
export function installLeaferGraphFacade(LeaferGraphClass: {
  prototype: LeaferGraphInstallablePrototype;
}): void {
  if (LeaferGraphClass.prototype[leaferGraphFacadeInstalledMarker]) {
    return;
  }

  // 先按职责分组把 façade 方法全部挂到原型上，保持 `leafer_graph.ts` 为薄入口。
  defineLeaferGraphFacadeMethods(
    LeaferGraphClass.prototype,
    leaferGraphRegistryFacadeMethods
  );
  defineLeaferGraphFacadeMethods(
    LeaferGraphClass.prototype,
    leaferGraphViewFacadeMethods
  );
  defineLeaferGraphFacadeMethods(
    LeaferGraphClass.prototype,
    leaferGraphSelectionFacadeMethods
  );
  defineLeaferGraphFacadeMethods(
    LeaferGraphClass.prototype,
    leaferGraphQueryFacadeMethods
  );
  defineLeaferGraphFacadeMethods(
    LeaferGraphClass.prototype,
    leaferGraphExecutionFacadeMethods
  );
  defineLeaferGraphFacadeMethods(
    LeaferGraphClass.prototype,
    leaferGraphSubscriptionFacadeMethods
  );
  defineLeaferGraphFacadeMethods(
    LeaferGraphClass.prototype,
    leaferGraphDocumentFacadeMethods
  );
  defineLeaferGraphFacadeMethods(
    LeaferGraphClass.prototype,
    leaferGraphConnectionFacadeMethods
  );
  defineLeaferGraphFacadeMethods(
    LeaferGraphClass.prototype,
    leaferGraphMutationFacadeMethods
  );

  // 最后写入一次性安装标记，避免测试环境或重复导入时重复覆盖原型。
  Object.defineProperty(LeaferGraphClass.prototype, leaferGraphFacadeInstalledMarker, {
    configurable: false,
    enumerable: false,
    writable: false,
    value: true
  });
}
