import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/postgrest";

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
  const { groupId, matchId } = useParams<{ groupId: string; matchId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: matches, isLoading } = useQuery({
    queryKey: ["matches", groupId, matchId],
    queryFn: () =>
      api<Match[]>("/matches", { params: { id: `eq.${matchId}`, deleted_at: "is.null" } }),
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
          starts_at: new Date(startsAt ?? toDatetimeLocal(match!.starts_at)).toISOString(),
          notes: (notes ?? match!.notes) || null,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matches", groupId, matchId] });
      queryClient.invalidateQueries({ queryKey: ["matches", groupId] });
      navigate(`/groups/${groupId}/matches/${matchId}`);
    },
  });

  if (isLoading) return <div className="loading">Cargando...</div>;
  if (!match) return <div className="error">Partido no encontrado</div>;

  return (
    <div>
      <h1>Editar Partido</h1>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          updateMatch.mutate();
        }}
      >
        <label className="form-field">
          <span>Fecha y Hora</span>
          <input
            type="datetime-local"
            value={startsAt ?? toDatetimeLocal(match.starts_at)}
            onChange={(e) => setStartsAt(e.target.value)}
            required
          />
        </label>
        <label className="form-field">
          <span>Lugar</span>
          <input
            type="text"
            value={location ?? match.location ?? ""}
            onChange={(e) => setLocation(e.target.value)}
          />
        </label>
        <label className="form-field">
          <span>Notas</span>
          <textarea
            value={notes ?? match.notes ?? ""}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </label>
        <div className="form-actions">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={updateMatch.isPending}
          >
            {updateMatch.isPending ? "Guardando..." : "Guardar"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate(`/groups/${groupId}/matches/${matchId}`)}
          >
            Cancelar
          </button>
        </div>
        {updateMatch.isError && (
          <p className="error">{updateMatch.error.message}</p>
        )}
      </form>
    </div>
  );
}
