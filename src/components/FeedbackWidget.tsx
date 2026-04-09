import { useState } from "react";
import { faro } from "../faro";
import { Button } from "./ui/Button";
import { Textarea } from "./ui/Input";

export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  if (!faro) return null;

  function handleSubmit() {
    if (!message.trim()) return;
    faro!.api.pushLog([message.trim()], { context: { source: "feedback" } });
    setMessage("");
    setSent(true);
    setTimeout(() => {
      setSent(false);
      setOpen(false);
    }, 2000);
  }

  return (
    <div className="fixed right-6 bottom-6 z-200">
      {open ? (
        <div className="bg-surface border-border flex w-72 flex-col gap-2 rounded-lg border p-4 shadow-xl">
          {sent ? (
            <p className="text-primary py-4 text-center font-medium">
              Gracias por tu feedback!
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between text-base font-semibold">
                <span>Enviar feedback</span>
                <button
                  className="text-text-secondary cursor-pointer border-none bg-transparent text-xl leading-none"
                  onClick={() => setOpen(false)}
                >
                  &times;
                </button>
              </div>
              <Textarea
                placeholder="Contanos que te parece..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                className="resize-y"
                autoFocus
              />
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={!message.trim()}
              >
                Enviar
              </Button>
            </>
          )}
        </div>
      ) : (
        <Button
          className="rounded-full shadow-md"
          onClick={() => setOpen(true)}
        >
          Feedback
        </Button>
      )}
    </div>
  );
}
