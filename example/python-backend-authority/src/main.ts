import { h, render } from "preact";
import { App } from "./app.tsx";
import "./index.css";

render(h(App, {}), document.getElementById("app")!);
