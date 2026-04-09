import { useOutletContext } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rpc } from "../../api/postgrest";
import { TeamDisplay } from "./TeamDisplay";
import { Button } from "../ui/Button";
import { InfoTooltip } from "../ui/InfoTooltip";

type MatchContext = {
  matchId: string;
  groupId: string;
  currentPlayerId: string | null;
  isAdmin: boolean | undefined;
};

export function MatchTeams() {
  const { matchId, groupId, isAdmin } = useOutletContext<MatchContext>();
  const queryClient = useQueryClient();

  const generateTeams = useMutation({
    mutationFn: () => rpc("generate_teams", { p_match_id: matchId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["match_teams", matchId] });
    },
  });

  const shuffleTeams = useMutation({
    mutationFn: () => rpc("shuffle_teams", { p_match_id: matchId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["match_teams", matchId] });
    },
  });

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg">Equipos</h2>
      {isAdmin && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Button
            onClick={() => generateTeams.mutate()}
            disabled={generateTeams.isPending}
          >
            Generar Equipos
            <InfoTooltip text="Arma equipos equilibrados usando las puntuaciones de los jugadores" />
          </Button>
          <Button
            variant="secondary"
            onClick={() => shuffleTeams.mutate()}
            disabled={shuffleTeams.isPending}
          >
            Generar Equipos al azar
            <InfoTooltip text="Arma equipos al azar sin tener en cuenta las puntuaciones" />
          </Button>
          {generateTeams.isError && (
            <span className="text-danger text-sm">
              {generateTeams.error?.message}
            </span>
          )}
          {shuffleTeams.isError && (
            <span className="text-danger text-sm">
              {shuffleTeams.error?.message}
            </span>
          )}
        </div>
      )}
      <TeamDisplay matchId={matchId} groupId={groupId} isAdmin={isAdmin} />
    </section>
  );
}
