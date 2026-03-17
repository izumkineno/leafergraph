import { spawn } from "node:child_process";
import readline from "node:readline";
import {
  createTransportRemoteAuthorityClient,
  type EditorRemoteAuthorityDocumentClient,
  type EditorRemoteAuthorityTransport,
  type EditorRemoteAuthorityTransportEvent,
  type EditorRemoteAuthorityTransportRequest,
  type EditorRemoteAuthorityTransportResponse
} from "./graph_document_authority_transport";
import type {
  EditorRemoteAuthorityInboundEnvelope,
  EditorRemoteAuthorityRequestEnvelope
} from "./graph_document_authority_protocol";

interface PendingRequestEntry {
  resolve: (response: EditorRemoteAuthorityTransportResponse) => void;
  reject: (error: Error) => void;
}

/** Node 子进程 transport 的最小创建参数。 */
export interface CreateNodeProcessRemoteAuthorityTransportOptions {
  command?: string;
  args: readonly string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function formatProcessFailureReason(options: {
  message: string;
  stderrLines: readonly string[];
}): string {
  const stderr = options.stderrLines.join("\n").trim();
  return stderr ? `${options.message}\n${stderr}` : options.message;
}

/**
 * 基于 Node 子进程创建 authority transport。
 *
 * @remarks
 * 这层当前主要用于本地后端 demo 和测试夹具，
 * 让 editor 可以先在不写死浏览器传输协议的前提下验证 authority 流程。
 */
export function createNodeProcessRemoteAuthorityTransport(
  options: CreateNodeProcessRemoteAuthorityTransportOptions
): EditorRemoteAuthorityTransport {
  const child = spawn(options.command ?? process.env.NODE_BINARY ?? "node", [
    ...options.args
  ], {
    cwd: options.cwd,
    env: options.env,
    stdio: ["pipe", "pipe", "pipe"]
  });
  const stdoutReader = readline.createInterface({
    input: child.stdout
  });
  const stderrReader = readline.createInterface({
    input: child.stderr
  });
  const listeners = new Set<
    (event: EditorRemoteAuthorityTransportEvent) => void
  >();
  const pendingRequests = new Map<string, PendingRequestEntry>();
  const stderrLines: string[] = [];
  let requestSequence = 0;
  let disposed = false;

  const rejectPendingRequests = (reason: string): void => {
    const error = new Error(reason);
    for (const pendingRequest of pendingRequests.values()) {
      pendingRequest.reject(error);
    }
    pendingRequests.clear();
  };

  const disposeReaders = (): void => {
    stdoutReader.close();
    stderrReader.close();
  };

  const disposeProcess = (): void => {
    if (disposed) {
      return;
    }

    disposed = true;
    disposeReaders();
    listeners.clear();
    rejectPendingRequests("authority transport 已释放");

    if (!child.killed) {
      child.kill();
    }
  };

  const handleInboundEnvelope = (
    envelope: EditorRemoteAuthorityInboundEnvelope
  ): void => {
    switch (envelope.channel) {
      case "authority.event":
        for (const listener of listeners) {
          listener(structuredClone(envelope.event));
        }
        return;
      case "authority.response": {
        const pendingRequest = pendingRequests.get(envelope.requestId);
        if (!pendingRequest) {
          return;
        }

        pendingRequests.delete(envelope.requestId);
        if (envelope.ok) {
          pendingRequest.resolve(structuredClone(envelope.response));
          return;
        }

        pendingRequest.reject(new Error(envelope.error || "authority 请求失败"));
      }
    }
  };

  stdoutReader.on("line", (line) => {
    if (disposed || !line.trim()) {
      return;
    }

    try {
      const parsed = JSON.parse(line) as unknown;
      if (!isRecord(parsed) || typeof parsed.channel !== "string") {
        throw new Error("authority 返回了非法消息");
      }

      handleInboundEnvelope(
        parsed as unknown as EditorRemoteAuthorityInboundEnvelope
      );
    } catch (error) {
      const reason =
        error instanceof Error && error.message
          ? error.message
          : "authority 返回了无法解析的消息";
      rejectPendingRequests(
        formatProcessFailureReason({
          message: reason,
          stderrLines
        })
      );
    }
  });

  stderrReader.on("line", (line) => {
    if (!line.trim()) {
      return;
    }

    stderrLines.push(line);
    if (stderrLines.length > 20) {
      stderrLines.shift();
    }
  });

  child.on("error", (error) => {
    if (disposed) {
      return;
    }

    rejectPendingRequests(
      formatProcessFailureReason({
        message: error.message || "authority 进程启动失败",
        stderrLines
      })
    );
  });

  child.on("exit", (code, signal) => {
    if (disposed) {
      return;
    }

    disposed = true;
    disposeReaders();
    listeners.clear();
    rejectPendingRequests(
      formatProcessFailureReason({
        message:
          signal !== null
            ? `authority 进程已退出，signal=${signal}`
            : `authority 进程已退出，code=${code ?? "unknown"}`,
        stderrLines
      })
    );
  });

  return {
    request<TResponse extends EditorRemoteAuthorityTransportResponse>(
      request: EditorRemoteAuthorityTransportRequest
    ): Promise<TResponse> {
      if (disposed) {
        return Promise.reject(new Error("authority transport 已释放"));
      }

      const requestId = `node-process-request-${requestSequence += 1}`;
      const message: EditorRemoteAuthorityRequestEnvelope = {
        channel: "authority.request",
        requestId,
        request: structuredClone(request)
      };

      return new Promise<TResponse>((resolve, reject) => {
        pendingRequests.set(requestId, {
          resolve: resolve as PendingRequestEntry["resolve"],
          reject
        });

        try {
          child.stdin.write(`${JSON.stringify(message)}\n`);
        } catch (error) {
          pendingRequests.delete(requestId);
          reject(
            error instanceof Error
              ? error
              : new Error("authority 请求写入失败")
          );
        }
      });
    },

    subscribe(
      listener: (event: EditorRemoteAuthorityTransportEvent) => void
    ): () => void {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },

    dispose(): void {
      disposeProcess();
    }
  };
}

/** 基于 Node 子进程创建 authority client。 */
export function createNodeProcessRemoteAuthorityClient(
  options: CreateNodeProcessRemoteAuthorityTransportOptions
): EditorRemoteAuthorityDocumentClient {
  return createTransportRemoteAuthorityClient({
    transport: createNodeProcessRemoteAuthorityTransport(options)
  });
}
