import { useOutletContext } from "react-router-dom";
import { AttendanceToggle } from "./AttendanceToggle";
import { AttendanceList } from "./AttendanceList";

type MatchContext = {
  matchId: string;
  groupId: string;
  currentPlayerId: string | null;
  isAdmin: boolean | undefined;
  playerQuota: number | null;
};

export function MatchPlayers() {
  const { matchId, groupId, currentPlayerId, playerQuota } =
    useOutletContext<MatchContext>();

  return (
    <>
      <section className="mt-8">
        <h2 className="mb-3 text-lg">Tu Asistencia</h2>
        <AttendanceToggle matchId={matchId} playerId={currentPlayerId} />
      </section>
      <section className="mt-8">
        <h2 className="mb-3 text-lg">Quienes van</h2>
        <AttendanceList matchId={matchId} groupId={groupId} playerQuota={playerQuota} />
      </section>
    </>
  );
}
