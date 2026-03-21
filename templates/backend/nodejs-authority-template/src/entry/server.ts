import { runTemplateNodeBackendControlServer } from "../index.js";

runTemplateNodeBackendControlServer().catch((error: unknown) => {
  const reason =
    error instanceof Error ? error.stack || error.message : String(error);
  console.error("[nodejs-authority-template]", reason);
  process.exit(1);
});
