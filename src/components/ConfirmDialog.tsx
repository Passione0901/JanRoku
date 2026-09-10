import { useEffect, useId, useRef, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

// 最終更新: 2026-09-10 — ネイティブdialogのフォーカス管理とEscape操作を利用する。
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="confirm-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <div className="dialog-icon">
        <AlertTriangle size={22} />
      </div>
      <h2 id={titleId}>{title}</h2>
      <div className="dialog-content">{children}</div>
      <div className="dialog-actions">
        <button
          className="button subtle"
          autoFocus
          disabled={busy}
          onClick={onCancel}
        >
          キャンセル
        </button>
        <button
          className={`button ${danger ? "danger" : "primary"}`}
          disabled={busy}
          onClick={onConfirm}
        >
          {busy ? "処理中…" : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
