import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "react-oidc-context";
import { api } from "../../api/postgrest";
import { Button } from "../ui/Button";

type AttendanceRow = {
  player_id: string;
  status: string;
  players: {
    id: string;
    name: string;
    user_id: string | null;
    users: { avatar_url: string | null } | null;
  };
};

type Player = {
  id: string;
  name: string;
  user_id: string | null;
  users: { avatar_url: string | null } | null;
};
type Admin = { user_id: string };

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
          select:
            "player_id,status,players(id,name,user_id,users!players_user_id_fkey(avatar_url))",
          order: "status.asc",
        },
      }),
  });

  const { data: admins } = useQuery({
    queryKey: ["group_members", groupId],
    queryFn: () =>
      api<Admin[]>("/group_members", {
        params: { group_id: `eq.${groupId}`, select: "user_id" },
      }),
  });

  const { data: players } = useQuery({
    queryKey: ["players", groupId],
    queryFn: () =>
      api<Player[]>("/players", {
        params: {
          group_id: `eq.${groupId}`,
          select: "id,name,user_id,users!players_user_id_fkey(avatar_url)",
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

  if (isLoading)
    return (
      <div className="text-text-secondary p-8 text-center">Cargando...</div>
    );

  const goingCount = rows?.filter((r) => r.status === "going").length ?? 0;
  const maybeCount = rows?.filter((r) => r.status === "maybe").length ?? 0;

  const summary = (
    <div className="mb-3 flex gap-2">
      <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-800">
        {goingCount} {goingCount === 1 ? "va" : "van"}
      </span>
      {maybeCount > 0 && (
        <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-700">
          {maybeCount} capaz
        </span>
      )}
    </div>
  );

  if (isAdmin && players) {
    const attendanceByPlayer = new Map(
      rows?.map((r) => [r.player_id, r.status]),
    );
    return (
      <div>
        {summary}
        <ul className="list-none">
          {players.map((p: Player) => {
            const currentStatus = attendanceByPlayer.get(p.id);
            return (
              <li
                key={p.id}
                className="border-border flex items-center justify-between border-b py-2"
              >
                <div className="flex items-center gap-2">
                  {p.users?.avatar_url && (
                    <img
                      src={p.users.avatar_url}
                      alt=""
                      className="h-6 w-6 rounded-full"
                    />
                  )}
                  <span>{p.name}</span>
                </div>
                <div className="flex gap-2">
                  {statuses.map((s) => (
                    <Button
                      key={s}
                      size="sm"
                      variant={currentStatus === s ? "active" : "secondary"}
                      onClick={() =>
                        upsert.mutate({ playerId: p.id, status: s })
                      }
                      disabled={upsert.isPending || remove.isPending}
                    >
                      {statusLabels[s]}
                    </Button>
                  ))}
                  {currentStatus && (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => remove.mutate(p.id)}
                      disabled={upsert.isPending || remove.isPending}
                    >
                      Borrar
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  if (!rows?.length)
    return (
      <p className="text-text-secondary p-6 text-center italic">
        Nadie confirmo todavia.
      </p>
    );

  const grouped = rows.reduce<Record<string, AttendanceRow[]>>((acc, r) => {
    (acc[r.status] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div>
      {summary}
      {(["going", "maybe", "not_going"] as const).map((status) => {
        const group = grouped[status];
        if (!group?.length) return null;
        return (
          <div key={status}>
            <h3 className="text-text-secondary mt-4 mb-1 text-sm">
              {statusLabels[status]} ({group.length})
            </h3>
            <ul className="list-none">
              {group.map((r: AttendanceRow) => (
                <li
                  key={r.player_id}
                  className="border-border flex items-center gap-2 border-b py-2"
                >
                  {r.players.users?.avatar_url && (
                    <img
                      src={r.players.users.avatar_url}
                      alt=""
                      className="h-6 w-6 rounded-full"
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
