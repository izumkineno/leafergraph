import { describe, expect, test } from "bun:test";

import { resolveRemoteRuntimeControlNotice } from "../src/ui/viewport/runtime_control_notice";

describe("resolveRemoteRuntimeControlNotice", () => {
  test("远端运行成功且状态变化时应清空提示", () => {
    expect(
      resolveRemoteRuntimeControlNotice({
        request: { type: "graph.step" },
        result: {
          accepted: true,
          changed: true,
          state: {
            status: "idle",
            queueSize: 0,
            stepCount: 1
          }
        }
      })
    ).toBeNull();
  });

  test("authority 返回 no-op 时应保留可见提示", () => {
    expect(
      resolveRemoteRuntimeControlNotice({
        request: { type: "graph.step" },
        result: {
          accepted: true,
          changed: false,
          reason: "图中没有可执行节点"
        }
      })
    ).toEqual({
      tone: "info",
      message: "图单步没有新的状态变化：图中没有可执行节点"
    });
  });

  test("authority 拒绝请求时应返回错误提示", () => {
    expect(
      resolveRemoteRuntimeControlNotice({
        request: { type: "node.play", nodeId: "node-1" },
        result: {
          accepted: false,
          changed: false,
          reason: "节点不存在"
        }
      })
    ).toEqual({
      tone: "error",
      message: "节点运行被 authority 拒绝：节点不存在"
    });
  });

  test("transport 异常时应返回错误提示", () => {
    expect(
      resolveRemoteRuntimeControlNotice({
        request: { type: "graph.play" },
        error: new Error("WebSocket closed")
      })
    ).toEqual({
      tone: "error",
      message: "图运行请求失败：WebSocket closed"
    });
  });
});
