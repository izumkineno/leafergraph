/**
 * Tauri authority demo 前端入口。
 *
 * @remarks
 * 这里只负责挂载根组件与导入全局样式，
 * 页面结构和图生命周期都收口到分层模块中。
 */
import { render } from "preact";

import { App } from "./app/App";
import "./style.css";

render(<App />, document.getElementById("root")!);
