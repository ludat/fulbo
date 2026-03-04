import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/postgrest";

type TeamAssignment = {
  match_id: string;
  player_id: string;
  team: number;
  players: { id: string; name: string; user_id: string | null; users: { avatar_url: string | null } | null };
};

type PlayerAttribute = {
  id: string;
  name: string;
  abbreviation: string | null;
};

type PlayerRating = {
  player_id: string;
  attribute_id: string;
  rating: number;
};

type AttendanceRow = {
  player_id: string;
  status: string;
  players: { id: string; name: string; user_id: string | null; users: { avatar_url: string | null } | null };
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
          select: "match_id,player_id,team,players(id,name,user_id,users(avatar_url))",
        },
      }),
  });

  const { data: attendance } = useQuery({
    queryKey: ["attendance", matchId],
    queryFn: () =>
      api<AttendanceRow[]>("/attendance", {
        params: {
          match_id: `eq.${matchId}`,
          select: "player_id,status,players(id,name,user_id,users(avatar_url))",
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
    mutationFn: ({ playerId, newTeam }: { playerId: string; newTeam: number }) =>
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

  if (isLoading) return <div className="loading">Cargando equipos...</div>;

  const team1 = teams?.filter((t) => t.team === 1) ?? [];
  const team2 = teams?.filter((t) => t.team === 2) ?? [];

  // Players going but not assigned to any team
  const assignedPlayerIds = new Set(teams?.map((t) => t.player_id) ?? []);
  const goingAttendance = attendance?.filter((a) => a.status === "going") ?? [];
  const bench = goingAttendance.filter((a) => !assignedPlayerIds.has(a.player_id));

  const goingPlayerIds = new Set(goingAttendance.map((a) => a.player_id));

  // Build rating lookup: "playerId:attributeId" -> rating
  const ratingMap = new Map<string, number>();
  if (ratings) {
    for (const r of ratings) {
      ratingMap.set(`${r.player_id}:${r.attribute_id}`, r.rating);
    }
  }

  function attrSum(teamPlayers: TeamAssignment[], attributeId: string): number {
    return teamPlayers.reduce(
      (sum, t) => sum + (ratingMap.get(`${t.player_id}:${attributeId}`) ?? 0),
      0
    );
  }

  function totalSum(teamPlayers: TeamAssignment[]): number {
    if (!attributes?.length) return 0;
    return attributes.reduce((sum, attr) => sum + attrSum(teamPlayers, attr.id), 0);
  }

  const hasAttrs = !!attributes?.length;
  const t1Total = totalSum(team1);
  const t2Total = totalSum(team2);

  if (!teams?.length && !bench.length) return null;

  return (
    <div>
      {(team1.length > 0 || team2.length > 0) && (
        <>
          <div className="teams-container">
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
          {hasAttrs && (
            <div className="teams-diff">
              <h4>Diferencia entre equipos</h4>
              <div className="team-axis-sums">
                {attributes.map((attr) => {
                  const diff = attrSum(team1, attr.id) - attrSum(team2, attr.id);
                  return (
                    <span
                      key={attr.id}
                      className={`team-axis-chip ${diff === 0 ? "diff-even" : "diff-uneven"}`}
                    >
                      {attr.name}: {diff > 0 ? "+" : ""}{diff}
                    </span>
                  );
                })}
                <span
                  className={`team-axis-chip ${t1Total === t2Total ? "diff-even" : "diff-uneven"}`}
                >
                  <strong>Total: {t1Total - t2Total > 0 ? "+" : ""}{t1Total - t2Total}</strong>
                </span>
              </div>
            </div>
          )}
        </>
      )}

      {bench.length > 0 && (
        <div style={{ marginTop: "1rem" }}>
          <h3>Sin asignar ({bench.length})</h3>
          <ul className="member-list">
            {bench.map((a) => (
              <li key={a.player_id} className="member-item">
                <div className="member-info">
                  {a.players.users?.avatar_url && (
                    <img src={a.players.users.avatar_url} alt="" className="member-avatar" />
                  )}
                  <span>{a.players.name}</span>
                  {attributes && attributes.length > 0 && (
                    <span className="player-axis-ratings">
                      {attributes.map((attr) => (
                        <span key={attr.id} className="player-rating-badge" title={attr.name}>
                          {attr.abbreviation ?? attr.name}: {ratingMap.get(`${a.player_id}:${attr.id}`) ?? "-"}
                        </span>
                      ))}
                    </span>
                  )}
                </div>
                {isAdmin && (
                  <div style={{ display: "flex", gap: "0.25rem" }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => addToTeam.mutate({ playerId: a.player_id, team: 1 })}
                      disabled={addToTeam.isPending}
                    >
                      → Eq 1
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => addToTeam.mutate({ playerId: a.player_id, team: 2 })}
                      disabled={addToTeam.isPending}
                    >
                      → Eq 2
                    </button>
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
  swapTeam: { mutate: (v: { playerId: string; newTeam: number }) => void; isPending: boolean };
  removeFromTeam: { mutate: (playerId: string) => void; isPending: boolean };
  swapBefore?: boolean;
  goingPlayerIds: Set<string>;
}) {
  const hasAttrs = !!attributes?.length;

  const actionButtons = (playerId: string) =>
    isAdmin ? (
      <div style={{ display: "flex", gap: "0.25rem" }}>
        {swapBefore && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => swapTeam.mutate({ playerId, newTeam: swapDirection })}
            disabled={swapTeam.isPending}
          >
            {swapLabel}
          </button>
        )}
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => removeFromTeam.mutate(playerId)}
          disabled={removeFromTeam.isPending}
          title="Mandar al banco"
        >
          ✕
        </button>
        {!swapBefore && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => swapTeam.mutate({ playerId, newTeam: swapDirection })}
            disabled={swapTeam.isPending}
          >
            {swapLabel}
          </button>
        )}
      </div>
    ) : null;

  return (
    <div className="team-column">
      <h3>
        {label} ({players.length})
        {hasAttrs ? <span className="team-total"> — {total} pts</span> : null}
      </h3>
      {hasAttrs ? (
        <div className="team-axis-sums">
          {attributes.map((attr) => (
            <span key={attr.id} className="team-axis-chip">
              {attr.name}: {attrSum(attr.id)}
            </span>
          ))}
        </div>
      ) : null}
      <ul>
        {players.map((t) => {
          const isNotGoing = !goingPlayerIds.has(t.player_id);
          return (
          <li key={t.player_id} className={`member-item${isNotGoing ? " player-not-going" : ""}`}>
            <div className="member-info">
              {t.players.users?.avatar_url && (
                <img
                  src={t.players.users.avatar_url}
                  alt=""
                  className="member-avatar"
                />
              )}
              <span>{t.players.name}</span>
              {hasAttrs && (
                <span className="player-axis-ratings">
                  {attributes.map((attr) => (
                    <span key={attr.id} className="player-rating-badge" title={attr.name}>
                      {attr.abbreviation ?? attr.name}: {ratingMap.get(`${t.player_id}:${attr.id}`) ?? "-"}
                    </span>
                  ))}
                </span>
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
