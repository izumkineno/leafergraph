import { render } from "preact";

import { App } from "./app/App";
import "./app/style.css";

const host = document.querySelector<HTMLDivElement>("#app");

if (!host) {
  throw new Error("LeaferGraph editor host not found.");
}

render(<App />, host);
