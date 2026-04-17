import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "react-oidc-context";
import { api } from "../../api/postgrest";
import { GroupHeader } from "./GroupHeader";
import { GroupNav } from "./GroupNav";
import { Button } from "../ui/Button";
import { FormField } from "../ui/FormField";
import { Input, Textarea } from "../ui/Input";
import { ConfirmDialog } from "../ui/ConfirmDialog";

type Group = {
  id: string;
  name: string;
  description: string | null;
};

type Admin = {
  user_id: string;
};

export function GroupSettings() {
  const { groupId } = useParams<{ groupId: string }>();
  const auth = useAuth();
  const currentUserId = auth.user?.profile.sub;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: groups, isLoading } = useQuery({
    queryKey: ["groups", groupId],
    queryFn: () =>
      api<Group[]>("/groups", {
        params: { id: `eq.${groupId}`, deleted_at: "is.null" },
      }),
  });

  const { data: admins } = useQuery({
    queryKey: ["group_members", groupId],
    queryFn: () =>
      api<Admin[]>("/group_members", {
        params: { group_id: `eq.${groupId}`, select: "user_id" },
      }),
  });

  const isAdmin = admins?.some((a) => a.user_id === currentUserId) ?? false;
  const group = groups?.[0];

  // Edit group form state
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
      setName(null);
      setDescription(null);
    },
  });

  // Delete group
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const deleteGroup = useMutation({
    mutationFn: () =>
      api("/groups", {
        method: "PATCH",
        params: { id: `eq.${groupId}` },
        body: { deleted_at: new Date().toISOString() },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      navigate("/");
    },
  });

  if (isLoading)
    return (
      <div className="text-text-secondary p-8 text-center">Cargando...</div>
    );
  if (!group)
    return <div className="text-danger text-sm">Grupo no encontrado</div>;
  if (!isAdmin) {
    navigate(`/groups/${groupId}`);
    return null;
  }

  return (
    <div>
      <GroupHeader
        groupName={group.name}
        groupDescription={group.description}
      />
      <GroupNav groupId={groupId!} isAdmin={isAdmin} />

      {/* Edit group */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg">Editar Grupo</h2>
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
          <Button type="submit" disabled={updateGroup.isPending}>
            {updateGroup.isPending ? "Guardando..." : "Guardar"}
          </Button>
          {updateGroup.isError && (
            <p className="text-danger mt-1 text-sm">
              {updateGroup.error.message}
            </p>
          )}
          {updateGroup.isSuccess && (
            <p className="mt-1 text-sm text-green-600">Guardado</p>
          )}
        </form>
      </section>

      {/* Danger zone */}
      <section className="border-danger/30 rounded-lg border p-4">
        <h2 className="text-danger mb-3 text-lg">Zona de Peligro</h2>
        <p className="text-text-secondary mb-3 text-sm">
          Eliminar el grupo es permanente y no se puede deshacer.
        </p>
        <Button variant="danger" onClick={() => setShowDeleteDialog(true)}>
          Eliminar Grupo
        </Button>
        {showDeleteDialog && (
          <ConfirmDialog
            message={`¿Eliminar el grupo "${group.name}"? Esta acción no se puede deshacer.`}
            confirmLabel="Sí, eliminar"
            onConfirm={() => {
              setShowDeleteDialog(false);
              deleteGroup.mutate();
            }}
            onCancel={() => setShowDeleteDialog(false)}
            disabled={deleteGroup.isPending}
          />
        )}
      </section>
    </div>
  );
}
