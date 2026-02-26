import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "react-oidc-context";
import { api } from "../../api/postgrest";

type Member = {
  group_id: string;
  user_id: string;
  role: string;
  users: { display_name: string; email: string; avatar_url: string | null };
};

type Invite = {
  id: string;
  group_id: string;
  token: string;
  created_at: string;
};

export function MemberList({ groupId }: { groupId: string }) {
  const queryClient = useQueryClient();
  const auth = useAuth();
  const currentUserId = auth.user?.profile.sub;
  const [copied, setCopied] = useState<string | null>(null);

  const { data: members, isLoading } = useQuery({
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

  const { data: invites } = useQuery({
    queryKey: ["group_invites", groupId],
    queryFn: () =>
      api<Invite[]>("/group_invites", {
        params: {
          group_id: `eq.${groupId}`,
          select: "id,group_id,token,created_at",
        },
      }),
    enabled: !!isAdmin,
  });

  const createInvite = useMutation({
    mutationFn: () =>
      api("/group_invites", {
        method: "POST",
        body: { group_id: groupId },
        headers: { Prefer: "return=representation" },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group_invites", groupId] });
    },
  });

  const promoteToAdmin = useMutation({
    mutationFn: (userId: string) =>
      api("/group_members", {
        method: "PATCH",
        params: { group_id: `eq.${groupId}`, user_id: `eq.${userId}` },
        body: { role: "admin" },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group_members", groupId] });
    },
  });

  const demoteToMember = useMutation({
    mutationFn: (userId: string) =>
      api("/group_members", {
        method: "PATCH",
        params: { group_id: `eq.${groupId}`, user_id: `eq.${userId}` },
        body: { role: "member" },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group_members", groupId] });
    },
  });

  const deleteInvite = useMutation({
    mutationFn: (inviteId: string) =>
      api("/group_invites", {
        method: "DELETE",
        params: { id: `eq.${inviteId}` },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group_invites", groupId] });
    },
  });

  function copyInviteLink(token: string) {
    const url = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(url);
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  }

  if (isLoading) return <div className="loading">Cargando miembros...</div>;

  return (
    <div>
      <ul className="member-list">
        {members?.map((m) => (
          <li key={m.user_id} className="member-item">
            <div className="member-info">
              {m.users.avatar_url && (
                <img src={m.users.avatar_url} alt="" className="member-avatar" />
              )}
              <span>{m.users.display_name}</span>
              <span className={`badge badge-${m.role}`}>{m.role}</span>
            </div>
            {isAdmin && m.role === "member" && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => promoteToAdmin.mutate(m.user_id)}
                disabled={promoteToAdmin.isPending}
              >
                Hacer Admin
              </button>
            )}
            {isAdmin && m.role === "admin" && m.user_id !== currentUserId && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => demoteToMember.mutate(m.user_id)}
                disabled={demoteToMember.isPending}
              >
                Quitar Admin
              </button>
            )}
          </li>
        ))}
      </ul>

      {isAdmin && (
        <div className="invite-section">
          <h3>Links de Invitacion</h3>
          {invites?.length ? (
            <ul className="invite-list">
              {invites.map((inv) => (
                <li key={inv.id} className="invite-item">
                  <code className="invite-token">
                    {`${window.location.origin}/invite/${inv.token}`}
                  </code>
                  <div className="invite-actions">
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => copyInviteLink(inv.token)}
                    >
                      {copied === inv.token ? "Copiado!" : "Copiar"}
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => deleteInvite.mutate(inv.id)}
                    >
                      Revocar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-state">No hay links de invitacion todavia.</p>
          )}
          <button
            className="btn btn-primary btn-sm"
            onClick={() => createInvite.mutate()}
            disabled={createInvite.isPending}
            style={{ marginTop: "0.5rem" }}
          >
            Crear Link de Invitacion
          </button>
        </div>
      )}
    </div>
  );
}
