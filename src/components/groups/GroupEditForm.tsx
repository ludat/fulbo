import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/postgrest";

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
      api<Group[]>("/groups", { params: { id: `eq.${groupId}`, deleted_at: "is.null" } }),
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

  if (isLoading) return <div className="loading">Cargando...</div>;
  if (!group) return <div className="error">Grupo no encontrado</div>;

  return (
    <div>
      <h1>Editar Grupo</h1>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          updateGroup.mutate();
        }}
      >
        <label className="form-field">
          <span>Nombre</span>
          <input
            type="text"
            value={name ?? group.name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <label className="form-field">
          <span>Descripcion</span>
          <textarea
            value={description ?? group.description ?? ""}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </label>
        <div className="form-actions">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={updateGroup.isPending}
          >
            {updateGroup.isPending ? "Guardando..." : "Guardar"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate(`/groups/${groupId}`)}
          >
            Cancelar
          </button>
        </div>
        {updateGroup.isError && (
          <p className="error">{updateGroup.error.message}</p>
        )}
      </form>
    </div>
  );
}
