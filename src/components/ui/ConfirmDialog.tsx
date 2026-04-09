import { Button } from "./Button";

type ConfirmDialogProps = {
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  disabled?: boolean;
};

export function ConfirmDialog({
  message,
  confirmLabel = "Confirmar",
  onConfirm,
  onCancel,
  disabled,
}: ConfirmDialogProps) {
  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-black/40"
      onClick={onCancel}
    >
      <div
        className="bg-surface w-full max-w-sm rounded-lg p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-5">{message}</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={disabled}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
