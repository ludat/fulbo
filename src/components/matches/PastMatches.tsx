import { useParams } from "react-router-dom";
import { MatchList } from "./MatchList";
import { BackLink } from "../ui/BackLink";

export function PastMatches() {
  const { groupId } = useParams<{ groupId: string }>();

  return (
    <div>
      <BackLink to={`/groups/${groupId}`}>&larr; Volver al grupo</BackLink>
      <h1>Todos los Partidos</h1>
      <MatchList groupId={groupId!} filter="all" />
    </div>
  );
}
