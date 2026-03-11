import { useState } from "react";
import { faro } from "../faro";

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
    <div className="feedback-widget">
      {open ? (
        <div className="feedback-panel">
          {sent ? (
            <p className="feedback-thanks">Gracias por tu feedback!</p>
          ) : (
            <>
              <div className="feedback-header">
                <span>Enviar feedback</span>
                <button
                  className="feedback-close"
                  onClick={() => setOpen(false)}
                >
                  &times;
                </button>
              </div>
              <textarea
                className="feedback-textarea"
                placeholder="Contanos que te parece..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                autoFocus
              />
              <button
                className="btn btn-primary btn-sm"
                onClick={handleSubmit}
                disabled={!message.trim()}
              >
                Enviar
              </button>
            </>
          )}
        </div>
      ) : (
        <button
          className="feedback-trigger btn btn-primary"
          onClick={() => setOpen(true)}
        >
          Feedback
        </button>
      )}
    </div>
  );
}
