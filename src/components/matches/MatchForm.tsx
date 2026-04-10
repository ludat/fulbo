import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/postgrest";
import { AvailabilityHeatmap } from "../groups/AvailabilityHeatmap";
import { Button } from "../ui/Button";
import { FormField } from "../ui/FormField";
import { Input, Textarea } from "../ui/Input";

export function MatchForm() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [location, setLocation] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [notes, setNotes] = useState("");
  const [playerQuota, setPlayerQuota] = useState("10");

  const selectedSlot = startsAt
    ? (() => {
        const d = new Date(startsAt);
        // JS: 0=Sun..6=Sat → heatmap: 0=Mon..6=Sun
        const dayOfWeek = (d.getDay() + 6) % 7;
        const slot = d.getHours() * 2 + (d.getMinutes() >= 30 ? 1 : 0);
        return { dayOfWeek, slot };
      })()
    : null;

  const createMatch = useMutation({
    mutationFn: () =>
      api("/matches", {
        method: "POST",
        body: {
          group_id: groupId,
          location: location || null,
          starts_at: new Date(startsAt).toISOString(),
          notes: notes || null,
          player_quota: playerQuota ? parseInt(playerQuota) : null,
        },
        headers: { Prefer: "return=representation" },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matches", groupId] });
      navigate(`/groups/${groupId}`);
    },
  });

  return (
    <div>
      <h1>Programar Partido</h1>
      <form
        className="max-w-lg"
        onSubmit={(e) => {
          e.preventDefault();
          createMatch.mutate();
        }}
      >
        <FormField label="Fecha y Hora">
          <Input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            required
          />
        </FormField>
        <FormField label="Lugar">
          <Input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </FormField>
        <FormField label="Jugadores buscados">
          <Input
            type="number"
            min="1"
            value={playerQuota}
            onChange={(e) => setPlayerQuota(e.target.value)}
          />
        </FormField>
        <FormField label="Notas">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </FormField>
        <div className="mt-4 flex gap-2">
          <Button type="submit" disabled={createMatch.isPending}>
            {createMatch.isPending ? "Creando..." : "Programar"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate(`/groups/${groupId}`)}
          >
            Cancelar
          </Button>
        </div>
        {createMatch.isError && (
          <p className="text-danger text-sm">{createMatch.error.message}</p>
        )}
      </form>

      {groupId && (
        <div className="mt-8">
          <h2 className="mb-2 text-lg font-semibold">
            Disponibilidad del grupo
          </h2>
          <AvailabilityHeatmap
            groupId={groupId}
            greenThreshold={parseInt(playerQuota) || 10}
            selectedSlot={selectedSlot}
            onSlotClick={(dayOfWeek, slot) => {
              // dayOfWeek: 0=Mon..6=Sun, JS Date: 0=Sun..6=Sat
              const jsDow = (dayOfWeek + 1) % 7;
              const now = new Date();
              const diff = (jsDow - now.getDay() + 7) % 7 || 7;
              const date = new Date(now);
              date.setDate(now.getDate() + diff);
              const hours = Math.floor(slot / 2);
              const minutes = slot % 2 === 0 ? 0 : 30;
              date.setHours(hours, minutes, 0, 0);
              const pad = (n: number) => String(n).padStart(2, "0");
              const value = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(hours)}:${pad(minutes)}`;
              setStartsAt(value);
            }}
          />
        </div>
      )}
    </div>
  );
}
