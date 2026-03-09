import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "react-oidc-context";
import { api } from "../../api/postgrest";

type PlayerAttribute = {
  id: string;
  name: string;
  abbreviation: string | null;
  description: string | null;
  min_rating: number;
  max_rating: number;
};

type Player = {
  id: string;
  name: string;
  user_id: string | null;
  users: { avatar_url: string | null } | null;
};

type Vote = {
  player_id: string;
  attribute_id: string;
  rating: number;
};

export function PlayerVoting() {
  const { groupId } = useParams<{ groupId: string }>();
  const auth = useAuth();
  const currentUserId = auth.user?.profile.sub;

  const { data: attributes, error: attrsError } = useQuery({
    queryKey: ["player_attributes", groupId],
    queryFn: () =>
      api<PlayerAttribute[]>("/player_attributes", {
        params: {
          group_id: `eq.${groupId}`,
          order: "display_order.asc,name.asc",
        },
      }),
  });

  const { data: players, error: playersError } = useQuery({
    queryKey: ["players", groupId],
    queryFn: () =>
      api<Player[]>("/players", {
        params: {
          group_id: `eq.${groupId}`,
          select: "id,name,user_id,users!players_user_id_fkey(avatar_url)",
        },
      }),
  });

  const { data: votes, error: votesError } = useQuery({
    queryKey: ["player_attribute_votes", groupId],
    queryFn: () =>
      api<Vote[]>("/player_attribute_votes", {
        params: {
          group_id: `eq.${groupId}`,
          select: "player_id,attribute_id,rating",
        },
      }),
  });

  const anyError = attrsError || playersError || votesError;
  if (anyError) return <div className="error">Error: {anyError.message}</div>;

  if (!attributes || !players || !votes)
    return <div className="loading">Cargando...</div>;

  if (!attributes.length) {
    return (
      <div>
        <div className="page-header">
          <Link to={`/groups/${groupId}`} className="back-link">
            &larr; Volver al grupo
          </Link>
        </div>
        <h1>Votar Jugadores</h1>
        <p className="empty-state">No hay atributos definidos todavia.</p>
      </div>
    );
  }

  const voteMap = new Map<string, number>();
  for (const v of votes) {
    voteMap.set(`${v.player_id}:${v.attribute_id}`, v.rating);
  }

  // Filter out the current user's own player
  const otherPlayers = players.filter((p) => p.user_id !== currentUserId);

  return (
    <div>
      <div className="page-header">
        <Link to={`/groups/${groupId}`} className="back-link">
          &larr; Volver al grupo
        </Link>
      </div>

      <h1>Votar Jugadores</h1>
      <p className="subtitle">Vota los atributos de los demas jugadores.</p>

      <div style={{ overflowX: "auto" }}>
        <table className="ratings-table">
          <thead>
            <tr>
              <th>Jugador</th>
              {attributes.map((attr) => (
                <th key={attr.id} title={`${attr.name} [${attr.min_rating}–${attr.max_rating}]`}>
                  {attr.abbreviation ?? attr.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {otherPlayers.map((p) => (
              <tr key={p.id}>
                <td>
                  <div className="member-info">
                    {p.users?.avatar_url && (
                      <img src={p.users.avatar_url} alt="" className="member-avatar" />
                    )}
                    <span>{p.name}</span>
                  </div>
                </td>
                {attributes.map((attr) => (
                  <td key={attr.id}>
                    <VoteCell
                      groupId={groupId!}
                      playerId={p.id}
                      attributeId={attr.id}
                      minRating={attr.min_rating}
                      maxRating={attr.max_rating}
                      value={voteMap.get(`${p.id}:${attr.id}`)}
                      currentUserId={currentUserId!}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type SaveStatus = "saving" | "saved" | "error" | null;

function VoteCell({
  groupId,
  playerId,
  attributeId,
  minRating,
  maxRating,
  value,
  currentUserId,
}: {
  groupId: string;
  playerId: string;
  attributeId: string;
  minRating: number;
  maxRating: number;
  value: number | undefined;
  currentUserId: string;
}) {
  const queryClient = useQueryClient();
  const [localValue, setLocalValue] = useState<string>(value != null ? String(value) : "");
  const [status, setStatus] = useState<SaveStatus>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

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

  const upsertVote = useMutation({
    mutationFn: (rating: number) =>
      api("/player_attribute_votes", {
        method: "POST",
        body: {
          group_id: groupId,
          player_id: playerId,
          attribute_id: attributeId,
          voter_id: currentUserId,
          rating,
        },
        headers: {
          Prefer: "resolution=merge-duplicates,return=representation",
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["player_attribute_votes", groupId] });
      showSaved();
    },
    onError: () => setStatus("error"),
  });

  const deleteVote = useMutation({
    mutationFn: () =>
      api("/player_attribute_votes", {
        method: "DELETE",
        params: {
          group_id: `eq.${groupId}`,
          player_id: `eq.${playerId}`,
          attribute_id: `eq.${attributeId}`,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["player_attribute_votes", groupId] });
      showSaved();
    },
    onError: () => setStatus("error"),
  });

  const isSaving = upsertVote.isPending || deleteVote.isPending;
  const displayStatus = isSaving ? "saving" : status;

  function save() {
    const trimmed = localValue.trim();
    if (trimmed === "") {
      if (value != null) {
        setStatus("saving");
        deleteVote.mutate();
      }
    } else {
      const num = parseInt(trimmed);
      if (!isNaN(num) && num !== value) {
        if (num < minRating || num > maxRating) {
          setStatus("error");
          return;
        }
        setStatus("saving");
        upsertVote.mutate(num);
      }
    }
  }

  return (
    <div className="rating-cell">
      <input
        type="number"
        min={minRating}
        max={maxRating}
        value={localValue}
        onChange={(e) => { if (!isSaving) setLocalValue(e.target.value); }}
        onBlur={() => { if (!isSaving) save(); }}
        onKeyDown={(e) => { if (e.key === "Enter" && !isSaving) save(); }}
        className={`rating-input${isSaving ? " rating-input-saving" : ""}${displayStatus === "error" ? " rating-input-error" : ""}`}
      />
      {displayStatus === "saving" && (
        <span className="rating-status rating-status-saving" title="Guardando...">&#8987;</span>
      )}
      {displayStatus === "saved" && (
        <span className="rating-status rating-status-saved" title="Guardado">&#10003;</span>
      )}
      {displayStatus === "error" && (
        <span className="rating-status rating-status-error" title="Error al guardar">&#10007;</span>
      )}
    </div>
  );
}
