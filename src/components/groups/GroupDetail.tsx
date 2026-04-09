import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { useAuth } from "react-oidc-context";
import { api } from "../../api/postgrest";
import { MatchList } from "../matches/MatchList";
import { LinkButton } from "../ui/Button";
import { BackLink } from "../ui/BackLink";
import { InfoTooltip } from "../ui/InfoTooltip";
import { GroupNav } from "./GroupNav";

type Group = {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
};

type Admin = {
  user_id: string;
};

export function GroupDetail() {
  const { groupId } = useParams<{ groupId: string }>();
  const auth = useAuth();
  const currentUserId = auth.user?.profile.sub;

  const { data: groups, isLoading } = useQuery({
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
        params: {
          group_id: `eq.${groupId}`,
          select: "user_id",
        },
      }),
  });

  const adminsLoaded = admins !== undefined;
  const isAdmin = admins?.some((a) => a.user_id === currentUserId) ?? false;

  const group = groups?.[0];

  if (isLoading || !adminsLoaded)
    return (
      <div className="text-text-secondary p-8 text-center">Cargando...</div>
    );
  if (!group)
    return <div className="text-danger text-sm">Grupo no encontrado</div>;

  return (
    <div>
      <div className="mb-4">
        <h1>{group.name}</h1>
        {group.description && (
          <p className="text-text-secondary">{group.description}</p>
        )}
      </div>

      <GroupNav groupId={groupId!} isAdmin={isAdmin} />

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg">
            Próximos Partidos
            <InfoTooltip text="Partidos programados para la próxima semana en este grupo" />
          </h2>
          {isAdmin && (
            <LinkButton to={`/groups/${groupId}/matches/new`}>
              Programar Partido
            </LinkButton>
          )}
        </div>
        <MatchList groupId={groupId!} />
        <BackLink to={`/groups/${groupId}/matches/past`} className="mt-2">
          Ver todos los partidos
        </BackLink>
      </section>
    </div>
  );
}
