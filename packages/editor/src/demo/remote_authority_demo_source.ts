import {
  createEditorRemoteAuthorityWorkerSource,
  type CreateEditorRemoteAuthorityWorkerSourceOptions
} from "../app/remote_authority_app_runtime";

/** 浏览器内 demo worker authority source 的最小创建参数。 */
export interface CreateEditorRemoteAuthorityDemoWorkerSourceOptions {
  /** authority 标题。 */
  label?: string;
  /** authority 说明。 */
  description?: string;
  /**
   * 自定义 worker 创建器。
   *
   * @remarks
   * 测试时可注入 fake worker；浏览器默认使用真实 module worker。
   */
  createWorker?(): CreateEditorRemoteAuthorityWorkerSourceOptions["worker"];
}

function createDefaultWorker() {
  return new Worker(
    new URL("./remote_authority_demo_worker.ts", import.meta.url),
    {
      type: "module",
      name: "leafergraph-remote-authority-demo"
    }
  );
}

/**
 * 创建浏览器内置的 demo worker authority source。
 *
 * @remarks
 * 这层给预览、手工回归和宿主 demo 一个零后端依赖的 authority 示例：
 * editor 仍走正式 remote authority 主链，但 authority 自身运行在浏览器 worker 中。
 */
export function createEditorRemoteAuthorityDemoWorkerSource(
  options: CreateEditorRemoteAuthorityDemoWorkerSourceOptions = {}
) {
  return createEditorRemoteAuthorityWorkerSource({
    label: options.label ?? "Demo Worker Authority",
    description:
      options.description ?? "浏览器内置的 worker authority 示例",
    worker: (options.createWorker ?? createDefaultWorker)(),
    terminateWorkerOnDispose: true
  });
}
