import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "react-oidc-context";
import { api } from "../../api/postgrest";
import { GroupNav } from "./GroupNav";
import { AvailabilityGrid } from "./AvailabilityGrid";
import { useAvailability } from "./useAvailability";
import { useGroupAvailability } from "./useGroupAvailability";

type Group = {
  id: string;
  name: string;
};

type Admin = {
  user_id: string;
};

type Player = {
  id: string;
};

export function WeeklyAvailability() {
  const { groupId } = useParams<{ groupId: string }>();
  const auth = useAuth();
  const currentUserId = auth.user?.profile.sub;

  const { data: groups, isLoading: groupLoading } = useQuery({
    queryKey: ["groups", groupId],
    queryFn: () =>
      api<Group[]>("/groups", {
        params: { id: `eq.${groupId}`, deleted_at: "is.null" },
      }),
  });

  const { data: admins } = useQuery({
    queryKey: ["group_members", groupId],
    queryFn: () =>
      api<Admin[]>("/group_members", {
        params: { group_id: `eq.${groupId}`, select: "user_id" },
      }),
  });

  const { data: players } = useQuery({
    queryKey: ["players", groupId, currentUserId],
    queryFn: () =>
      api<Player[]>("/players", {
        params: {
          group_id: `eq.${groupId}`,
          user_id: `eq.${currentUserId}`,
          disabled_at: "is.null",
          select: "id",
        },
      }),
    enabled: !!currentUserId,
  });

  const isAdmin = admins?.some((a) => a.user_id === currentUserId) ?? false;
  const playerId = players?.[0]?.id;
  const group = groups?.[0];

  const {
    selected,
    pending,
    isLoading: availLoading,
    startDrag,
    continueDrag,
    commitDrag,
    toggleDay,
  } = useAvailability(groupId!, playerId);

  const { data: summaryData } = useGroupAvailability(groupId!);
  const summary = new Map<string, { count: number; names: string[] }>();
  for (const row of summaryData ?? []) {
    summary.set(`${row.day_of_week}:${row.time_slot}`, {
      count: row.player_count,
      names: row.player_names,
    });
  }

  if (groupLoading)
    return (
      <div className="text-text-secondary p-8 text-center">Cargando...</div>
    );
  if (!group)
    return <div className="text-danger text-sm">Grupo no encontrado</div>;

  return (
    <div>
      <h1 className="mb-4">{group.name}</h1>
      <GroupNav groupId={groupId!} isAdmin={isAdmin} />

      <div className="mb-4">
        <h2 className="text-lg">Disponibilidad</h2>
        <p className="text-text-secondary mt-1 text-sm">
          Marcá los horarios en los que podés jugar. Hacé click o arrastrá para
          seleccionar.
        </p>
      </div>

      {!playerId && !availLoading ? (
        <p className="text-text-secondary text-sm italic">
          No sos jugador de este grupo.
        </p>
      ) : availLoading ? (
        <div className="text-text-secondary p-8 text-center">Cargando...</div>
      ) : (
        <AvailabilityGrid
          selected={selected}
          pending={pending}
          summary={summary}
          onStartDrag={startDrag}
          onContinueDrag={continueDrag}
          onCommitDrag={commitDrag}
          onToggleDay={toggleDay}
        />
      )}
    </div>
  );
}
