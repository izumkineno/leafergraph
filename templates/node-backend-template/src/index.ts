import {
  startNodeAuthorityServer,
  type StartedNodeAuthorityServer,
  type StartNodeAuthorityServerOptions
} from "./transport/index.js";

export interface StartTemplateNodeBackendControlServerOptions
  extends Omit<StartNodeAuthorityServerOptions, "host" | "port" | "authorityName"> {
  host?: string;
  port?: number;
  authorityName?: string;
}

export function readEnvNumber(
  value: string | undefined,
  fallback: number
): number {
  if (!value) {
    return fallback;
  }

  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
}

export function resolveTemplateNodeBackendControlServerOptions(
  options: StartTemplateNodeBackendControlServerOptions = {}
): StartNodeAuthorityServerOptions {
  return {
    ...options,
    host: options.host ?? process.env.LEAFERGRAPH_NODE_BACKEND_HOST ?? "127.0.0.1",
    port:
      options.port ??
      readEnvNumber(process.env.LEAFERGRAPH_NODE_BACKEND_PORT, 5502),
    authorityName:
      options.authorityName ??
      process.env.LEAFERGRAPH_NODE_BACKEND_NAME ??
      "node-backend-template"
  };
}

export async function startTemplateNodeBackendControlServer(
  options: StartTemplateNodeBackendControlServerOptions = {}
): Promise<StartedNodeAuthorityServer> {
  return startNodeAuthorityServer(
    resolveTemplateNodeBackendControlServerOptions(options)
  );
}

export async function runTemplateNodeBackendControlServer(
  options: StartTemplateNodeBackendControlServerOptions = {}
): Promise<StartedNodeAuthorityServer> {
  const server = await startTemplateNodeBackendControlServer(options);

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
    "[node-backend-template]",
    `authority server listening on ${server.authorityUrl}`
  );
  console.info(
    "[node-backend-template]",
    `health endpoint available at ${server.healthUrl}`
  );

  return server;
}

export * from "./core/index.js";
export * from "./transport/index.js";
