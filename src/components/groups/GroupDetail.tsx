import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "react-oidc-context";
import { api } from "../../api/postgrest";
import { MatchList } from "../matches/MatchList";
import { MemberList } from "./MemberList";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { Button, LinkButton } from "../ui/Button";
import { BackLink } from "../ui/BackLink";

type Group = {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
};

type Admin = {
  user_id: string;
};

export function GroupDetail() {
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
        params: {
          group_id: `eq.${groupId}`,
          select: "user_id",
        },
      }),
  });

  const isAdmin = admins?.some((a) => a.user_id === currentUserId);

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

  const group = groups?.[0];

  if (isLoading)
    return (
      <div className="text-text-secondary p-8 text-center">Cargando...</div>
    );
  if (!group)
    return <div className="text-danger text-sm">Grupo no encontrado</div>;

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1>{group.name}</h1>
          {group.description && (
            <p className="text-text-secondary">{group.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <LinkButton to={`/groups/${groupId}/vote`} variant="secondary">
            Votar
          </LinkButton>
          {isAdmin && (
            <>
              <Button
                variant="danger"
                onClick={() => setShowDeleteDialog(true)}
              >
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
              <LinkButton to={`/groups/${groupId}/edit`} variant="secondary">
                Editar
              </LinkButton>
              <LinkButton
                to={`/groups/${groupId}/attributes`}
                variant="secondary"
              >
                Atributos
              </LinkButton>
              <LinkButton to={`/groups/${groupId}/ratings`} variant="secondary">
                Puntuaciones
              </LinkButton>
              <LinkButton to={`/groups/${groupId}/matches/new`}>
                Programar Partido
              </LinkButton>
            </>
          )}
        </div>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-lg">Proximos Partidos</h2>
        <MatchList groupId={groupId!} />
        <BackLink to={`/groups/${groupId}/matches/past`} className="mt-2">
          Ver todos los partidos
        </BackLink>
      </section>

      <section className="mt-8">
        <MemberList groupId={groupId!} />
      </section>
    </div>
  );
}
