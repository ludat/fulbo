import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { addWeeks, format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { api } from "../../api/postgrest";
import { Card } from "../ui/Card";

type Match = {
  id: string;
  location: string | null;
  starts_at: string;
};

type MatchListProps = {
  groupId: string;
  filter?: "upcoming" | "all";
};

export function MatchList({ groupId, filter = "upcoming" }: MatchListProps) {
  const [now] = useState(() => new Date());

  const { data: matches, isLoading } = useQuery({
    queryKey: ["matches", groupId, filter],
    queryFn: () => {
      return api<Match[]>("/matches", {
        params:
          filter === "upcoming"
            ? {
                group_id: `eq.${groupId}`,
                deleted_at: "is.null",
                and: `(starts_at.gte.${now.toISOString()},starts_at.lte.${addWeeks(now, 1).toISOString()})`,
                order: "starts_at.asc",
              }
            : {
                group_id: `eq.${groupId}`,
                deleted_at: "is.null",
                order: "starts_at.desc",
              },
      });
    },
  });

  if (isLoading)
    return (
      <div className="text-text-secondary p-8 text-center">
        Cargando partidos...
      </div>
    );

  if (!matches?.length) {
    return (
      <p className="text-text-secondary p-6 text-center italic">
        {filter === "upcoming"
          ? "No hay proximos partidos."
          : "No hay partidos."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {matches.map((m) => (
        <Card to={`/groups/${groupId}/matches/${m.id}`} key={m.id}>
          <h3>
            {format(new Date(m.starts_at), "EEEE d MMM, HH:mm", { locale: es })}
          </h3>
          <p className="text-text-secondary text-sm">
            {filter === "upcoming" &&
              formatDistanceToNow(new Date(m.starts_at), {
                addSuffix: true,
                locale: es,
              })}
            {filter === "upcoming" && m.location && " · "}
            {m.location}
          </p>
        </Card>
      ))}
    </div>
  );
}
