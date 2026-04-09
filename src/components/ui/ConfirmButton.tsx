import { useState } from "react";
import { Button } from "./Button";

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
      <div className="flex items-center gap-2">
        <span>¿Seguro?</span>
        <Button
          variant="danger"
          size="sm"
          onClick={() => {
            setConfirming(false);
            onConfirm();
          }}
          disabled={disabled}
        >
          {confirmLabel}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setConfirming(false)}
        >
          Cancelar
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="danger"
      onClick={() => setConfirming(true)}
      disabled={disabled}
    >
      {label}
    </Button>
  );
}
