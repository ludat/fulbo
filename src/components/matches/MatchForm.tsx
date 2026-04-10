import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/postgrest";
import { AvailabilityHeatmap } from "../groups/AvailabilityHeatmap";
import { Button } from "../ui/Button";
import { FormField } from "../ui/FormField";
import { Input, Textarea } from "../ui/Input";

type Match = {
  id: string;
  group_id: string;
  location: string | null;
  starts_at: string;
  notes: string | null;
  player_quota: number | null;
};

function toDatetimeLocal(iso: string) {
  return iso.slice(0, 16);
}

export function MatchForm() {
  const { groupId, matchId } = useParams<{
    groupId: string;
    matchId: string;
  }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = Boolean(matchId);

  const { data: matches, isLoading } = useQuery({
    queryKey: ["matches", groupId, matchId],
    queryFn: () =>
      api<Match[]>("/matches", {
        params: { id: `eq.${matchId}`, deleted_at: "is.null" },
      }),
    enabled: isEdit,
  });

  const match = matches?.[0];

  const [location, setLocation] = useState<string | null>(null);
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [playerQuota, setPlayerQuota] = useState<string | null>(null);

  const effectiveStartsAt = startsAt ?? (match ? toDatetimeLocal(match.starts_at) : "");
  const effectiveLocation = location ?? match?.location ?? "";
  const effectiveNotes = notes ?? match?.notes ?? "";
  const effectivePlayerQuota = playerQuota ?? (match?.player_quota?.toString() ?? "10");

  const parsedDate = effectiveStartsAt ? new Date(effectiveStartsAt) : null;
  const selectedSlot = parsedDate
    ? {
        dayOfWeek: (parsedDate.getDay() + 6) % 7,
        slot: parsedDate.getHours() * 2 + (parsedDate.getMinutes() >= 30 ? 1 : 0),
      }
    : null;

  const mutation = useMutation({
    mutationFn: () => {
      const body = {
        location: effectiveLocation || null,
        starts_at: new Date(effectiveStartsAt).toISOString(),
        notes: effectiveNotes || null,
        player_quota: effectivePlayerQuota ? parseInt(effectivePlayerQuota) : null,
      };

      if (isEdit) {
        return api("/matches", {
          method: "PATCH",
          params: { id: `eq.${matchId}` },
          body,
        });
      }

      return api("/matches", {
        method: "POST",
        body: { ...body, group_id: groupId },
        headers: { Prefer: "return=representation" },
      });
    },
    onSuccess: () => {
      if (isEdit) {
        queryClient.invalidateQueries({
          queryKey: ["matches", groupId, matchId],
        });
      }
      queryClient.invalidateQueries({ queryKey: ["matches", groupId] });
      navigate(
        isEdit
          ? `/groups/${groupId}/matches/${matchId}`
          : `/groups/${groupId}`,
      );
    },
  });

  if (isEdit && isLoading)
    return (
      <div className="text-text-secondary p-8 text-center">Cargando...</div>
    );
  if (isEdit && !match)
    return <div className="text-danger text-sm">Partido no encontrado</div>;

  return (
    <div>
      <h1>{isEdit ? "Editar Partido" : "Programar Partido"}</h1>
      <form
        className="max-w-lg"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <FormField label="Fecha y Hora">
          <Input
            type="datetime-local"
            value={effectiveStartsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            required
          />
        </FormField>
        <FormField label="Lugar">
          <Input
            type="text"
            value={effectiveLocation}
            onChange={(e) => setLocation(e.target.value)}
          />
        </FormField>
        <FormField label="Jugadores buscados">
          <Input
            type="number"
            min="1"
            value={effectivePlayerQuota}
            onChange={(e) => setPlayerQuota(e.target.value)}
          />
        </FormField>
        <FormField label="Notas">
          <Textarea
            value={effectiveNotes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </FormField>
        <div className="mt-4 flex gap-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending
              ? isEdit
                ? "Guardando..."
                : "Creando..."
              : isEdit
                ? "Guardar"
                : "Programar"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              navigate(
                isEdit
                  ? `/groups/${groupId}/matches/${matchId}`
                  : `/groups/${groupId}`,
              )
            }
          >
            Cancelar
          </Button>
        </div>
        {mutation.isError && (
          <p className="text-danger text-sm">{mutation.error.message}</p>
        )}
      </form>

      {groupId && (
        <div className="mt-8">
          <h2 className="mb-2 text-lg font-semibold">
            Disponibilidad del grupo
          </h2>
          <AvailabilityHeatmap
            groupId={groupId}
            greenThreshold={parseInt(effectivePlayerQuota) || 10}
            referenceDate={parsedDate ?? undefined}
            selectedSlot={selectedSlot}
            onSlotClick={(_dayOfWeek, slot, date) => {
              const hours = Math.floor(slot / 2);
              const minutes = slot % 2 === 0 ? 0 : 30;
              const pad = (n: number) => String(n).padStart(2, "0");
              const value = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(hours)}:${pad(minutes)}`;
              setStartsAt(value);
            }}
            onWeekChange={(delta) => {
              const pad = (n: number) => String(n).padStart(2, "0");
              const base = parsedDate ?? new Date();
              const shifted = new Date(base);
              shifted.setDate(shifted.getDate() + delta * 7);
              const value = `${shifted.getFullYear()}-${pad(shifted.getMonth() + 1)}-${pad(shifted.getDate())}T${pad(shifted.getHours())}:${pad(shifted.getMinutes())}`;
              setStartsAt(value);
            }}
          />
        </div>
      )}
    </div>
  );
}
