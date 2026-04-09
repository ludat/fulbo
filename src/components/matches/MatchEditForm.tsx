import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/postgrest";
import { Button } from "../ui/Button";
import { FormField } from "../ui/FormField";
import { Input, Textarea } from "../ui/Input";

type Match = {
  id: string;
  group_id: string;
  location: string | null;
  starts_at: string;
  notes: string | null;
};

function toDatetimeLocal(iso: string) {
  return iso.slice(0, 16);
}

export function MatchEditForm() {
  const { groupId, matchId } = useParams<{
    groupId: string;
    matchId: string;
  }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: matches, isLoading } = useQuery({
    queryKey: ["matches", groupId, matchId],
    queryFn: () =>
      api<Match[]>("/matches", {
        params: { id: `eq.${matchId}`, deleted_at: "is.null" },
      }),
  });

  const match = matches?.[0];

  const [location, setLocation] = useState<string | null>(null);
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);

  const updateMatch = useMutation({
    mutationFn: () =>
      api("/matches", {
        method: "PATCH",
        params: { id: `eq.${matchId}` },
        body: {
          location: (location ?? match!.location) || null,
          starts_at: new Date(
            startsAt ?? toDatetimeLocal(match!.starts_at),
          ).toISOString(),
          notes: (notes ?? match!.notes) || null,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["matches", groupId, matchId],
      });
      queryClient.invalidateQueries({ queryKey: ["matches", groupId] });
      navigate(`/groups/${groupId}/matches/${matchId}`);
    },
  });

  if (isLoading)
    return (
      <div className="text-text-secondary p-8 text-center">Cargando...</div>
    );
  if (!match)
    return <div className="text-danger text-sm">Partido no encontrado</div>;

  return (
    <div>
      <h1>Editar Partido</h1>
      <form
        className="max-w-lg"
        onSubmit={(e) => {
          e.preventDefault();
          updateMatch.mutate();
        }}
      >
        <FormField label="Fecha y Hora">
          <Input
            type="datetime-local"
            value={startsAt ?? toDatetimeLocal(match.starts_at)}
            onChange={(e) => setStartsAt(e.target.value)}
            required
          />
        </FormField>
        <FormField label="Lugar">
          <Input
            type="text"
            value={location ?? match.location ?? ""}
            onChange={(e) => setLocation(e.target.value)}
          />
        </FormField>
        <FormField label="Notas">
          <Textarea
            value={notes ?? match.notes ?? ""}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </FormField>
        <div className="mt-4 flex gap-2">
          <Button type="submit" disabled={updateMatch.isPending}>
            {updateMatch.isPending ? "Guardando..." : "Guardar"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate(`/groups/${groupId}/matches/${matchId}`)}
          >
            Cancelar
          </Button>
        </div>
        {updateMatch.isError && (
          <p className="text-danger text-sm">{updateMatch.error.message}</p>
        )}
      </form>
    </div>
  );
}
