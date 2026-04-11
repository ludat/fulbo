import clsx from "clsx";
import React, { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { api } from "../../api/postgrest";
import { Button } from "../ui/Button";
import { BackLink } from "../ui/BackLink";
import { tableClasses } from "../ui/Table";

type PlayerAttribute = {
  id: string;
  name: string;
  description: string | null;
  abbreviation: string | null;
  display_order: number;
  min_rating: number;
  max_rating: number;
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

type VoteAverage = {
  player_id: string;
  attribute_id: string;
  avg_rating: number;
  vote_count: number;
};

type IndividualVote = {
  player_id: string;
  attribute_id: string;
  voter_id: string;
  rating: number;
  users: { display_name: string } | null;
};

export function PlayerRatings() {
  const { groupId } = useParams<{ groupId: string }>();
  const queryClient = useQueryClient();
  const [expandedPlayers, setExpandedPlayers] = useState<Set<string>>(
    new Set(),
  );

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
          disabled_at: "is.null",
          select: "id,name,user_id,users!players_user_id_fkey(avatar_url)",
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

  const { data: voteAverages } = useQuery({
    queryKey: ["player_vote_averages", groupId],
    queryFn: () =>
      api<VoteAverage[]>("/player_vote_averages", {
        params: { group_id: `eq.${groupId}` },
      }),
  });

  const { data: individualVotes } = useQuery({
    queryKey: ["player_attribute_votes_all", groupId],
    queryFn: () =>
      api<IndividualVote[]>("/player_attribute_votes", {
        params: {
          group_id: `eq.${groupId}`,
          select:
            "player_id,attribute_id,voter_id,rating,users!player_attribute_votes_voter_id_fkey(display_name)",
        },
      }),
    enabled: expandedPlayers.size > 0,
  });

  const applyVotes = useMutation({
    mutationFn: (
      ratings: {
        group_id: string;
        player_id: string;
        attribute_id: string;
        rating: number;
      }[],
    ) =>
      api("/player_ratings", {
        method: "POST",
        body: ratings,
        headers: {
          Prefer: "resolution=merge-duplicates,return=representation",
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["player_ratings", groupId] });
    },
  });

  if (!attributes || !players || !ratings)
    return (
      <div className="text-text-secondary p-8 text-center">Cargando...</div>
    );

  if (!attributes.length) {
    return (
      <div>
        <BackLink to={`/groups/${groupId}/stats`}>
          &larr; Volver a stats
        </BackLink>
        <h1>Puntuaciones</h1>
        <p className="text-text-secondary p-6 text-center italic">
          Primero necesitas{" "}
          <a href={`/groups/${groupId}/attributes`}>crear atributos</a>.
        </p>
      </div>
    );
  }

  const ratingMap = new Map<string, number>();
  for (const r of ratings) {
    ratingMap.set(`${r.player_id}:${r.attribute_id}`, r.rating);
  }

  function getRating(
    playerId: string,
    attributeId: string,
  ): number | undefined {
    return ratingMap.get(`${playerId}:${attributeId}`);
  }

  return (
    <div>
      <BackLink to={`/groups/${groupId}/stats`}>&larr; Volver a stats</BackLink>
      <h1>Puntuaciones</h1>

      <div className="overflow-x-auto">
        <table className={tableClasses}>
          <thead>
            <tr>
              <th>Jugador</th>
              {attributes.map((attr) => (
                <th key={attr.id} title={attr.description ?? attr.name}>
                  {attr.abbreviation ?? attr.name}
                </th>
              ))}
              <th>Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => {
              const total = attributes.reduce(
                (sum, attr) => sum + (getRating(p.id, attr.id) ?? 0),
                0,
              );
              const isExpanded = expandedPlayers.has(p.id);

              const playerAvgs =
                isExpanded && voteAverages
                  ? voteAverages.filter((va) => va.player_id === p.id)
                  : [];
              const avgMap = new Map<string, VoteAverage>();
              for (const va of playerAvgs) avgMap.set(va.attribute_id, va);

              const playerVotes =
                isExpanded && individualVotes
                  ? individualVotes.filter((v) => v.player_id === p.id)
                  : [];
              const voterIds = [...new Set(playerVotes.map((v) => v.voter_id))];

              function toggleExpanded() {
                setExpandedPlayers((prev) => {
                  const next = new Set(prev);
                  if (next.has(p.id)) next.delete(p.id);
                  else next.add(p.id);
                  return next;
                });
              }

              return (
                <React.Fragment key={p.id}>
                  <tr>
                    <td>
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
                    <td>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={toggleExpanded}
                      >
                        {isExpanded ? "Ocultar votos" : "Ver votos"}
                      </Button>
                    </td>
                  </tr>

                  {isExpanded && playerAvgs.length > 0 && (
                    <tr className="bg-gray-50">
                      <td className="text-text-secondary !pl-8">Promedio</td>
                      {attributes.map((attr) => {
                        const va = avgMap.get(attr.id);
                        return (
                          <td
                            key={attr.id}
                            className="text-text-secondary"
                            title={va ? `${va.vote_count} votos` : ""}
                          >
                            {va
                              ? `${Number(va.avg_rating).toFixed(1)} (${va.vote_count})`
                              : "–"}
                          </td>
                        );
                      })}
                      <td>
                        <Button
                          size="sm"
                          disabled={applyVotes.isPending}
                          onClick={() => {
                            const newRatings = playerAvgs.map((va) => ({
                              group_id: groupId!,
                              player_id: va.player_id,
                              attribute_id: va.attribute_id,
                              rating: Math.round(Number(va.avg_rating)),
                            }));
                            applyVotes.mutate(newRatings);
                          }}
                        >
                          Aplicar
                        </Button>
                      </td>
                      <td></td>
                    </tr>
                  )}

                  {isExpanded &&
                    voterIds.map((voterId) => {
                      const voterVotes = playerVotes.filter(
                        (v) => v.voter_id === voterId,
                      );
                      const voteMap = new Map<string, number>();
                      for (const v of voterVotes)
                        voteMap.set(v.attribute_id, v.rating);
                      const voterName =
                        voterVotes[0]?.users?.display_name ?? voterId;
                      return (
                        <tr key={voterId} className="bg-gray-100">
                          <td className="!pl-8 text-xs text-gray-400">
                            {voterName}
                          </td>
                          {attributes.map((attr) => (
                            <td key={attr.id} className="text-xs text-gray-400">
                              {voteMap.get(attr.id) ?? "–"}
                            </td>
                          ))}
                          <td></td>
                          <td></td>
                        </tr>
                      );
                    })}
                </React.Fragment>
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
  const [localValue, setLocalValue] = useState<string>(
    value != null ? String(value) : "",
  );
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setLocalValue(value != null ? String(value) : "");
  }
  const [status, setStatus] = useState<SaveStatus>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(
    () => () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    },
    [],
  );

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
    <div className="relative inline-block">
      <input
        type="number"
        value={localValue}
        onChange={(e) => {
          if (!isSaving) setLocalValue(e.target.value);
        }}
        onBlur={() => {
          if (!isSaving) save();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !isSaving) save();
        }}
        className={clsx(
          "border-border bg-surface w-14 [appearance:textfield] rounded border p-0.5 text-center text-sm [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
          isSaving && "opacity-60",
          displayStatus === "error" && "border-danger",
        )}
      />
      {displayStatus === "saving" && (
        <span
          className="pointer-events-none absolute top-1/2 -right-4 -translate-y-1/2 text-xs text-gray-400"
          title="Guardando..."
        >
          &#8987;
        </span>
      )}
      {displayStatus === "saved" && (
        <span
          className="animate-rating-fade-out pointer-events-none absolute top-1/2 -right-4 -translate-y-1/2 text-xs text-green-600"
          title="Guardado"
        >
          &#10003;
        </span>
      )}
      {displayStatus === "error" && (
        <span
          className="text-danger pointer-events-none absolute top-1/2 -right-4 -translate-y-1/2 text-xs"
          title="Error al guardar"
        >
          &#10007;
        </span>
      )}
    </div>
  );
}
