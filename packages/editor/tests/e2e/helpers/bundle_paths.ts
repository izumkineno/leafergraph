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
  ),
  authoringWidget: fileURLToPath(
    new URL(
      "../../../public/__testbundles/authoring-widget.iife.js",
      import.meta.url
    )
  ),
  authoringNode: fileURLToPath(
    new URL(
      "../../../public/__testbundles/authoring-node.iife.js",
      import.meta.url
    )
  ),
  authoringDemo: fileURLToPath(
    new URL(
      "../../../public/__testbundles/authoring-demo.iife.js",
      import.meta.url
    )
  )
} as const;
