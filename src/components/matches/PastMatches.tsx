import { useParams, Link } from "react-router-dom";
import { MatchList } from "./MatchList";

export function PastMatches() {
  const { groupId } = useParams<{ groupId: string }>();

  return (
    <div>
      <Link to={`/groups/${groupId}`} className="back-link">
        &larr; Volver al grupo
      </Link>
      <h1>Todos los Partidos</h1>
      <MatchList groupId={groupId!} filter="all" />
    </div>
  );
}
