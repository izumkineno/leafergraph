/**
 * Python WebSocket authority demo 页面入口模块。
 *
 * @remarks
 * 负责在独立 demo 页面里安装 WebSocket bootstrap，并挂起 editor 主入口。
 */
import { installPythonWebSocketHostDemoBootstrap } from "./python_websocket_host_demo_bootstrap";

installPythonWebSocketHostDemoBootstrap();
void import("../main");
