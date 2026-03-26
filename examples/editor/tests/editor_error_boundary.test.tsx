import "./helpers/install_test_host_polyfills";

import { describe, expect, test } from "bun:test";
import { renderToString } from "preact-render-to-string";

import {
  EditorErrorBoundary,
  EditorErrorFallback
} from "../src/shell/error_boundary";

describe("EditorErrorBoundary", () => {
  test("getDerivedStateFromError 应收敛为 fallback state", () => {
    const error = new Error("forced theme failure");

    expect(EditorErrorBoundary.getDerivedStateFromError(error)).toEqual({
      error
    });
  });

  test("fallback 视图应暴露错误说明和重新加载按钮", () => {
    const html = renderToString(
      <EditorErrorFallback
        error={new Error("forced theme failure")}
        onReload={() => {}}
      />
    );

    expect(html).toContain("Editor 发生未捕获错误");
    expect(html).toContain("forced theme failure");
    expect(html).toContain("重新加载编辑器");
  });
});
