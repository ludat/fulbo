import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/postgrest";
import { Button } from "../ui/Button";
import { FormField } from "../ui/FormField";
import { Input, Textarea } from "../ui/Input";

type Group = {
  id: string;
  name: string;
  description: string | null;
};

export function GroupEditForm() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: groups, isLoading } = useQuery({
    queryKey: ["groups", groupId],
    queryFn: () =>
      api<Group[]>("/groups", {
        params: { id: `eq.${groupId}`, deleted_at: "is.null" },
      }),
  });

  const group = groups?.[0];

  const [name, setName] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);

  const updateGroup = useMutation({
    mutationFn: () =>
      api("/groups", {
        method: "PATCH",
        params: { id: `eq.${groupId}` },
        body: {
          name: name ?? group!.name,
          description: description ?? group!.description,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups", groupId] });
      navigate(`/groups/${groupId}`);
    },
  });

  if (isLoading)
    return (
      <div className="text-text-secondary p-8 text-center">Cargando...</div>
    );
  if (!group)
    return <div className="text-danger text-sm">Grupo no encontrado</div>;

  return (
    <div>
      <h1>Editar Grupo</h1>
      <form
        className="max-w-lg"
        onSubmit={(e) => {
          e.preventDefault();
          updateGroup.mutate();
        }}
      >
        <FormField label="Nombre">
          <Input
            type="text"
            value={name ?? group.name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </FormField>
        <FormField label="Descripcion">
          <Textarea
            value={description ?? group.description ?? ""}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </FormField>
        <div className="mt-4 flex gap-2">
          <Button type="submit" disabled={updateGroup.isPending}>
            {updateGroup.isPending ? "Guardando..." : "Guardar"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate(`/groups/${groupId}`)}
          >
            Cancelar
          </Button>
        </div>
        {updateGroup.isError && (
          <p className="text-danger text-sm">{updateGroup.error.message}</p>
        )}
      </form>
    </div>
  );
}
