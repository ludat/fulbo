import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
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
                  {attributes.map((attr) => (
                    <td key={attr.id}>
                      <RatingCell
                        groupId={groupId!}
                        playerId={p.id}
                        attributeId={attr.id}
                        value={getRating(p.id, attr.id)}
                      />
                    </td>
                  ))}
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

type SaveStatus = "saving" | "saved" | "error" | null;

function RatingCell({
  groupId,
  playerId,
  attributeId,
  value,
}: {
  groupId: string;
  playerId: string;
  attributeId: string;
  value: number | undefined;
}) {
  const queryClient = useQueryClient();
  const [localValue, setLocalValue] = useState<string>(value != null ? String(value) : "");
  const [status, setStatus] = useState<SaveStatus>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Sync local value when the server value changes (e.g. after refetch)
  const lastServerValue = useRef(value);
  useEffect(() => {
    if (value !== lastServerValue.current) {
      lastServerValue.current = value;
      setLocalValue(value != null ? String(value) : "");
    }
  }, [value]);

  useEffect(() => {
    return () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, []);

  function showSaved() {
    setStatus("saved");
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    fadeTimerRef.current = setTimeout(() => setStatus(null), 2000);
  }

  const upsertRating = useMutation({
    mutationFn: (rating: number) =>
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
      showSaved();
    },
    onError: () => setStatus("error"),
  });

  const deleteRating = useMutation({
    mutationFn: () =>
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
      showSaved();
    },
    onError: () => setStatus("error"),
  });

  const isSaving = upsertRating.isPending || deleteRating.isPending;
  const displayStatus = isSaving ? "saving" : status;

  function save() {
    const trimmed = localValue.trim();
    if (trimmed === "") {
      // Only delete if there was a value before
      if (value != null) {
        setStatus("saving");
        deleteRating.mutate();
      }
    } else {
      const num = parseInt(trimmed);
      if (!isNaN(num) && num !== value) {
        setStatus("saving");
        upsertRating.mutate(num);
      }
    }
  }

  return (
    <div className="rating-cell">
      <input
        type="number"
        value={localValue}
        onChange={(e) => { if (!isSaving) setLocalValue(e.target.value); }}
        onBlur={() => { if (!isSaving) save(); }}
        onKeyDown={(e) => { if (e.key === "Enter" && !isSaving) save(); }}
        className={`rating-input${isSaving ? " rating-input-saving" : ""}${displayStatus === "error" ? " rating-input-error" : ""}`}
      />
      {displayStatus === "saving" && (
        <span className="rating-status rating-status-saving" title="Guardando...">
          &#8987;
        </span>
      )}
      {displayStatus === "saved" && (
        <span className="rating-status rating-status-saved" title="Guardado">
          &#10003;
        </span>
      )}
      {displayStatus === "error" && (
        <span className="rating-status rating-status-error" title="Error al guardar">
          &#10007;
        </span>
      )}
    </div>
  );
}
