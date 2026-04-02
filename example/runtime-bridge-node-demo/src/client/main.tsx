import "./index.css";
import { mountRuntimeBridgeNodeDemo } from "./app";

const root = document.getElementById("app");

if (!root) {
  throw new Error("Runtime bridge demo root container is missing.");
}

mountRuntimeBridgeNodeDemo(root);
