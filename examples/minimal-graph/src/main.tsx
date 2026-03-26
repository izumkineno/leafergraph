/**
 * 最小图示例浏览器入口。
 *
 * @remarks
 * 当前只负责：
 * - 挂载 Preact 根组件
 * - 校验页面宿主节点
 * - 引入全局样式
 */
import { render } from "preact";

import { App } from "./app/App";
import "./style.css";

/** 浏览器侧最小示例挂载点。 */
const host = document.querySelector<HTMLDivElement>("#app");

if (!host) {
  throw new Error("最小图示例缺少挂载节点 #app");
}

render(<App />, host);
