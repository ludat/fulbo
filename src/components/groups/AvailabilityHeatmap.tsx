import clsx from "clsx";
import { useGroupAvailability } from "./useGroupAvailability";

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const START_SLOT = 18; // 9:00
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

/** Returns the Monday–Sunday dates for the week containing `ref`. */
function getWeekDates(ref: Date): Date[] {
  const jsDow = ref.getDay(); // 0=Sun..6=Sat
  const mondayOffset = jsDow === 0 ? -6 : 1 - jsDow;
  const monday = new Date(ref);
  monday.setDate(ref.getDate() + mondayOffset);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

type Props = {
  groupId: string;
  greenThreshold?: number;
  referenceDate?: Date;
  selectedSlot?: { dayOfWeek: number; slot: number } | null;
  onSlotClick?: (dayOfWeek: number, slot: number, date: Date) => void;
  onWeekChange?: (delta: number) => void;
};

export function AvailabilityHeatmap({ groupId, greenThreshold = 10, referenceDate, selectedSlot, onSlotClick, onWeekChange }: Props) {
  const { data, isLoading } = useGroupAvailability(groupId);
  const weekDates = getWeekDates(referenceDate ?? new Date());

  if (isLoading) {
    return (
      <div className="text-text-secondary p-8 text-center">Cargando...</div>
    );
  }

  const cellMap = new Map<string, { count: number; names: string[] }>();
  let maxCount = 0;
  for (const row of data ?? []) {
    const key = `${row.day_of_week}:${row.time_slot}`;
    cellMap.set(key, { count: row.player_count, names: row.player_names });
    if (row.player_count > maxCount) maxCount = row.player_count;
  }

  return (
    <div
      className="grid gap-px select-none"
      style={{
        gridTemplateColumns: "repeat(7, 1fr)",
      }}
    >
      {/* Explanation */}
      <p className="text-text-secondary col-span-7 mb-1 text-xs">
        Cada celda muestra cuántos jugadores están disponibles en ese horario.
      </p>

      {/* Week navigation */}
      {onWeekChange && (
        <div className="col-span-7 mb-1 flex items-center justify-between">
          <button
            type="button"
            className="text-text-secondary hover:text-text rounded px-2 py-1 text-sm"
            onClick={() => onWeekChange(-1)}
          >
            ← Semana anterior
          </button>
          <button
            type="button"
            className="text-text-secondary hover:text-text rounded px-2 py-1 text-sm"
            onClick={() => onWeekChange(1)}
          >
            Semana siguiente →
          </button>
        </div>
      )}

      {/* Header row */}
      {DAYS.map((day, i) => (
        <div
          key={day}
          className="text-text-secondary py-1 text-center text-sm"
        >
          <div className="font-bold">{day}</div>
          <div className="text-xs">
            {weekDates[i].getDate()}/{weekDates[i].getMonth() + 1}
          </div>
        </div>
      ))}

      {/* Time slot rows */}
      {SLOTS.map((slot) =>
        DAYS.map((_, dayIdx) => {
          const key = `${dayIdx}:${slot}`;
          const cell = cellMap.get(key);
          const count = cell?.count ?? 0;
          const names = cell?.names ?? [];
          const t = Math.min(count / greenThreshold, 1);
          const hue = t * 140;
          const isSelected = selectedSlot?.dayOfWeek === dayIdx && selectedSlot?.slot === slot;

          return (
            <div
              key={key}
              onClick={() => onSlotClick?.(dayIdx, slot, weekDates[dayIdx])}
              className={clsx(
                "group relative flex h-5 items-center justify-center rounded-sm border-2 text-xs",
                onSlotClick && "cursor-pointer",
                isSelected && "ring-2 ring-primary ring-offset-1",
              )}
              style={{
                borderColor:
                  count > 0
                    ? `oklch(0.65 0.15 ${hue} / 0.4)`
                    : "var(--color-border)",
                backgroundColor:
                  count > 0
                    ? `oklch(0.65 0.15 ${hue} / 0.25)`
                    : "var(--color-surface)",
              }}
            >
              {slotToTime(slot)}
              {count > 0 && (
                <span className="pointer-events-none absolute right-1 text-[10px] font-semibold">
                  {count}
                </span>
              )}
              {names.length > 0 && (
                <div className="bg-surface border-border pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded border px-2 py-1 text-xs whitespace-nowrap shadow-md group-hover:block">
                  {names.join(", ")}
                </div>
              )}
            </div>
          );
        }),
      )}
    </div>
  );
}
