import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/postgrest";

type Attendance = {
  match_id: string;
  player_id: string;
  status: string;
};

const statuses = ["going", "maybe", "not_going"] as const;
const statusLabels: Record<string, string> = {
  going: "Voy",
  maybe: "Capaz",
  not_going: "No voy",
};

export function AttendanceToggle({ matchId, playerId }: { matchId: string; playerId: string | null }) {
  const queryClient = useQueryClient();

  const { data: attendance } = useQuery({
    queryKey: ["attendance", matchId, playerId],
    queryFn: () =>
      api<Attendance[]>("/attendance", {
        params: { match_id: `eq.${matchId}`, player_id: `eq.${playerId}` },
      }),
    enabled: !!playerId,
  });

  const currentStatus = attendance?.[0]?.status;

  const upsert = useMutation({
    mutationFn: (status: string) =>
      api("/attendance", {
        method: "POST",
        body: { match_id: matchId, player_id: playerId, status },
        headers: {
          Prefer: "resolution=merge-duplicates,return=representation",
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["attendance", matchId],
      });
    },
  });

  const remove = useMutation({
    mutationFn: () =>
      api("/attendance", {
        method: "DELETE",
        params: { match_id: `eq.${matchId}`, player_id: `eq.${playerId}` },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["attendance", matchId],
      });
    },
  });

  if (!playerId) return null;

  return (
    <div className="attendance-toggle">
      {statuses.map((s) => (
        <button
          key={s}
          className={`btn ${currentStatus === s ? "btn-active" : "btn-secondary"}`}
          onClick={() => upsert.mutate(s)}
          disabled={upsert.isPending || remove.isPending}
        >
          {statusLabels[s]}
        </button>
      ))}
      {currentStatus && (
        <button
          className="btn btn-danger"
          onClick={() => remove.mutate()}
          disabled={upsert.isPending || remove.isPending}
        >
          Borrar respuesta
        </button>
      )}
    </div>
  );
}
