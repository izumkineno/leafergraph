import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";

export interface StartedPythonAuthorityServer {
  authorityOrigin: string;
  child: ChildProcessWithoutNullStreams;
  stdoutChunks: string[];
  stderrChunks: string[];
  stop(): Promise<void>;
}

function getWorkspaceRoot(): string {
  return fileURLToPath(new URL("../../../../../", import.meta.url));
}

export async function resolveFreePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("无法解析空闲端口");
  }
  const port = address.port;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
  return port;
}

export function resolveHealthUrl(authorityOrigin: string): string {
  return authorityOrigin.replace("://localhost:", "://127.0.0.1:") + "/health";
}

async function waitForChildExit(
  child: ChildProcessWithoutNullStreams
): Promise<void> {
  if (child.exitCode !== null) {
    return;
  }

  await new Promise<void>((resolve) => {
    child.once("exit", () => {
      resolve();
    });
  });
}

async function waitForHealth(
  authorityOrigin: string,
  child: ChildProcessWithoutNullStreams,
  stdoutChunks: readonly string[],
  stderrChunks: readonly string[],
  timeoutMs = 60000
): Promise<void> {
  const startedAt = Date.now();
  let lastError: unknown = null;
  const healthUrl = resolveHealthUrl(authorityOrigin);

  while (Date.now() - startedAt < timeoutMs) {
    if (child.exitCode !== null) {
      throw new Error(
        `Python authority server 提前退出：exit=${child.exitCode}\nstdout:\n${stdoutChunks.join("")}\nstderr:\n${stderrChunks.join("")}`
      );
    }

    try {
      const response = await fetch(healthUrl, {
        method: "GET",
        cache: "no-store"
      });
      if (response.ok) {
        return;
      }
      lastError = new Error(`health ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(
    lastError instanceof Error
      ? `Python authority server 未在预期时间内就绪：${lastError.message}\nstdout:\n${stdoutChunks.join("")}\nstderr:\n${stderrChunks.join("")}`
      : "Python authority server 未在预期时间内就绪"
  );
}

export async function startPythonAuthorityServer(): Promise<StartedPythonAuthorityServer> {
  const port = await resolveFreePort();
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  const child = spawn(
    process.env.UV_BINARY ?? "uv",
    [
      "run",
      "--project",
      "templates/backend/python-openrpc-authority-template",
      "python",
      "-m",
      "leafergraph_python_openrpc_authority_template.entry"
    ],
    {
      cwd: getWorkspaceRoot(),
      env: {
        ...process.env,
        LEAFERGRAPH_PYTHON_OPENRPC_BACKEND_HOST: "127.0.0.1",
        LEAFERGRAPH_PYTHON_OPENRPC_BACKEND_PORT: String(port)
      },
      stdio: ["ignore", "pipe", "pipe"]
    }
  );

  child.stdout.on("data", (chunk) => {
    stdoutChunks.push(String(chunk));
  });
  child.stderr.on("data", (chunk) => {
    stderrChunks.push(String(chunk));
  });

  const authorityOrigin = `http://localhost:${port}`;
  await waitForHealth(authorityOrigin, child, stdoutChunks, stderrChunks);

  return {
    authorityOrigin,
    child,
    stdoutChunks,
    stderrChunks,
    async stop() {
      if (child.exitCode === null) {
        child.kill();
      }
      await waitForChildExit(child);
    }
  };
}
