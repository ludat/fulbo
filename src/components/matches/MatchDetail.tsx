import clsx from "clsx";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "react-oidc-context";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { api, rpc } from "../../api/postgrest";
import { AttendanceToggle } from "./AttendanceToggle";
import { AttendanceList } from "./AttendanceList";
import { TeamDisplay } from "./TeamDisplay";
import { ConfirmButton } from "../ui/ConfirmButton";
import { Button, LinkButton } from "../ui/Button";
import { BackLink } from "../ui/BackLink";

type Admin = { user_id: string };
type Match = {
  id: string;
  group_id: string;
  location: string | null;
  starts_at: string;
  notes: string | null;
  created_by: string;
};
type Player = { id: string };
type Tab = "jugadores" | "equipos";

export function MatchDetail() {
  const { groupId, matchId } = useParams<{
    groupId: string;
    matchId: string;
  }>();
  const [activeTab, setActiveTab] = useState<Tab>("jugadores");
  const auth = useAuth();
  const currentUserId = auth.user?.profile.sub;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: matches, isLoading } = useQuery({
    queryKey: ["matches", groupId, matchId],
    queryFn: () =>
      api<Match[]>("/matches", {
        params: { id: `eq.${matchId}`, deleted_at: "is.null" },
      }),
  });
  const match = matches?.[0];

  const { data: admins } = useQuery({
    queryKey: ["group_members", groupId],
    queryFn: () =>
      api<Admin[]>("/group_members", {
        params: { group_id: `eq.${groupId}`, select: "user_id" },
      }),
    enabled: !!match,
  });

  const { data: currentPlayerArr } = useQuery({
    queryKey: ["players", groupId, "current"],
    queryFn: () =>
      api<Player[]>("/players", {
        params: {
          group_id: `eq.${groupId}`,
          user_id: `eq.${currentUserId}`,
          select: "id",
        },
      }),
    enabled: !!groupId && !!currentUserId,
  });
  const currentPlayerId = currentPlayerArr?.[0]?.id ?? null;
  const isAdmin = admins?.some((a) => a.user_id === currentUserId);

  const repeatMatch = useMutation({
    mutationFn: () => {
      const nextWeek = new Date(
        new Date(match!.starts_at).getTime() + 7 * 24 * 60 * 60 * 1000,
      );
      return api<{ id: string }[]>("/matches", {
        method: "POST",
        body: {
          group_id: match!.group_id,
          location: match!.location,
          starts_at: nextWeek.toISOString(),
          notes: match!.notes,
        },
        headers: { Prefer: "return=representation" },
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["matches", groupId] });
      navigate(`/groups/${groupId}/matches/${data[0].id}`);
    },
  });

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

  const deleteMatch = useMutation({
    mutationFn: () =>
      api("/matches", {
        method: "PATCH",
        params: { id: `eq.${matchId}` },
        body: { deleted_at: new Date().toISOString() },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matches", groupId] });
      navigate(`/groups/${groupId}`);
    },
  });

  if (isLoading)
    return (
      <div className="text-text-secondary p-8 text-center">Cargando...</div>
    );
  if (!match)
    return <div className="text-danger text-sm">Partido no encontrado</div>;

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <BackLink to={`/groups/${groupId}`}>&larr; Volver al grupo</BackLink>
        {isAdmin && (
          <div className="flex gap-2">
            <ConfirmButton
              label="Eliminar Partido"
              onConfirm={() => deleteMatch.mutate()}
              disabled={deleteMatch.isPending}
            />
            <Button
              variant="secondary"
              onClick={() => repeatMatch.mutate()}
              disabled={repeatMatch.isPending}
            >
              Repetir Partido
            </Button>
            <LinkButton
              to={`/groups/${groupId}/matches/${matchId}/edit`}
              variant="secondary"
            >
              Editar
            </LinkButton>
          </div>
        )}
      </div>
      <h1>
        {format(new Date(match.starts_at), "EEEE d 'de' MMMM, yyyy - HH:mm", {
          locale: es,
        })}
      </h1>
      <div className="mb-6 [&>p]:mb-2">
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

      <div className="border-border mt-6 flex border-b-2">
        {(["jugadores", "equipos"] as const).map((tab) => (
          <button
            key={tab}
            className={clsx(
              "-mb-0.5 cursor-pointer border-0 border-b-2 border-solid bg-transparent px-5 py-2 text-base font-medium transition-colors",
              activeTab === tab
                ? "text-primary border-b-primary"
                : "text-text-secondary border-b-transparent",
            )}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "jugadores" ? "Jugadores" : "Equipos"}
          </button>
        ))}
      </div>

      {activeTab === "jugadores" && (
        <>
          <section className="mt-8">
            <h2 className="mb-3 text-lg">Tu Asistencia</h2>
            <AttendanceToggle matchId={matchId!} playerId={currentPlayerId} />
          </section>
          <section className="mt-8">
            <h2 className="mb-3 text-lg">Quienes van</h2>
            <AttendanceList matchId={matchId!} groupId={groupId!} />
          </section>
        </>
      )}

      {activeTab === "equipos" && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg">Equipos</h2>
          {isAdmin && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Button
                onClick={() => generateTeams.mutate()}
                disabled={generateTeams.isPending}
              >
                Generar Equipos
              </Button>
              <Button
                variant="secondary"
                onClick={() => shuffleTeams.mutate()}
                disabled={shuffleTeams.isPending}
              >
                Generar Equipos al azar
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
          <TeamDisplay
            matchId={matchId!}
            groupId={groupId!}
            isAdmin={isAdmin}
          />
        </section>
      )}
    </div>
  );
}
