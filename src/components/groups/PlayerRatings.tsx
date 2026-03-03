import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { api } from "../../api/postgrest";

type PlayerAttribute = {
  id: string;
  name: string;
  description: string | null;
  abbreviation: string | null;
  display_order: number;
};

type Player = {
  id: string;
  name: string;
  user_id: string | null;
  users: { avatar_url: string | null } | null;
};

type PlayerRating = {
  player_id: string;
  attribute_id: string;
  rating: number;
};

export function PlayerRatings() {
  const { groupId } = useParams<{ groupId: string }>();
  const queryClient = useQueryClient();

  const { data: attributes } = useQuery({
    queryKey: ["player_attributes", groupId],
    queryFn: () =>
      api<PlayerAttribute[]>("/player_attributes", {
        params: {
          group_id: `eq.${groupId}`,
          order: "display_order.asc,name.asc",
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

  const { data: ratings } = useQuery({
    queryKey: ["player_ratings", groupId],
    queryFn: () =>
      api<PlayerRating[]>("/player_ratings", {
        params: {
          group_id: `eq.${groupId}`,
          select: "player_id,attribute_id,rating",
        },
      }),
  });

  const upsertRating = useMutation({
    mutationFn: ({
      playerId,
      attributeId,
      rating,
    }: {
      playerId: string;
      attributeId: string;
      rating: number;
    }) =>
      api("/player_ratings", {
        method: "POST",
        body: {
          group_id: groupId,
          player_id: playerId,
          attribute_id: attributeId,
          rating,
        },
        headers: {
          Prefer: "resolution=merge-duplicates,return=representation",
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["player_ratings", groupId] });
    },
  });

  const deleteRating = useMutation({
    mutationFn: ({ playerId, attributeId }: { playerId: string; attributeId: string }) =>
      api("/player_ratings", {
        method: "DELETE",
        params: {
          group_id: `eq.${groupId}`,
          player_id: `eq.${playerId}`,
          attribute_id: `eq.${attributeId}`,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["player_ratings", groupId] });
    },
  });

  if (!attributes || !players || !ratings)
    return <div className="loading">Cargando...</div>;

  if (!attributes.length) {
    return (
      <div>
        <div className="page-header">
          <Link to={`/groups/${groupId}`} className="back-link">
            &larr; Volver al grupo
          </Link>
        </div>
        <h1>Puntuaciones</h1>
        <p className="empty-state">
          Primero necesitas{" "}
          <Link to={`/groups/${groupId}/attributes`}>crear atributos</Link>.
        </p>
      </div>
    );
  }

  const ratingMap = new Map<string, number>();
  for (const r of ratings) {
    ratingMap.set(`${r.player_id}:${r.attribute_id}`, r.rating);
  }

  function getRating(playerId: string, attributeId: string): number | undefined {
    return ratingMap.get(`${playerId}:${attributeId}`);
  }

  return (
    <div>
      <div className="page-header">
        <Link to={`/groups/${groupId}`} className="back-link">
          &larr; Volver al grupo
        </Link>
      </div>

      <h1>Puntuaciones</h1>

      <div style={{ overflowX: "auto" }}>
        <table className="ratings-table">
          <thead>
            <tr>
              <th>Jugador</th>
              {attributes.map((attr) => (
                <th key={attr.id} title={attr.description ?? attr.name}>
                  {attr.abbreviation ?? attr.name}
                </th>
              ))}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => {
              const total = attributes.reduce(
                (sum, attr) => sum + (getRating(p.id, attr.id) ?? 0),
                0
              );
              return (
                <tr key={p.id}>
                  <td>
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
                  </td>
                  {attributes.map((attr) => {
                    const value = getRating(p.id, attr.id);
                    return (
                      <td key={attr.id}>
                        <select
                          value={value ?? ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "") {
                              deleteRating.mutate({
                                playerId: p.id,
                                attributeId: attr.id,
                              });
                            } else {
                              upsertRating.mutate({
                                playerId: p.id,
                                attributeId: attr.id,
                                rating: parseInt(val),
                              });
                            }
                          }}
                          className="rating-select"
                        >
                          <option value="">-</option>
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </td>
                    );
                  })}
                  <td>
                    <strong>{total}</strong>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
