import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "react-oidc-context";
import { api, rpc } from "../../api/postgrest";
import { ConfirmButton } from "../ui/ConfirmButton";

type Admin = {
  group_id: string;
  user_id: string;
  users: { display_name: string; avatar_url: string | null };
};

type Invite = {
  id: string;
  group_id: string;
  token: string;
  created_at: string;
};

type Player = {
  id: string;
  group_id: string;
  user_id: string | null;
  name: string;
  users: { display_name: string; avatar_url: string | null } | null;
};

export function MemberList({ groupId }: { groupId: string }) {
  const queryClient = useQueryClient();
  const auth = useAuth();
  const currentUserId = auth.user?.profile.sub;
  const [copied, setCopied] = useState<string | null>(null);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editingPlayerName, setEditingPlayerName] = useState("");
  const [newPlayerName, setNewPlayerName] = useState("");

  // group_members now only contains admins
  const { data: admins } = useQuery({
    queryKey: ["group_members", groupId],
    queryFn: () =>
      api<Admin[]>("/group_members", {
        params: {
          group_id: `eq.${groupId}`,
          select: "group_id,user_id,users(display_name,avatar_url)",
        },
      }),
  });

  const isAdmin = admins?.some((a) => a.user_id === currentUserId);

  const { data: players, isLoading } = useQuery({
    queryKey: ["players", groupId],
    queryFn: () =>
      api<Player[]>("/players", {
        params: {
          group_id: `eq.${groupId}`,
          select: "id,group_id,user_id,name,users(display_name,avatar_url)",
        },
      }),
  });

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

  const promoteToAdmin = useMutation({
    mutationFn: (userId: string) =>
      api("/group_members", {
        method: "POST",
        body: { group_id: groupId, user_id: userId },
        headers: { Prefer: "return=representation" },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group_members", groupId] });
    },
  });

  const demoteFromAdmin = useMutation({
    mutationFn: (userId: string) =>
      api("/group_members", {
        method: "DELETE",
        params: { group_id: `eq.${groupId}`, user_id: `eq.${userId}` },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group_members", groupId] });
    },
  });

  const expelMember = useMutation({
    mutationFn: (userId: string) =>
      api("/players", {
        method: "DELETE",
        params: { group_id: `eq.${groupId}`, user_id: `eq.${userId}` },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["players", groupId] });
      queryClient.invalidateQueries({ queryKey: ["group_members", groupId] });
    },
  });

  const deletePlayer = useMutation({
    mutationFn: (playerId: string) =>
      api("/players", {
        method: "DELETE",
        params: { id: `eq.${playerId}` },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["players", groupId] });
    },
  });

  const createPlayer = useMutation({
    mutationFn: (name: string) =>
      api("/players", {
        method: "POST",
        body: { group_id: groupId, name },
        headers: { Prefer: "return=representation" },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["players", groupId] });
      setNewPlayerName("");
    },
  });

  const unlinkPlayer = useMutation({
    mutationFn: (playerId: string) =>
      api("/players", {
        method: "PATCH",
        params: { id: `eq.${playerId}` },
        body: { user_id: null },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["players", groupId] });
    },
  });

  const updatePlayer = useMutation({
    mutationFn: ({ playerId, name }: { playerId: string; name: string }) =>
      api("/players", {
        method: "PATCH",
        params: { id: `eq.${playerId}` },
        body: { name },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["players", groupId] });
      setEditingPlayerId(null);
    },
  });

  const claimPlayer = useMutation({
    mutationFn: (playerId: string) =>
      rpc("claim_player", { p_player_id: playerId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["players", groupId] });
    },
  });

  function copyInviteLink(token: string) {
    const url = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(url);
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  }

  if (isLoading) return <div className="loading">Cargando miembros...</div>;

  const members: {
    userId: string;
    displayName: string;
    avatarUrl: string | null;
    isAdmin: boolean;
  }[] = [];
  const seenUserIds = new Set<string>();

  // Add all linked players as members
  for (const p of players ?? []) {
    if (p.user_id && !seenUserIds.has(p.user_id)) {
      seenUserIds.add(p.user_id);
      members.push({
        userId: p.user_id,
        displayName: p.users?.display_name ?? p.name,
        avatarUrl: p.users?.avatar_url ?? null,
        isAdmin: admins?.some((a) => a.user_id === p.user_id) ?? false,
      });
    }
  }

  // Add admins that don't have a linked player
  for (const a of admins ?? []) {
    if (!seenUserIds.has(a.user_id)) {
      seenUserIds.add(a.user_id);
      members.push({
        userId: a.user_id,
        displayName: a.users.display_name,
        avatarUrl: a.users.avatar_url,
        isAdmin: true,
      });
    }
  }

  return (
    <div>
      <h3>Jugadores</h3>
      <ul className="member-list">
        {players?.map((p) => {
          const currentUserHasPlayer = players.some(
            (pl) => pl.user_id === currentUserId,
          );
          return (
            <li key={p.id} className="member-item">
              {editingPlayerId === p.id ? (
                <form
                  className="member-info"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (editingPlayerName.trim()) {
                      updatePlayer.mutate({
                        playerId: p.id,
                        name: editingPlayerName.trim(),
                      });
                    }
                  }}
                >
                  <input
                    type="text"
                    value={editingPlayerName}
                    onChange={(e) => setEditingPlayerName(e.target.value)}
                    className="input"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={updatePlayer.isPending}
                  >
                    Guardar
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setEditingPlayerId(null)}
                  >
                    Cancelar
                  </button>
                </form>
              ) : (
                <>
                  <div className="member-info">
                    {p.users?.avatar_url && (
                      <img
                        src={p.users.avatar_url}
                        alt=""
                        className="member-avatar"
                      />
                    )}
                    <span>{p.name}</span>
                    {!p.user_id && (
                      <span className="badge badge-admin">sin vincular</span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "0.25rem" }}>
                    {!p.user_id && !currentUserHasPlayer && (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => claimPlayer.mutate(p.id)}
                        disabled={claimPlayer.isPending}
                      >
                        Soy yo
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setEditingPlayerId(p.id);
                          setEditingPlayerName(p.name);
                        }}
                      >
                        Editar
                      </button>
                    )}
                    {isAdmin && p.user_id && p.user_id !== currentUserId && (
                      <ConfirmButton
                        label="Desvincular"
                        confirmLabel="Sí, desvincular"
                        onConfirm={() => unlinkPlayer.mutate(p.id)}
                        disabled={unlinkPlayer.isPending}
                      />
                    )}
                    {isAdmin && !p.user_id && (
                      <ConfirmButton
                        label="Eliminar"
                        confirmLabel="Sí, eliminar"
                        onConfirm={() => deletePlayer.mutate(p.id)}
                        disabled={deletePlayer.isPending}
                      />
                    )}
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>

      {isAdmin && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (newPlayerName.trim()) {
              createPlayer.mutate(newPlayerName.trim());
            }
          }}
          style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}
        >
          <input
            type="text"
            value={newPlayerName}
            onChange={(e) => setNewPlayerName(e.target.value)}
            placeholder="Nombre del jugador"
            className="input"
          />
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={createPlayer.isPending || !newPlayerName.trim()}
          >
            Agregar Jugador
          </button>
        </form>
      )}

      <h3>Miembros</h3>
      <ul className="member-list">
        {members.map((m) => {
          const isCurrentUser = m.userId === currentUserId;
          return (
            <li key={m.userId} className="member-item">
              <div className="member-info">
                {m.avatarUrl && (
                  <img src={m.avatarUrl} alt="" className="member-avatar" />
                )}
                <span>
                  {m.displayName}
                  {(() => {
                    const player = players?.find((p) => p.user_id === m.userId);
                    return player ? ` (${player.name})` : null;
                  })()}
                </span>
                {m.isAdmin && <span className="badge badge-admin">admin</span>}
              </div>
              {isAdmin && !isCurrentUser && (
                <div style={{ display: "flex", gap: "0.25rem" }}>
                  {m.isAdmin ? (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => demoteFromAdmin.mutate(m.userId)}
                      disabled={demoteFromAdmin.isPending}
                    >
                      Quitar Admin
                    </button>
                  ) : (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => promoteToAdmin.mutate(m.userId)}
                      disabled={promoteToAdmin.isPending}
                    >
                      Hacer Admin
                    </button>
                  )}
                  <ConfirmButton
                    label="Expulsar"
                    confirmLabel="Sí, expulsar"
                    onConfirm={() => expelMember.mutate(m.userId)}
                    disabled={expelMember.isPending}
                  />
                </div>
              )}
            </li>
          );
        })}
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
