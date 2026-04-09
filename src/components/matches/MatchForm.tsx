import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/postgrest";
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
    </div>
  );
}
