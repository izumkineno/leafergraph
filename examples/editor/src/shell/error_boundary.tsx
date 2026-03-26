/**
 * editor 错误边界组件模块。
 *
 * @remarks
 * 负责在壳层级别兜底渲染错误，避免单个 UI 区域异常直接让整个编辑器白屏。
 */
import { Component, type ComponentChildren } from "preact";

export interface EditorErrorFallbackProps {
  error: Error;
  onReload?(): void;
}

export interface EditorErrorBoundaryProps {
  children?: ComponentChildren;
  onReload?(): void;
}

interface EditorErrorBoundaryState {
  error: Error | null;
}

/** editor 根级错误回退视图。 */
export function EditorErrorFallback({
  error,
  onReload
}: EditorErrorFallbackProps) {
  return (
    <div
      class="app-shell"
      data-theme="dark"
      data-adaptive="wide-desktop"
      data-left-open="false"
      data-right-open="false"
      data-stage-layout="single"
    >
      <main class="workspace-stage" id="editor-main-canvas" tabIndex={-1}>
        <div class="workspace-stage__empty">
          <div class="workspace-stage__empty-card">
            <p class="workspace-pane__eyebrow">Editor Fallback</p>
            <h2>Editor 发生未捕获错误</h2>
            <p>
              当前编辑器未能完成启动。你可以先重新加载页面；如果问题持续存在，
              请把下面的错误详情和复现步骤一起记录下来。
            </p>
            <pre class="inspector-code">{error.stack ?? error.message}</pre>
            <div class="workspace-stage__empty-actions">
              <button
                type="button"
                class="workspace-primary-button"
                onClick={() => {
                  onReload?.();
                }}
              >
                重新加载编辑器
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

/** editor 根级错误边界。 */
export class EditorErrorBoundary extends Component<
  EditorErrorBoundaryProps,
  EditorErrorBoundaryState
> {
  override state: EditorErrorBoundaryState = {
    error: null
  };

  static override getDerivedStateFromError(
    error: unknown
  ): EditorErrorBoundaryState {
    return {
      error: error instanceof Error ? error : new Error(String(error))
    };
  }

  override componentDidCatch(error: Error): void {
    console.error("EditorErrorBoundary 捕获到未处理错误", error);
  }

  private readonly handleReload = (): void => {
    if (this.props.onReload) {
      this.props.onReload();
      return;
    }

    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  override render(
    props: EditorErrorBoundaryProps,
    state: EditorErrorBoundaryState
  ) {
    if (state.error) {
      return (
        <EditorErrorFallback
          error={state.error}
          onReload={this.handleReload}
        />
      );
    }

    return props.children ?? null;
  }
}
