import clsx from "clsx";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "react-oidc-context";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { api } from "../../api/postgrest";
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
  player_quota: number | null;
  created_by: string;
};
type Player = { id: string };

const tabClass =
  "px-5 py-2 text-base font-medium no-underline border-b-2 transition-colors cursor-pointer";
const activeClass = "text-primary border-b-primary";
const inactiveClass =
  "text-text-secondary border-b-transparent hover:text-text";

export function MatchDetail() {
  const { groupId, matchId } = useParams<{
    groupId: string;
    matchId: string;
  }>();
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

  const basePath = `/groups/${groupId}/matches/${matchId}`;

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
            <LinkButton to={`${basePath}/edit`} variant="secondary">
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

      <nav className="border-border mt-6 flex border-b-2">
        <NavLink
          to={basePath}
          end
          className={({ isActive }) =>
            clsx(tabClass, isActive ? activeClass : inactiveClass)
          }
        >
          Jugadores
        </NavLink>
        <NavLink
          to={`${basePath}/equipos`}
          className={({ isActive }) =>
            clsx(tabClass, isActive ? activeClass : inactiveClass)
          }
        >
          Equipos
        </NavLink>
      </nav>

      <Outlet
        context={{
          matchId: matchId!,
          groupId: groupId!,
          currentPlayerId,
          isAdmin,
          playerQuota: match.player_quota,
        }}
      />
    </div>
  );
}
