import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { api } from "../../api/postgrest";
import { AttendanceToggle } from "./AttendanceToggle";
import { AttendanceList } from "./AttendanceList";

type Match = {
  id: string;
  group_id: string;
  location: string | null;
  starts_at: string;
  notes: string | null;
  created_by: string;
};

export function MatchDetail() {
  const { groupId, matchId } = useParams<{
    groupId: string;
    matchId: string;
  }>();

  const { data: matches, isLoading } = useQuery({
    queryKey: ["matches", groupId, matchId],
    queryFn: () =>
      api<Match[]>("/matches", { params: { id: `eq.${matchId}` } }),
  });

  const match = matches?.[0];

  if (isLoading) return <div className="loading">Cargando...</div>;
  if (!match) return <div className="error">Partido no encontrado</div>;

  return (
    <div>
      <Link to={`/groups/${groupId}`} className="back-link">
        &larr; Volver al grupo
      </Link>
      <h1>{format(new Date(match.starts_at), "EEEE d 'de' MMMM, yyyy - HH:mm", { locale: es })}</h1>
      <div className="match-info">
        {match.location && (
          <p>
            <strong>Donde:</strong> {match.location}
          </p>
        )}
        {match.notes && (
          <p>
            <strong>Notas:</strong> {match.notes}
          </p>
        )}
      </div>

      <section>
        <h2>Tu Asistencia</h2>
        <AttendanceToggle matchId={matchId!} />
      </section>

      <section>
        <h2>Quienes van</h2>
        <AttendanceList matchId={matchId!} groupId={groupId!} />
      </section>
    </div>
  );
}
