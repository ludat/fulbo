import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "react-oidc-context";
import { api } from "../../api/postgrest";

type Attendance = {
  match_id: string;
  user_id: string;
  status: string;
};

const statuses = ["going", "maybe", "not_going"] as const;
const statusLabels: Record<string, string> = {
  going: "Voy",
  maybe: "Capaz",
  not_going: "No voy",
};

export function AttendanceToggle({ matchId }: { matchId: string }) {
  const auth = useAuth();
  const userId = auth.user?.profile.sub;
  const queryClient = useQueryClient();

  const { data: attendance } = useQuery({
    queryKey: ["attendance", matchId, userId],
    queryFn: () =>
      api<Attendance[]>("/attendance", {
        params: { match_id: `eq.${matchId}`, user_id: `eq.${userId}` },
      }),
    enabled: !!userId,
  });

  const currentStatus = attendance?.[0]?.status;

  const upsert = useMutation({
    mutationFn: (status: string) =>
      api("/attendance", {
        method: "POST",
        body: { match_id: matchId, user_id: userId, status },
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

  return (
    <div className="attendance-toggle">
      {statuses.map((s) => (
        <button
          key={s}
          className={`btn ${currentStatus === s ? "btn-active" : "btn-secondary"}`}
          onClick={() => upsert.mutate(s)}
          disabled={upsert.isPending}
        >
          {statusLabels[s]}
        </button>
      ))}
    </div>
  );
}
