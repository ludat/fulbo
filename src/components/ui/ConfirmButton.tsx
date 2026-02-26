import { useState } from "react";

type ConfirmButtonProps = {
  onConfirm: () => void;
  disabled?: boolean;
  label: string;
  confirmLabel?: string;
};

export function ConfirmButton({
  onConfirm,
  disabled,
  label,
  confirmLabel = "Sí, eliminar",
}: ConfirmButtonProps) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <span>¿Seguro?</span>
        <button
          className="btn btn-danger btn-sm"
          onClick={() => {
            setConfirming(false);
            onConfirm();
          }}
          disabled={disabled}
        >
          {confirmLabel}
        </button>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setConfirming(false)}
        >
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <button
      className="btn btn-danger"
      onClick={() => setConfirming(true)}
      disabled={disabled}
    >
      {label}
    </button>
  );
}
