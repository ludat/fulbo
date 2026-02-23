import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/postgrest";

export function MatchForm() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [location, setLocation] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [notes, setNotes] = useState("");

  const createMatch = useMutation({
    mutationFn: () =>
      api("/matches", {
        method: "POST",
        body: {
          group_id: groupId,
          location: location || null,
          starts_at: new Date(startsAt).toISOString(),
          notes: notes || null,
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
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          createMatch.mutate();
        }}
      >
        <label className="form-field">
          <span>Fecha y Hora</span>
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            required
          />
        </label>
        <label className="form-field">
          <span>Lugar</span>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </label>
        <label className="form-field">
          <span>Notas</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </label>
        <div className="form-actions">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={createMatch.isPending}
          >
            {createMatch.isPending ? "Creando..." : "Programar"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate(`/groups/${groupId}`)}
          >
            Cancelar
          </button>
        </div>
        {createMatch.isError && (
          <p className="error">{createMatch.error.message}</p>
        )}
      </form>
    </div>
  );
}
