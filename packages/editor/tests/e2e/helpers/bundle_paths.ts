import { fileURLToPath } from "node:url";

export const TEST_BUNDLE_PATHS = {
  widget: fileURLToPath(
    new URL("../../../public/__testbundles/widget.iife.js", import.meta.url)
  ),
  node: fileURLToPath(
    new URL("../../../public/__testbundles/node.iife.js", import.meta.url)
  ),
  demo: fileURLToPath(
    new URL("../../../public/__testbundles/demo.iife.js", import.meta.url)
  )
} as const;
