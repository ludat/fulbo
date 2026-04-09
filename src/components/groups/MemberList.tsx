import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "react-oidc-context";
import { api, rpc } from "../../api/postgrest";
import { ConfirmButton } from "../ui/ConfirmButton";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Input } from "../ui/Input";
import { InfoTooltip } from "../ui/InfoTooltip";
import { InviteLinks } from "./InviteLinks";

type Admin = {
  group_id: string;
  user_id: string;
  users: { display_name: string; avatar_url: string | null };
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
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editingPlayerName, setEditingPlayerName] = useState("");
  const [newPlayerName, setNewPlayerName] = useState("");

  const { data: admins } = useQuery({
    queryKey: ["group_members", groupId],
    queryFn: () =>
      api<Admin[]>("/group_members", {
        params: {
          group_id: `eq.${groupId}`,
          select:
            "group_id,user_id,users!group_members_user_id_fkey(display_name,avatar_url)",
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
          select:
            "id,group_id,user_id,name,users!players_user_id_fkey(display_name,avatar_url)",
        },
      }),
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

  if (isLoading)
    return (
      <div className="text-text-secondary p-8 text-center">
        Cargando miembros...
      </div>
    );

  const members: {
    userId: string;
    displayName: string;
    avatarUrl: string | null;
    isAdmin: boolean;
  }[] = [];
  const seenUserIds = new Set<string>();

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
    <div className="flex flex-col gap-8">
      <section>
        <h3>
          Jugadores
          <InfoTooltip text="Los jugadores participan en los partidos y se les asignan equipos. Puede haber jugadores sin vincular a una cuenta." />
        </h3>
        <ul className="list-none">
          {players?.map((p) => {
            const currentUserHasPlayer = players.some(
              (pl) => pl.user_id === currentUserId,
            );
            return (
              <li
                key={p.id}
                className="border-border flex items-center justify-between border-b py-2"
              >
                {editingPlayerId === p.id ? (
                  <form
                    className="flex items-center gap-2"
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
                    <Input
                      type="text"
                      value={editingPlayerName}
                      onChange={(e) => setEditingPlayerName(e.target.value)}
                      autoFocus
                    />
                    <Button
                      size="sm"
                      type="submit"
                      disabled={updatePlayer.isPending}
                    >
                      Guardar
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      type="button"
                      onClick={() => setEditingPlayerId(null)}
                    >
                      Cancelar
                    </Button>
                  </form>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      {p.users?.avatar_url && (
                        <img
                          src={p.users.avatar_url}
                          alt=""
                          className="h-6 w-6 rounded-full"
                        />
                      )}
                      <span>{p.name}</span>
                      {!p.user_id && (
                        <Badge variant="admin">sin vincular</Badge>
                      )}
                    </div>
                    <div className="flex gap-1">
                      {!p.user_id && !currentUserHasPlayer && (
                        <Button
                          size="sm"
                          onClick={() => claimPlayer.mutate(p.id)}
                          disabled={claimPlayer.isPending}
                        >
                          Soy yo
                        </Button>
                      )}
                      {isAdmin && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setEditingPlayerId(p.id);
                            setEditingPlayerName(p.name);
                          }}
                        >
                          Editar
                        </Button>
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
            className="mt-2 flex gap-2"
          >
            <Input
              type="text"
              value={newPlayerName}
              onChange={(e) => setNewPlayerName(e.target.value)}
              placeholder="Nombre del jugador"
            />
            <Button
              size="sm"
              type="submit"
              disabled={createPlayer.isPending || !newPlayerName.trim()}
            >
              Agregar Jugador
            </Button>
          </form>
        )}
      </section>

      <section>
        <h3>
          Miembros
          <InfoTooltip text="Los miembros son las personas con cuenta que forman parte del grupo. Los admins pueden gestionar jugadores, equipos y partidos." />
        </h3>
        <ul className="list-none">
          {members.map((m) => {
            const isCurrentUser = m.userId === currentUserId;
            return (
              <li
                key={m.userId}
                className="border-border flex items-center justify-between border-b py-2"
              >
                <div className="flex items-center gap-2">
                  {m.avatarUrl && (
                    <img
                      src={m.avatarUrl}
                      alt=""
                      className="h-6 w-6 rounded-full"
                    />
                  )}
                  <span>
                    {m.displayName}
                    {(() => {
                      const player = players?.find(
                        (p) => p.user_id === m.userId,
                      );
                      return player ? ` (${player.name})` : null;
                    })()}
                  </span>
                  {m.isAdmin && <Badge variant="admin">admin</Badge>}
                </div>
                {isAdmin && !isCurrentUser && (
                  <div className="flex gap-1">
                    {m.isAdmin ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => demoteFromAdmin.mutate(m.userId)}
                        disabled={demoteFromAdmin.isPending}
                      >
                        Quitar Admin
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => promoteToAdmin.mutate(m.userId)}
                        disabled={promoteToAdmin.isPending}
                      >
                        Hacer Admin
                      </Button>
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
      </section>

      {isAdmin && <InviteLinks groupId={groupId} />}
    </div>
  );
}
