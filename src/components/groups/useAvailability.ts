import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../../api/postgrest";

type SlotRow = { day_of_week: number; time_slot: number };

function toKey(day: number, slot: number) {
  return `${day}:${slot}`;
}

export function useAvailability(groupId: string, playerId: string | undefined) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Set<string>>(new Set());

  const queryKey = ["weekly_availability", groupId, playerId];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      api<SlotRow[]>("/weekly_availability", {
        params: {
          group_id: `eq.${groupId}`,
          player_id: `eq.${playerId}`,
          select: "day_of_week,time_slot",
        },
      }),
    enabled: !!playerId,
  });

  useEffect(() => {
    if (data) {
      setSelected(new Set(data.map((r) => toKey(r.day_of_week, r.time_slot))));
    }
  }, [data]);

  const doAdd = useCallback(
    (slots: SlotRow[]) => {
      const keys = slots.map((s) => toKey(s.day_of_week, s.time_slot));
      setPending((prev) => {
        const next = new Set(prev);
        for (const k of keys) next.add(k);
        return next;
      });
      api("/weekly_availability", {
        method: "POST",
        body: slots.map((s) => ({
          group_id: groupId,
          player_id: playerId,
          ...s,
        })),
      }).finally(() => {
        setPending((prev) => {
          const next = new Set(prev);
          for (const k of keys) next.delete(k);
          return next;
        });
      });
    },
    [groupId, playerId],
  );

  const doRemove = useCallback(
    (slots: SlotRow[], params: Record<string, string>) => {
      const keys = slots.map((s) => toKey(s.day_of_week, s.time_slot));
      setPending((prev) => {
        const next = new Set(prev);
        for (const k of keys) next.add(k);
        return next;
      });
      api("/weekly_availability", {
        method: "DELETE",
        params: {
          group_id: `eq.${groupId}`,
          player_id: `eq.${playerId}`,
          ...params,
        },
      }).finally(() => {
        setPending((prev) => {
          const next = new Set(prev);
          for (const k of keys) next.delete(k);
          return next;
        });
      });
    },
    [groupId, playerId],
  );

  // Buffer for drag operations — accumulates cells, flushed on commitDrag
  const dragBuffer = useRef<SlotRow[]>([]);
  const dragPaintMode = useRef(true);

  const startDrag = useCallback(
    (day: number, slot: number) => {
      const key = toKey(day, slot);
      const painting = !selected.has(key);
      dragPaintMode.current = painting;
      dragBuffer.current = [{ day_of_week: day, time_slot: slot }];
      setSelected((prev) => {
        const next = new Set(prev);
        if (painting) next.add(key);
        else next.delete(key);
        return next;
      });
    },
    [selected],
  );

  const continueDrag = useCallback(
    (day: number, slot: number) => {
      const key = toKey(day, slot);
      const on = dragPaintMode.current;
      if (on === selected.has(key)) return;
      dragBuffer.current.push({ day_of_week: day, time_slot: slot });
      setSelected((prev) => {
        const next = new Set(prev);
        if (on) next.add(key);
        else next.delete(key);
        return next;
      });
    },
    [selected],
  );

  const commitDrag = useCallback(() => {
    const slots = dragBuffer.current;
    if (slots.length === 0) return;
    dragBuffer.current = [];
    if (dragPaintMode.current) {
      doAdd(slots);
    } else {
      const orConditions = slots
        .map(
          (s) =>
            `and(day_of_week.eq.${s.day_of_week},time_slot.eq.${s.time_slot})`,
        )
        .join(",");
      doRemove(slots, { or: `(${orConditions})` });
    }
  }, [doAdd, doRemove]);

  const toggleDay = useCallback(
    (day: number, slots: number[]) => {
      const allOn = slots.every((s) => selected.has(toKey(day, s)));
      const slotRows = slots.map((s) => ({ day_of_week: day, time_slot: s }));
      if (allOn) {
        setSelected((prev) => {
          const next = new Set(prev);
          for (const s of slots) next.delete(toKey(day, s));
          return next;
        });
        doRemove(slotRows, { day_of_week: `eq.${day}` });
      } else {
        const toAdd = slots.filter((s) => !selected.has(toKey(day, s)));
        setSelected((prev) => {
          const next = new Set(prev);
          for (const s of slots) next.add(toKey(day, s));
          return next;
        });
        doAdd(toAdd.map((s) => ({ day_of_week: day, time_slot: s })));
      }
    },
    [selected, doAdd, doRemove],
  );

  return {
    selected,
    pending,
    isLoading,
    startDrag,
    continueDrag,
    commitDrag,
    toggleDay,
  };
}
