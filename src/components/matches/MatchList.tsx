import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { api } from "../../api/postgrest";

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
  const now = new Date().toISOString();
  const oneWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const params: Record<string, string> =
    filter === "upcoming"
      ? {
          group_id: `eq.${groupId}`,
          deleted_at: "is.null",
          and: `(starts_at.gte.${now},starts_at.lte.${oneWeek})`,
          order: "starts_at.asc",
        }
      : {
          group_id: `eq.${groupId}`,
          deleted_at: "is.null",
          order: "starts_at.desc",
        };

  const { data: matches, isLoading } = useQuery({
    queryKey: ["matches", groupId, filter],
    queryFn: () => api<Match[]>("/matches", { params }),
  });

  if (isLoading) return <div className="loading">Cargando partidos...</div>;

  if (!matches?.length) {
    return (
      <p className="empty-state">
        {filter === "upcoming" ? "No hay proximos partidos." : "No hay partidos."}
      </p>
    );
  }

  return (
    <div className="card-list">
      {matches.map((m) => (
        <Link
          to={`/groups/${groupId}/matches/${m.id}`}
          key={m.id}
          className="card"
        >
          <h3>{format(new Date(m.starts_at), "EEE d MMM, HH:mm", { locale: es })}</h3>
          {m.location && <p className="match-meta">{m.location}</p>}
        </Link>
      ))}
    </div>
  );
}
