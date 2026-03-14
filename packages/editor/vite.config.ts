import { fileURLToPath, URL } from "node:url";

import preact from "@preact/preset-vite";
import { defineConfig } from "vite";

const leafergraphEntry = fileURLToPath(
  new URL("../leafergraph/src/index.ts", import.meta.url)
);

export default defineConfig(({ mode }) => {
  const enableLanHost = mode === "lan" || process.env.VITE_LAN === "true";

  return {
    plugins: [preact()],
    resolve: {
      alias: {
        leafergraph: leafergraphEntry
      }
    },
    server: {
      port: 5501,
      host: enableLanHost ? "0.0.0.0" : undefined
    }
  };
});
