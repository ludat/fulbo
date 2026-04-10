import { useRef, useCallback, useEffect } from "react";
import clsx from "clsx";

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const START_SLOT = 32; // 16:00
const END_SLOT = 47; // 23:30
const SLOTS = Array.from(
  { length: END_SLOT - START_SLOT + 1 },
  (_, i) => START_SLOT + i,
);

function slotToTime(slot: number): string {
  const hours = Math.floor(slot / 2);
  const minutes = slot % 2 === 0 ? "00" : "30";
  return `${hours}:${minutes}`;
}

type Props = {
  selected: Set<string>;
  pending: Set<string>;
  onStartDrag: (day: number, slot: number) => void;
  onContinueDrag: (day: number, slot: number) => void;
  onCommitDrag: () => void;
  onToggleDay: (day: number, slots: number[]) => void;
};

export function AvailabilityGrid({
  selected,
  pending,
  onStartDrag,
  onContinueDrag,
  onCommitDrag,
  onToggleDay,
}: Props) {
  const dragging = useRef(false);

  const handlePointerDown = useCallback(
    (day: number, slot: number) => {
      dragging.current = true;
      onStartDrag(day, slot);
    },
    [onStartDrag],
  );

  const handlePointerEnter = useCallback(
    (day: number, slot: number) => {
      if (!dragging.current) return;
      onContinueDrag(day, slot);
    },
    [onContinueDrag],
  );

  useEffect(() => {
    const handleUp = () => {
      if (dragging.current) {
        dragging.current = false;
        onCommitDrag();
      }
    };
    document.addEventListener("pointerup", handleUp);
    return () => document.removeEventListener("pointerup", handleUp);
  }, [onCommitDrag]);

  return (
    <div
      className="grid gap-px select-none"
      style={{
        gridTemplateColumns: "repeat(7, 1fr)",
        touchAction: "none",
      }}
    >
      {/* Header row */}
      {DAYS.map((day, dayIdx) => {
        const allOn = SLOTS.every((slot) => selected.has(`${dayIdx}:${slot}`));
        return (
          <div
            key={day}
            className="text-text-secondary hover:text-text cursor-pointer py-1 text-center text-xs font-medium"
            onClick={() => onToggleDay(dayIdx, SLOTS)}
          >
            {day}
          </div>
        );
      })}

      {/* Time slot rows */}
      {SLOTS.map((slot) =>
        DAYS.map((_, dayIdx) => {
          const key = `${dayIdx}:${slot}`;
          const isOn = selected.has(key);
          const isPending = pending.has(key);
          return (
            <div
              key={key}
              className={clsx(
                "relative flex h-8 cursor-pointer items-center justify-center rounded-sm border text-xs transition-colors",
                isOn
                  ? "border-primary/30 bg-primary/20"
                  : "border-border bg-surface hover:bg-surface-hover text-text-secondary",
                isPending && "animate-pulse",
              )}
              onPointerDown={() => handlePointerDown(dayIdx, slot)}
              onPointerEnter={() => handlePointerEnter(dayIdx, slot)}
            >
              {slotToTime(slot)}
              {isPending && (
                <span className="pointer-events-none absolute right-0.5 text-xs text-gray-400">
                  &#8987;
                </span>
              )}
            </div>
          );
        }),
      )}
    </div>
  );
}
