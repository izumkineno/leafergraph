import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const JSON_RPC_VERSION = "2.0";
const JSON_RPC_ERROR_CODES = {
  parseError: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602
};
const fixtureDir = dirname(fileURLToPath(import.meta.url));
const openRpcDocument = JSON.parse(
  readFileSync(
    resolve(
      fixtureDir,
      "../../../../templates/backend/shared/openrpc/authority.openrpc.json"
    ),
    "utf8"
  )
);

let currentDocument = {
  documentId: "demo-backend-doc",
  revision: "1",
  appKind: "demo-backend",
  nodes: [
    {
      id: "node-1",
      type: "test/remote-node",
      title: "Node 1",
      layout: {
        x: 0,
        y: 0,
        width: 240,
        height: 140
      },
      flags: {},
      properties: {},
      propertySpecs: [],
      inputs: [],
      outputs: [],
      widgets: [],
      data: {}
    },
    {
      id: "node-2",
      type: "test/remote-node",
      title: "Node 2",
      layout: {
        x: 320,
        y: 0,
        width: 240,
        height: 140
      },
      flags: {},
      properties: {},
      propertySpecs: [],
      inputs: [],
      outputs: [],
      widgets: [],
      data: {}
    }
  ],
  links: [
    {
      id: "link-1",
      source: {
        nodeId: "node-1",
        slot: 0
      },
      target: {
        nodeId: "node-2",
        slot: 0
      }
    }
  ],
  meta: {}
};
const nodeRunCountMap = new Map();

function clone(value) {
  return structuredClone(value);
}

function nextRevision(revision) {
  const numericRevision = Number(revision);
  if (Number.isFinite(numericRevision)) {
    return String(numericRevision + 1);
  }

  return `${revision}#1`;
}

