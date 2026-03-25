import { fileURLToPath, URL } from "node:url";

import preact from "@preact/preset-vite";
import { defineConfig } from "vite";

const leafergraphEntry = fileURLToPath(
  new URL("../leafergraph/src/index.ts", import.meta.url)
);
const authoringEntry = fileURLToPath(
  new URL("../authoring/src/index.ts", import.meta.url)
);

const editorHtmlEntries = {
  index: fileURLToPath(new URL("./index.html", import.meta.url)),
  authorityPythonHostDemo: fileURLToPath(
    new URL("./authority-python-host-demo.html", import.meta.url)
  )
} as const;

export default defineConfig(({ mode }) => {
  const enableLanHost = mode === "lan" || process.env.VITE_LAN === "true";
  const githubPagesBase = process.env.GITHUB_PAGES_BASE || "/";

  return {
    base: githubPagesBase,
    plugins: [preact()],
    resolve: {
      alias: {
        leafergraph: leafergraphEntry,
        "@leafergraph/authoring": authoringEntry
      }
    },
    server: {
      port: 5501,
      host: enableLanHost ? "0.0.0.0" : undefined
    },
    build: {
      rollupOptions: {
        input: editorHtmlEntries
      }
    }
  };
});
