/**
 * demo authority worker 入口模块。
 *
 * @remarks
 * 负责在浏览器 Worker 中挂起 demo authority service，并完成 MessagePort host 握手。
 */
import { createDemoRemoteAuthorityService } from "./remote_authority_demo_service";
import { attachMessagePortRemoteAuthorityWorkerHost } from "../session/message_port_remote_authority_worker_host";

attachMessagePortRemoteAuthorityWorkerHost({
  receiver: globalThis as unknown as Parameters<
    typeof attachMessagePortRemoteAuthorityWorkerHost
  >[0]["receiver"],
  service: createDemoRemoteAuthorityService({
    authorityName: "demo-worker"
  })
});
