import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useCallback, useRef } from "react";
import { api } from "../../api/postgrest";

type SlotRow = { day_of_week: number; time_slot: number };

function toKey(day: number, slot: number) {
  return `${day}:${slot}`;
}

export function useAvailability(groupId: string, playerId: string | undefined) {
  const queryClient = useQueryClient();
  const [localOverrides, setLocalOverrides] = useState<Map<string, boolean>>(
    new Map(),
  );
  const [pending, setPending] = useState<Set<string>>(new Set());

  const queryKey = useMemo(
    () => ["weekly_availability", groupId, playerId],
    [groupId, playerId],
  );

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

  const serverSelected = useMemo(
    () => new Set(data?.map((r) => toKey(r.day_of_week, r.time_slot))),
    [data],
  );

  const selected = useMemo(() => {
    const result = new Set(serverSelected);
    for (const [key, on] of localOverrides) {
      if (on) result.add(key);
      else result.delete(key);
    }
    return result;
  }, [serverSelected, localOverrides]);

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
      })
        .then(() => {
          queryClient.invalidateQueries({
            queryKey: ["availability_summary", groupId],
          });
          queryClient.invalidateQueries({ queryKey });
        })
        .finally(() => {
          setLocalOverrides(new Map());
          setPending((prev) => {
            const next = new Set(prev);
            for (const k of keys) next.delete(k);
            return next;
          });
        });
    },
    [groupId, playerId, queryClient, queryKey],
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
      })
        .then(() => {
          queryClient.invalidateQueries({
            queryKey: ["availability_summary", groupId],
          });
          queryClient.invalidateQueries({ queryKey });
        })
        .finally(() => {
          setLocalOverrides(new Map());
          setPending((prev) => {
            const next = new Set(prev);
            for (const k of keys) next.delete(k);
            return next;
          });
        });
    },
    [groupId, playerId, queryClient, queryKey],
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
      setLocalOverrides((prev) => {
        const next = new Map(prev);
        next.set(key, painting);
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
      setLocalOverrides((prev) => {
        const next = new Map(prev);
        next.set(key, on);
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
        setLocalOverrides((prev) => {
          const next = new Map(prev);
          for (const s of slots) next.set(toKey(day, s), false);
          return next;
        });
        doRemove(slotRows, { day_of_week: `eq.${day}` });
      } else {
        const toAdd = slots.filter((s) => !selected.has(toKey(day, s)));
        setLocalOverrides((prev) => {
          const next = new Map(prev);
          for (const s of slots) next.set(toKey(day, s), true);
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
