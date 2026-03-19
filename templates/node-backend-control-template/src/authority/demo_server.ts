import { startNodeAuthorityServer } from "./server.js";

function readEnvNumber(
  value: string | undefined,
  fallback: number
): number {
  if (!value) {
    return fallback;
  }

  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
}

const host = process.env.LEAFERGRAPH_NODE_AUTHORITY_HOST ?? "127.0.0.1";
const port = readEnvNumber(process.env.LEAFERGRAPH_NODE_AUTHORITY_PORT, 5502);

async function main(): Promise<void> {
  const server = await startNodeAuthorityServer({
    host,
    port,
    authorityName: "node-authority-demo"
  });

  const shutdown = async (): Promise<void> => {
    await server.close();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown();
  });
  process.on("SIGTERM", () => {
    void shutdown();
  });

  console.info(
    "[node-authority-demo]",
    `authority server listening on ${server.authorityUrl}`
  );
  console.info(
    "[node-authority-demo]",
    `health endpoint available at ${server.healthUrl}`
  );
}

main().catch((error: unknown) => {
  const reason =
    error instanceof Error ? error.stack || error.message : String(error);
  console.error("[node-authority-demo]", reason);
  process.exit(1);
});