function writeMessage(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function respondSuccess(requestId, response) {
  writeMessage({
    jsonrpc: JSON_RPC_VERSION,
    id: requestId,
    result: response
  });
}

function respondError(requestId, code, error) {
  writeMessage({
    jsonrpc: JSON_RPC_VERSION,
    id: requestId,
    error: {
      code,
      message: error
    }
  });
}

function emitRuntimeFeedback(event) {
  writeMessage({
    jsonrpc: JSON_RPC_VERSION,
    method: "authority.runtimeFeedback",
    params: event
  });
}

function emitDocument(document) {
  writeMessage({
    jsonrpc: JSON_RPC_VERSION,
    method: "authority.document",
    params: clone(document)
  });
}

function getNode(nodeId) {
  return currentDocument.nodes.find((node) => node.id === nodeId) ?? null;
}

function nextNodeRunCount(nodeId) {
  const nextRunCount = (nodeRunCountMap.get(nodeId) ?? 0) + 1;
  nodeRunCountMap.set(nodeId, nextRunCount);
  return nextRunCount;
}

function emitNodeExecution(nodeId, requestId) {
  const node = getNode(nodeId);
  if (!node) {
    return;
  }

  const timestamp = Date.now();
  const runCount = nextNodeRunCount(nodeId);
  emitRuntimeFeedback({
    type: "node.execution",
    event: {
      chainId: `authority:${requestId}:${nodeId}`,
      rootNodeId: node.id,
      rootNodeType: node.type,
      rootNodeTitle: node.title ?? node.id,
      nodeId: node.id,
      nodeType: node.type,
      nodeTitle: node.title ?? node.id,
      depth: 0,
      sequence: 0,
      source: "node-play",
      trigger: "direct",
      timestamp,
      executionContext: {
        source: "node-play",
        entryNodeId: node.id,
        stepIndex: 0,
        startedAt: timestamp,
        payload: {
          authority: "demo-backend"
        }
      },
      state: {
        status: "success",
        runCount,
        lastExecutedAt: timestamp,
        lastSucceededAt: timestamp
      }
    }
  });
}

function emitNodeState(nodeId, reason, exists) {
  emitRuntimeFeedback({
    type: "node.state",
    event: {
      nodeId,
      exists,
      reason,
      timestamp: Date.now()
    }
  });
}

function emitLinkPropagation(link, requestId) {
  emitRuntimeFeedback({
    type: "link.propagation",
    event: {
      linkId: link.id,
      chainId: `authority:${requestId}:${link.id}`,
      sourceNodeId: link.source.nodeId,
      sourceSlot: link.source.slot,
      targetNodeId: link.target.nodeId,
      targetSlot: link.target.slot,
      payload: {
        authority: "demo-backend"
      },
      timestamp: Date.now()
    }
  });
}

function createNodeFromInput(input) {
  return {
    id: input.id,
    type: input.type,
    title: input.title ?? input.type,
    layout: {
      x: input.x,
      y: input.y,
      width: input.width ?? 240,
      height: input.height ?? 140
    },
    flags: {},
    properties: clone(input.properties ?? {}),
    propertySpecs: clone(input.propertySpecs ?? []),
    inputs: clone(input.inputs ?? []),
    outputs: clone(input.outputs ?? []),
    widgets: clone(input.widgets ?? []),
    data: clone(input.data ?? {})
  };
}

function emitOperationFeedback(operation, requestId, result) {
  if (!result.accepted || !result.changed) {
    return;
  }

  switch (operation.type) {
    case "node.create":
      emitNodeState(operation.input.id, "created", true);
      emitNodeExecution(operation.input.id, requestId);
      return;
    case "node.update":
      emitNodeState(operation.nodeId, "updated", true);
      emitNodeExecution(operation.nodeId, requestId);
      return;
    case "node.move":
      emitNodeState(operation.nodeId, "moved", true);
      return;
    case "node.resize":
      emitNodeState(operation.nodeId, "resized", true);
      emitNodeExecution(operation.nodeId, requestId);
      return;
    case "node.remove":
      emitNodeState(operation.nodeId, "removed", false);
      return;
    case "link.create": {
      const nextLink = currentDocument.links.find(
        (link) => link.id === operation.input.id
      );
      if (!nextLink) {
        return;
      }

      emitNodeState(nextLink.source.nodeId, "connections", true);
      emitNodeState(nextLink.target.nodeId, "connections", true);
      emitLinkPropagation(nextLink, requestId);
      return;
    }
    case "link.remove":
      return;
    case "link.reconnect": {
      const nextLink = currentDocument.links.find(
        (link) => link.id === operation.linkId
      );
      if (!nextLink) {
        return;
      }

      emitNodeState(nextLink.source.nodeId, "connections", true);
      emitNodeState(nextLink.target.nodeId, "connections", true);
      emitLinkPropagation(nextLink, requestId);
    }
  }
}

function applyOperation(operation) {
  switch (operation.type) {
    case "node.create": {
      const nextNode = createNodeFromInput(operation.input);
      currentDocument = {
        ...currentDocument,
        revision: nextRevision(currentDocument.revision),
        nodes: [
          ...currentDocument.nodes.filter((node) => node.id !== nextNode.id),
          nextNode
        ]
      };
      return {
        accepted: true,
        changed: true,
        revision: currentDocument.revision,
        document: clone(currentDocument)
      };
    }
    case "node.update": {
      const node = getNode(operation.nodeId);
      if (!node) {
        return {
          accepted: false,
          changed: false,
          reason: "节点不存在",
          revision: currentDocument.revision,
          document: clone(currentDocument)
        };
      }

      currentDocument = {
        ...currentDocument,
        revision: nextRevision(currentDocument.revision),
        nodes: currentDocument.nodes.map((item) =>
          item.id === operation.nodeId
            ? {
                ...item,
                title: operation.input.title ?? item.title,
                layout: {
                  ...item.layout,
                  x: operation.input.x ?? item.layout.x,
                  y: operation.input.y ?? item.layout.y,
                  width: operation.input.width ?? item.layout.width,
                  height: operation.input.height ?? item.layout.height
                },
                properties:
                  operation.input.properties !== undefined
                    ? clone(operation.input.properties)
                    : item.properties,
                propertySpecs:
                  operation.input.propertySpecs !== undefined
                    ? clone(operation.input.propertySpecs)
                    : item.propertySpecs,
                inputs:
                  operation.input.inputs !== undefined
                    ? clone(operation.input.inputs)
                    : item.inputs,
                outputs:
                  operation.input.outputs !== undefined
                    ? clone(operation.input.outputs)
                    : item.outputs,
                widgets:
                  operation.input.widgets !== undefined
                    ? clone(operation.input.widgets)
                    : item.widgets,
                data:
                  operation.input.data !== undefined
                    ? clone(operation.input.data)
                    : item.data
              }
            : item
        )
      };
      return {
        accepted: true,
        changed: true,
        revision: currentDocument.revision,
        document: clone(currentDocument)
      };
    }
    case "node.move": {
      const node = getNode(operation.nodeId);
      if (!node) {
        return {
          accepted: false,
          changed: false,
          reason: "节点不存在",
          revision: currentDocument.revision,
          document: clone(currentDocument)
        };
      }

      currentDocument = {
        ...currentDocument,
        revision: nextRevision(currentDocument.revision),
        nodes: currentDocument.nodes.map((item) =>
          item.id === operation.nodeId
            ? {
                ...item,
                layout: {
                  ...item.layout,
                  x: operation.input.x,
                  y: operation.input.y
                }
              }
            : item
        )
      };
      return {
        accepted: true,
        changed: true,
        revision: currentDocument.revision,
        document: clone(currentDocument)
      };
    }
    case "node.remove": {
      const existed = currentDocument.nodes.some(
        (node) => node.id === operation.nodeId
      );
      if (!existed) {
        return {
          accepted: true,
          changed: false,
          revision: currentDocument.revision,
          document: clone(currentDocument)
        };
      }

      currentDocument = {
        ...currentDocument,
        revision: nextRevision(currentDocument.revision),
        nodes: currentDocument.nodes.filter(
          (node) => node.id !== operation.nodeId
        ),
        links: currentDocument.links.filter(
          (link) =>
            link.source.nodeId !== operation.nodeId &&
            link.target.nodeId !== operation.nodeId
        )
      };
      return {
        accepted: true,
        changed: true,
        revision: currentDocument.revision,
        document: clone(currentDocument)
      };
    }
    case "node.resize": {
      const node = getNode(operation.nodeId);
      if (!node) {
        return {
          accepted: false,
          changed: false,
          reason: "节点不存在",
          revision: currentDocument.revision,
          document: clone(currentDocument)
        };
      }

      currentDocument = {
        ...currentDocument,
        revision: nextRevision(currentDocument.revision),
        nodes: currentDocument.nodes.map((item) =>
          item.id === operation.nodeId
            ? {
                ...item,
                layout: {
                  ...item.layout,
                  width: operation.input.width,
                  height: operation.input.height
                }
              }
            : item
        )
      };
      return {
        accepted: true,
        changed: true,
        revision: currentDocument.revision,
        document: clone(currentDocument)
      };
    }
    case "link.create": {
      const nextLink = clone(operation.input);
      currentDocument = {
        ...currentDocument,
        revision: nextRevision(currentDocument.revision),
        links: [
          ...currentDocument.links.filter((link) => link.id !== nextLink.id),
          nextLink
        ]
      };
      return {
        accepted: true,
        changed: true,
        revision: currentDocument.revision,
        document: clone(currentDocument)
      };
    }
    case "link.remove": {
      const existed = currentDocument.links.some(
        (link) => link.id === operation.linkId
      );
      currentDocument = {
        ...currentDocument,
        revision: existed
          ? nextRevision(currentDocument.revision)
          : currentDocument.revision,
        links: currentDocument.links.filter((link) => link.id !== operation.linkId)
      };
      return {
        accepted: true,
        changed: existed,
        revision: currentDocument.revision,
        document: clone(currentDocument)
      };
    }
    case "link.reconnect": {
      const link = currentDocument.links.find((item) => item.id === operation.linkId);
      if (!link) {
        return {
          accepted: false,
          changed: false,
          reason: "连线不存在",
          revision: currentDocument.revision,
          document: clone(currentDocument)
        };
      }

      currentDocument = {
        ...currentDocument,
        revision: nextRevision(currentDocument.revision),
        links: currentDocument.links.map((item) =>
          item.id === operation.linkId
            ? {
                ...item,
                source: operation.input.source ?? item.source,
                target: operation.input.target ?? item.target
              }
            : item
        )
      };
      return {
        accepted: true,
        changed: true,
        revision: currentDocument.revision,
        document: clone(currentDocument)
      };
    }
    default:
      return {
        accepted: false,
        changed: false,
        reason: `不支持的操作类型: ${operation.type}`,
        revision: currentDocument.revision,
        document: clone(currentDocument)
      };
  }
}

const reader = readline.createInterface({
  input: process.stdin
});

reader.on("line", (line) => {
  if (!line.trim()) {
    return;
  }

  let message;
  try {
    message = JSON.parse(line);
  } catch (error) {
    respondError(
      null,
      JSON_RPC_ERROR_CODES.parseError,
      error instanceof Error ? error.message : "无法解析请求消息"
    );
    return;
  }

  if (
    !message ||
    message.jsonrpc !== JSON_RPC_VERSION ||
    (typeof message.id !== "string" && typeof message.id !== "number") ||
    typeof message.method !== "string"
  ) {
    respondError(null, JSON_RPC_ERROR_CODES.invalidRequest, "非法 JSON-RPC request");
    return;
  }

  const requestId = message.id;
  const params =
    typeof message.params === "object" && message.params !== null
      ? message.params
      : {};

  switch (message.method) {
    case "rpc.discover":
      respondSuccess(requestId, clone(openRpcDocument));
      return;
    case "authority.getDocument":
      respondSuccess(requestId, clone(currentDocument));
      return;
    case "authority.replaceDocument":
      if (!("document" in params)) {
        respondError(
          requestId,
          JSON_RPC_ERROR_CODES.invalidParams,
          "replaceDocument params 非法"
        );
        return;
      }
      currentDocument = clone(params.document);
      emitDocument(currentDocument);
      respondSuccess(requestId, clone(currentDocument));
      return;
    case "authority.submitOperation": {
      if (!("operation" in params)) {
        respondError(
          requestId,
          JSON_RPC_ERROR_CODES.invalidParams,
          "submitOperation params 非法"
        );
        return;
      }
      const result = applyOperation(params.operation);
      if (result.accepted && result.document) {
        emitDocument(result.document);
      }
      respondSuccess(requestId, result);
      emitOperationFeedback(params.operation, requestId, result);
      return;
    }
    case "authority.controlRuntime":
      respondSuccess(requestId, {
        accepted: false,
        changed: false,
        reason: "demo backend 不支持运行控制"
      });
      return;
    default:
      respondError(
        requestId,
        JSON_RPC_ERROR_CODES.methodNotFound,
        `未知 method: ${message.method}`
      );
  }
});
