import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "react-oidc-context";
import { api } from "../../api/postgrest";
import { MatchList } from "../matches/MatchList";
import { MemberList } from "./MemberList";
import { ConfirmDialog } from "../ui/ConfirmDialog";

type Group = {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
};

type Member = {
  user_id: string;
  role: string;
  users: { display_name: string; email: string; avatar_url: string | null };
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
      api<Group[]>("/groups", { params: { id: `eq.${groupId}`, deleted_at: "is.null" } }),
  });

  const { data: members } = useQuery({
    queryKey: ["group_members", groupId],
    queryFn: () =>
      api<Member[]>("/group_members", {
        params: {
          group_id: `eq.${groupId}`,
          select: "group_id,user_id,role,users(display_name,email,avatar_url)",
        },
      }),
  });

  const isAdmin = members?.some(
    (m) => m.user_id === currentUserId && m.role === "admin"
  );

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

  if (isLoading) return <div className="loading">Cargando...</div>;
  if (!group) return <div className="error">Grupo no encontrado</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{group.name}</h1>
          {group.description && (
            <p className="subtitle">{group.description}</p>
          )}
        </div>
        {isAdmin && (
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              className="btn btn-danger"
              onClick={() => setShowDeleteDialog(true)}
            >
              Eliminar Grupo
            </button>
            {showDeleteDialog && (
              <ConfirmDialog
                message={`¿Eliminar el grupo "${group.name}"? Esta acción no se puede deshacer.`}
                confirmLabel="Sí, eliminar"
                onConfirm={() => { setShowDeleteDialog(false); deleteGroup.mutate(); }}
                onCancel={() => setShowDeleteDialog(false)}
                disabled={deleteGroup.isPending}
              />
            )}
            <Link
              to={`/groups/${groupId}/edit`}
              className="btn btn-secondary"
            >
              Editar
            </Link>
            <Link
              to={`/groups/${groupId}/matches/new`}
              className="btn btn-primary"
            >
              Programar Partido
            </Link>
          </div>
        )}
      </div>

      <section>
        <h2>Proximos Partidos</h2>
        <MatchList groupId={groupId!} />
        <Link
          to={`/groups/${groupId}/matches/past`}
          className="back-link"
          style={{ marginTop: "0.5rem" }}
        >
          Ver todos los partidos
        </Link>
      </section>

      <section>
        <h2>Miembros</h2>
        <MemberList groupId={groupId!} />
      </section>
    </div>
  );
}
