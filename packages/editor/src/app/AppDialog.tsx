import type { ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";

export type AppDialogSize = "md" | "lg" | "xl" | "sheet" | "fullscreen";

export interface AppDialogProps {
  open: boolean;
  title: string;
  description?: string;
  size?: AppDialogSize;
  actions?: ComponentChildren;
  children: ComponentChildren;
  onClose(): void;
}

/**
 * editor 通用 dialog 抽象。
 *
 * @remarks
 * 当前统一基于原生 `<dialog>`，让设置面板、运行控制台和窄屏抽屉共享同一套
 * 焦点、ESC 关闭和遮罩关闭行为。
 */
export function AppDialog({
  open,
  title,
  description,
  size = "lg",
  actions,
  children,
  onClose
}: AppDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (open) {
      if (!dialog.open) {
        const activeElement = dialog.ownerDocument.activeElement;
        returnFocusRef.current =
          activeElement instanceof HTMLElement ? activeElement : null;
        dialog.showModal();
      }
      return;
    }

    if (dialog.open) {
      dialog.close();
      returnFocusRef.current?.focus();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      class="app-dialog"
      data-size={size}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) {
          onClose();
        }
      }}
    >
      <div class="app-dialog__surface">
        <header class="app-dialog__header">
          <div class="app-dialog__titleblock">
            <p class="app-dialog__eyebrow">Workspace</p>
            <h2>{title}</h2>
            {description ? (
              <p class="app-dialog__description">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            class="app-dialog__close"
            aria-label="关闭对话框"
            onClick={() => {
              onClose();
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M6 6L18 18M18 6L6 18"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
              />
            </svg>
          </button>
        </header>
        <div class="app-dialog__body">{children}</div>
        {actions ? <footer class="app-dialog__footer">{actions}</footer> : null}
      </div>
    </dialog>
  );
}
