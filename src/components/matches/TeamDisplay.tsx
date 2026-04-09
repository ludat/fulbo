import clsx from "clsx";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/postgrest";
import { Button } from "../ui/Button";

type TeamAssignment = {
  match_id: string;
  player_id: string;
  team: number;
  players: {
    id: string;
    name: string;
    user_id: string | null;
    users: { avatar_url: string | null } | null;
  };
};
type PlayerAttribute = {
  id: string;
  name: string;
  abbreviation: string | null;
};
type PlayerRating = { player_id: string; attribute_id: string; rating: number };
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

export function TeamDisplay({
  matchId,
  groupId,
  isAdmin,
}: {
  matchId: string;
  groupId: string;
  isAdmin?: boolean;
}) {
  const queryClient = useQueryClient();

  const { data: teams, isLoading } = useQuery({
    queryKey: ["match_teams", matchId],
    queryFn: () =>
      api<TeamAssignment[]>("/match_teams", {
        params: {
          match_id: `eq.${matchId}`,
          select:
            "match_id,player_id,team,players(id,name,user_id,users!players_user_id_fkey(avatar_url))",
        },
      }),
  });

  const { data: attendance } = useQuery({
    queryKey: ["attendance", matchId],
    queryFn: () =>
      api<AttendanceRow[]>("/attendance", {
        params: {
          match_id: `eq.${matchId}`,
          select:
            "player_id,status,players(id,name,user_id,users!players_user_id_fkey(avatar_url))",
        },
      }),
  });

  const { data: attributes } = useQuery({
    queryKey: ["player_attributes", groupId],
    queryFn: () =>
      api<PlayerAttribute[]>("/player_attributes", {
        params: {
          group_id: `eq.${groupId}`,
          order: "display_order.asc,name.asc",
          select: "id,name,abbreviation",
        },
      }),
  });

  const { data: ratings } = useQuery({
    queryKey: ["player_ratings", groupId],
    queryFn: () =>
      api<PlayerRating[]>("/player_ratings", {
        params: {
          group_id: `eq.${groupId}`,
          select: "player_id,attribute_id,rating",
        },
      }),
    enabled: !!attributes?.length,
  });

  const swapTeam = useMutation({
    mutationFn: ({
      playerId,
      newTeam,
    }: {
      playerId: string;
      newTeam: number;
    }) =>
      api("/match_teams", {
        method: "PATCH",
        params: { match_id: `eq.${matchId}`, player_id: `eq.${playerId}` },
        body: { team: newTeam },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["match_teams", matchId] });
    },
  });

  const removeFromTeam = useMutation({
    mutationFn: (playerId: string) =>
      api("/match_teams", {
        method: "DELETE",
        params: { match_id: `eq.${matchId}`, player_id: `eq.${playerId}` },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["match_teams", matchId] });
    },
  });

  const addToTeam = useMutation({
    mutationFn: ({ playerId, team }: { playerId: string; team: number }) =>
      api("/match_teams", {
        method: "POST",
        body: { match_id: matchId, player_id: playerId, team },
        headers: { Prefer: "return=representation" },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["match_teams", matchId] });
    },
  });

  if (isLoading)
    return (
      <div className="text-text-secondary p-8 text-center">
        Cargando equipos...
      </div>
    );

  const team1 = teams?.filter((t) => t.team === 1) ?? [];
  const team2 = teams?.filter((t) => t.team === 2) ?? [];
  const assignedPlayerIds = new Set(teams?.map((t) => t.player_id) ?? []);
  const goingAttendance = attendance?.filter((a) => a.status === "going") ?? [];
  const bench = goingAttendance.filter(
    (a) => !assignedPlayerIds.has(a.player_id),
  );
  const goingPlayerIds = new Set(goingAttendance.map((a) => a.player_id));

  const ratingMap = new Map<string, number>();
  if (ratings)
    for (const r of ratings)
      ratingMap.set(`${r.player_id}:${r.attribute_id}`, r.rating);

  function attrSum(teamPlayers: TeamAssignment[], attributeId: string): number {
    return teamPlayers.reduce(
      (sum, t) => sum + (ratingMap.get(`${t.player_id}:${attributeId}`) ?? 0),
      0,
    );
  }

  function totalSum(teamPlayers: TeamAssignment[]): number {
    if (!attributes?.length) return 0;
    return attributes.reduce(
      (sum, attr) => sum + attrSum(teamPlayers, attr.id),
      0,
    );
  }

  const hasAttrs = !!attributes?.length;
  const t1Total = totalSum(team1);
  const t2Total = totalSum(team2);

  if (!teams?.length && !bench.length) return null;

  return (
    <div>
      {(team1.length > 0 || team2.length > 0) && (
        <>
          {hasAttrs && (
            <div className="mt-4">
              <h4 className="mb-2 text-sm">Diferencia entre equipos</h4>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {attributes.map((attr) => {
                  const diff =
                    attrSum(team1, attr.id) - attrSum(team2, attr.id);
                  return (
                    <span
                      key={attr.id}
                      className={clsx(
                        "rounded-full px-2 py-0.5 text-xs",
                        diff === 0
                          ? "text-primary bg-green-100"
                          : "bg-orange-100 text-orange-800",
                      )}
                    >
                      {attr.name}: {diff > 0 ? "+" : ""}
                      {diff}
                    </span>
                  );
                })}
                <span
                  className={clsx(
                    "rounded-full px-2 py-0.5 text-xs",
                    t1Total === t2Total
                      ? "text-primary bg-green-100"
                      : "bg-orange-100 text-orange-800",
                  )}
                >
                  <strong>
                    Total: {t1Total - t2Total > 0 ? "+" : ""}
                    {t1Total - t2Total}
                  </strong>
                </span>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-6">
            <TeamColumn
              label="Equipo 1"
              players={team1}
              attributes={attributes}
              ratingMap={ratingMap}
              attrSum={(attrId) => attrSum(team1, attrId)}
              total={t1Total}
              isAdmin={isAdmin}
              swapDirection={2}
              swapLabel="→"
              swapTeam={swapTeam}
              removeFromTeam={removeFromTeam}
              goingPlayerIds={goingPlayerIds}
            />
            <TeamColumn
              label="Equipo 2"
              players={team2}
              attributes={attributes}
              ratingMap={ratingMap}
              attrSum={(attrId) => attrSum(team2, attrId)}
              total={t2Total}
              isAdmin={isAdmin}
              swapDirection={1}
              swapLabel="←"
              swapTeam={swapTeam}
              removeFromTeam={removeFromTeam}
              swapBefore
              goingPlayerIds={goingPlayerIds}
            />
          </div>
        </>
      )}

      {bench.length > 0 && (
        <div className="mt-4">
          <h3>Sin asignar ({bench.length})</h3>
          <ul className="list-none">
            {bench.map((a) => (
              <li
                key={a.player_id}
                className="border-border flex items-center justify-between border-b py-2"
              >
                <div className="flex items-center gap-2">
                  {a.players.users?.avatar_url && (
                    <img
                      src={a.players.users.avatar_url}
                      alt=""
                      className="h-6 w-6 rounded-full"
                    />
                  )}
                  <span>{a.players.name}</span>
                  {hasAttrs && (
                    <PlayerRatingBadges
                      attributes={attributes}
                      ratingMap={ratingMap}
                      playerId={a.player_id}
                    />
                  )}
                </div>
                {isAdmin && (
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        addToTeam.mutate({ playerId: a.player_id, team: 1 })
                      }
                      disabled={addToTeam.isPending}
                    >
                      → Eq 1
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        addToTeam.mutate({ playerId: a.player_id, team: 2 })
                      }
                      disabled={addToTeam.isPending}
                    >
                      → Eq 2
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PlayerRatingBadges({
  attributes,
  ratingMap,
  playerId,
}: {
  attributes: PlayerAttribute[];
  ratingMap: Map<string, number>;
  playerId: string;
}) {
  return (
    <span className="ml-1 flex gap-1">
      {/* text-[0.65rem]: smaller than text-xs to fit multiple rating badges inline */}
      {attributes.map((attr) => (
        <span
          key={attr.id}
          className="text-text-secondary rounded-full bg-gray-100 px-1.5 py-0.5 text-[0.65rem]"
          title={attr.name}
        >
          {attr.abbreviation ?? attr.name}:{" "}
          {ratingMap.get(`${playerId}:${attr.id}`) ?? "-"}
        </span>
      ))}
    </span>
  );
}

function TeamColumn({
  label,
  players,
  attributes,
  ratingMap,
  attrSum,
  total,
  isAdmin,
  swapDirection,
  swapLabel,
  swapTeam,
  removeFromTeam,
  swapBefore,
  goingPlayerIds,
}: {
  label: string;
  players: TeamAssignment[];
  attributes?: PlayerAttribute[];
  ratingMap: Map<string, number>;
  attrSum: (attributeId: string) => number;
  total: number;
  isAdmin?: boolean;
  swapDirection: number;
  swapLabel: string;
  swapTeam: {
    mutate: (v: { playerId: string; newTeam: number }) => void;
    isPending: boolean;
  };
  removeFromTeam: { mutate: (playerId: string) => void; isPending: boolean };
  swapBefore?: boolean;
  goingPlayerIds: Set<string>;
}) {
  const hasAttrs = !!attributes?.length;

  const actionButtons = (playerId: string) =>
    isAdmin ? (
      <div className="flex gap-1">
        {swapBefore && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              swapTeam.mutate({ playerId, newTeam: swapDirection })
            }
            disabled={swapTeam.isPending}
          >
            {swapLabel}
          </Button>
        )}
        <Button
          size="sm"
          variant="secondary"
          onClick={() => removeFromTeam.mutate(playerId)}
          disabled={removeFromTeam.isPending}
          title="Mandar al banco"
        >
          ✕
        </Button>
        {!swapBefore && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              swapTeam.mutate({ playerId, newTeam: swapDirection })
            }
            disabled={swapTeam.isPending}
          >
            {swapLabel}
          </Button>
        )}
      </div>
    ) : null;

  return (
    <div className="bg-surface border-border rounded-lg border p-4">
      <h3 className="mb-2 text-base">
        {label} ({players.length})
        {hasAttrs ? (
          <span className="text-text-secondary text-sm font-normal">
            {" "}
            — {total} pts
          </span>
        ) : null}
      </h3>
      {hasAttrs ? (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {attributes.map((attr) => (
            <span
              key={attr.id}
              className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800"
            >
              {attr.name}: {attrSum(attr.id)}
            </span>
          ))}
        </div>
      ) : null}
      <ul className="list-none">
        {players.map((t) => {
          const isNotGoing = !goingPlayerIds.has(t.player_id);
          return (
            <li
              key={t.player_id}
              className={clsx(
                "border-border flex items-center justify-between border-b py-2",
                isNotGoing && "text-danger rounded-lg bg-red-50",
              )}
            >
              <div className="flex items-center gap-2">
                {t.players.users?.avatar_url && (
                  <img
                    src={t.players.users.avatar_url}
                    alt=""
                    className="h-6 w-6 rounded-full"
                  />
                )}
                <span>{t.players.name}</span>
                {hasAttrs && (
                  <PlayerRatingBadges
                    attributes={attributes}
                    ratingMap={ratingMap}
                    playerId={t.player_id}
                  />
                )}
              </div>
              {actionButtons(t.player_id)}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
