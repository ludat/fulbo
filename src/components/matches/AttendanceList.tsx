import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "react-oidc-context";
import { api } from "../../api/postgrest";

type AttendanceRow = {
  player_id: string;
  status: string;
  players: { id: string; name: string; user_id: string | null; users: { avatar_url: string | null } | null };
};

type Player = {
  id: string;
  name: string;
  user_id: string | null;
  users: { avatar_url: string | null } | null;
};

type Admin = {
  user_id: string;
};

const statusLabels: Record<string, string> = {
  going: "Voy",
  maybe: "Capaz",
  not_going: "No voy",
};

const statuses = ["going", "maybe", "not_going"] as const;

export function AttendanceList({
  matchId,
  groupId,
}: {
  matchId: string;
  groupId: string;
}) {
  const auth = useAuth();
  const currentUserId = auth.user?.profile.sub;
  const queryClient = useQueryClient();

  const { data: rows, isLoading } = useQuery({
    queryKey: ["attendance", matchId],
    queryFn: () =>
      api<AttendanceRow[]>("/attendance", {
        params: {
          match_id: `eq.${matchId}`,
          select: "player_id,status,players(id,name,user_id,users(avatar_url))",
          order: "status.asc",
        },
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

  const { data: players } = useQuery({
    queryKey: ["players", groupId],
    queryFn: () =>
      api<Player[]>("/players", {
        params: {
          group_id: `eq.${groupId}`,
          select: "id,name,user_id,users(avatar_url)",
        },
      }),
  });

  const isAdmin = admins?.some((a) => a.user_id === currentUserId);

  const upsert = useMutation({
    mutationFn: ({ playerId, status }: { playerId: string; status: string }) =>
      api("/attendance", {
        method: "POST",
        body: { match_id: matchId, player_id: playerId, status },
        headers: {
          Prefer: "resolution=merge-duplicates,return=representation",
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance", matchId] });
    },
  });

  const remove = useMutation({
    mutationFn: (playerId: string) =>
      api("/attendance", {
        method: "DELETE",
        params: { match_id: `eq.${matchId}`, player_id: `eq.${playerId}` },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance", matchId] });
    },
  });

  if (isLoading) return <div className="loading">Cargando...</div>;

  const goingCount = rows?.filter((r) => r.status === "going").length ?? 0;
  const maybeCount = rows?.filter((r) => r.status === "maybe").length ?? 0;

  const summary = (
    <div className="attendance-summary">
      <span className="attendance-summary-chip going">{goingCount} {goingCount === 1 ? "va" : "van"}</span>
      {maybeCount > 0 && <span className="attendance-summary-chip maybe">{maybeCount} capaz</span>}
    </div>
  );

  // Admin view: all players with inline toggle buttons
  if (isAdmin && players) {
    const attendanceByPlayer = new Map(rows?.map((r) => [r.player_id, r.status]));

    return (
      <div className="attendance-list">
        {summary}
        <ul>
          {players.map((p: Player) => {
            const currentStatus = attendanceByPlayer.get(p.id);
            return (
              <li key={p.id} className="member-item attendance-admin-row">
                <div className="member-info">
                  {p.users?.avatar_url && (
                    <img
                      src={p.users.avatar_url}
                      alt=""
                      className="member-avatar"
                    />
                  )}
                  <span>{p.name}</span>
                </div>
                <div className="attendance-toggle">
                  {statuses.map((s) => (
                    <button
                      key={s}
                      className={`btn btn-sm ${currentStatus === s ? "btn-active" : "btn-secondary"}`}
                      onClick={() =>
                        upsert.mutate({ playerId: p.id, status: s })
                      }
                      disabled={upsert.isPending || remove.isPending}
                    >
                      {statusLabels[s]}
                    </button>
                  ))}
                  {currentStatus && (
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => remove.mutate(p.id)}
                      disabled={upsert.isPending || remove.isPending}
                    >
                      Borrar
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  // Non-admin view: simple grouped list
  if (!rows?.length)
    return <p className="empty-state">Nadie confirmo todavia.</p>;

  const grouped = rows.reduce<Record<string, AttendanceRow[]>>((acc, r) => {
    (acc[r.status] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div className="attendance-list">
      {summary}
      {(["going", "maybe", "not_going"] as const).map((status) => {
        const group = grouped[status];
        if (!group?.length) return null;
        return (
          <div key={status} className="attendance-group">
            <h3>
              {statusLabels[status]} ({group.length})
            </h3>
            <ul>
              {group.map((r: AttendanceRow) => (
                <li key={r.player_id} className="member-item">
                  {r.players.users?.avatar_url && (
                    <img
                      src={r.players.users.avatar_url}
                      alt=""
                      className="member-avatar"
                    />
                  )}
                  <span>{r.players.name}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
