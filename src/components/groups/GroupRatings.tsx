import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "react-oidc-context";
import { api } from "../../api/postgrest";
import { GroupHeader } from "./GroupHeader";
import { GroupNav } from "./GroupNav";
import { LinkButton } from "../ui/Button";
import clsx from "clsx";

type Group = {
  id: string;
  name: string;
  description: string | null;
};

type Admin = {
  user_id: string;
};

type Attribute = {
  id: string;
};

export function GroupRatings() {
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
        params: { group_id: `eq.${groupId}`, select: "user_id" },
      }),
  });

  const { data: attributes } = useQuery({
    queryKey: ["player_attributes", groupId, "exists"],
    queryFn: () =>
      api<Attribute[]>("/player_attributes", {
        params: { group_id: `eq.${groupId}`, select: "id" },
      }),
  });

  const isAdmin = admins?.some((a) => a.user_id === currentUserId) ?? false;
  const hasAttributes = (attributes?.length ?? 0) > 0;
  const group = groups?.[0];

  if (isLoading)
    return (
      <div className="text-text-secondary p-8 text-center">Cargando...</div>
    );
  if (!group)
    return <div className="text-danger text-sm">Grupo no encontrado</div>;
  // !hasAttributes && !isAdmin ? (
  //         <p className="text-text-secondary p-6 text-center italic">
  //           Todavía no hay atributos configurados. Un administrador del grupo
  //           necesita crearlos antes de poder votar.
  //         </p>
  //       ) :
  return (
    <div>
      <GroupHeader
        groupName={group.name}
        groupDescription={group.description}
      />
      <GroupNav groupId={groupId!} isAdmin={isAdmin} />

      {
        <div className="grid gap-4 sm:grid-cols-2">
          <div
            className={clsx("border-border rounded-lg border p-4", {
              "opacity-50": !isAdmin,
            })}
          >
            <h3 className="mb-2 text-lg font-semibold">Atributos</h3>
            <p className="text-text-secondary mb-3 text-sm">
              Los atributos definen{" "}
              <strong className="text-text">
                en qué se evalúa a cada jugador
              </strong>{" "}
              (ej: defensa, velocidad, pase). Se usan para{" "}
              <strong className="text-text">armar equipos más parejos</strong>.
            </p>
            {isAdmin ? (
              <LinkButton to={`/groups/${groupId}/attributes`}>
                Gestionar Atributos
              </LinkButton>
            ) : (
              <p className="text-text-secondary text-sm italic">
                Pedile a un admin que los configure.
              </p>
            )}
          </div>

          <div
            className={clsx("border-border rounded-lg border p-4", {
              "opacity-50": !hasAttributes,
            })}
          >
            <h3 className="mb-2 text-lg font-semibold">
              Opinar sobre jugadores
            </h3>
            <p className="text-text-secondary mb-3 text-sm">
              Valorá a los demás jugadores según cada atributo.{" "}
              <strong className="text-text">
                Las opiniones de todos se promedian
              </strong>{" "}
              y ayudan a los admins a definir las puntuaciones finales para{" "}
              <strong className="text-text">
                armar equipos más equilibrados
              </strong>
              .
            </p>
            {hasAttributes ? (
              <LinkButton to={`/groups/${groupId}/vote`}>Votar</LinkButton>
            ) : (
              <p className="text-text-secondary text-sm italic">
                Necesita atributos configurados.{" "}
                {!isAdmin && "Pedile a un admin que los configure."}
              </p>
            )}
          </div>

          <div
            className={clsx("border-border rounded-lg border p-4", {
              "opacity-50": !hasAttributes || !isAdmin,
            })}
          >
            <h3 className="mb-2 text-lg font-semibold">Puntuaciones</h3>
            <p className="text-text-secondary mb-3 text-sm">
              Las <strong className="text-text">puntuaciones oficiales</strong>{" "}
              de cada jugador,{" "}
              <strong className="text-text">definidas por los admins</strong> a
              partir de las opiniones del grupo. Se usan para generar equipos
              equilibrados en cada partido.
            </p>
            {hasAttributes && isAdmin ? (
              <LinkButton to={`/groups/${groupId}/ratings`}>
                Ver Puntuaciones
              </LinkButton>
            ) : (
              <p className="text-text-secondary text-sm italic">
                {!hasAttributes && "Necesita atributos configurados."}{" "}
                {!isAdmin && "Pedile a un admin que los configure."}
              </p>
            )}
          </div>
        </div>
      }
    </div>
  );
}
