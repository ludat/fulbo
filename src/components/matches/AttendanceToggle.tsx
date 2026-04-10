import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/postgrest";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";

type Attendance = { match_id: string; player_id: string; status: string };

const statuses = ["going", "maybe", "not_going"] as const;
const statusLabels: Record<string, string> = {
  going: "Voy",
  maybe: "Capaz",
  not_going: "No voy",
};

export function AttendanceToggle({
  matchId,
  playerId,
}: {
  matchId: string;
  playerId: string | null;
}) {
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
      queryClient.invalidateQueries({ queryKey: ["attendance", matchId] });
    },
  });

  const remove = useMutation({
    mutationFn: () =>
      api("/attendance", {
        method: "DELETE",
        params: { match_id: `eq.${matchId}`, player_id: `eq.${playerId}` },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance", matchId] });
    },
  });

  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  if (!playerId) return null;

  const handleStatusChange = (action: () => void) => {
    if (currentStatus === "going") {
      setPendingAction(() => action);
    } else {
      action();
    }
  };

  return (
    <>
      <div className="mb-6 flex gap-2">
        {statuses.map((s) => (
          <Button
            key={s}
            variant={currentStatus === s ? "active" : "secondary"}
            onClick={() => {
              if (s !== "going" && currentStatus === "going") {
                handleStatusChange(() => upsert.mutate(s));
              } else {
                upsert.mutate(s);
              }
            }}
            disabled={upsert.isPending || remove.isPending}
          >
            {statusLabels[s]}
          </Button>
        ))}
        {currentStatus && (
          <Button
            variant="danger"
            onClick={() => handleStatusChange(() => remove.mutate())}
            disabled={upsert.isPending || remove.isPending}
          >
            Borrar respuesta
          </Button>
        )}
      </div>
      {pendingAction && (
        <ConfirmDialog
          message="Si dejás de ir, perdés tu lugar. ¿Estás seguro?"
          confirmLabel="Sí, cambiar"
          onConfirm={() => {
            pendingAction();
            setPendingAction(null);
          }}
          onCancel={() => setPendingAction(null)}
        />
      )}
    </>
  );
}
