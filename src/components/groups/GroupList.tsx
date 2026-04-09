import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "react-oidc-context";
import { addWeeks, format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { api } from "../../api/postgrest";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";
import { LinkButton } from "../ui/Button";

type Group = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
};

type UpcomingMatch = {
  id: string;
  group_id: string;
  starts_at: string;
  location: string | null;
  groups: { name: string };
  attendance: { status: string }[];
};

const statusLabels: Record<string, string> = {
  going: "Voy",
  maybe: "Capaz",
  not_going: "No voy",
};

const statusVariant: Record<string, "admin" | "member" | "danger"> = {
  going: "admin",
  maybe: "member",
  not_going: "danger",
};

export function GroupList() {
  const auth = useAuth();
  const userId = auth.user?.profile.sub;

  const [now] = useState(() => new Date());

  const { data: groups, isLoading: groupsLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: () =>
      api<Group[]>("/groups", { params: { deleted_at: "is.null" } }),
  });

  const { data: upcomingMatches } = useQuery({
    queryKey: ["upcoming_matches", userId],
    queryFn: () =>
      api<UpcomingMatch[]>("/matches", {
        params: {
          deleted_at: "is.null",
          and: `(starts_at.gte.${now.toISOString()},starts_at.lte.${addWeeks(now, 1).toISOString()})`,
          order: "starts_at.asc",
          select:
            "id,group_id,starts_at,location,groups(name),attendance(status,players!inner(user_id))",
          "attendance.players.user_id": `eq.${userId}`,
        },
      }),
    enabled: !!userId,
  });

  if (groupsLoading)
    return (
      <div className="text-text-secondary p-8 text-center">
        Cargando grupos...
      </div>
    );

  console.log(upcomingMatches);
  return (
    <div>
      {upcomingMatches && upcomingMatches.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg">Proximos Partidos</h2>
          <div className="flex flex-col gap-3">
            {upcomingMatches.map((m) => {
              const myStatus = m.attendance[0]?.status;
              return (
                <Link
                  to={`/groups/${m.group_id}/matches/${m.id}`}
                  key={m.id}
                  className="bg-surface border-border text-text block rounded-lg border p-4 no-underline transition-shadow hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3>
                        {format(new Date(m.starts_at), "EEEE d MMM, HH:mm", {
                          locale: es,
                        })}
                      </h3>
                      <p className="text-text-secondary text-sm">
                        {formatDistanceToNow(new Date(m.starts_at), {
                          addSuffix: true,
                          locale: es,
                        })}
                        {" · "}
                        {m.groups.name}
                        {m.location ? ` · ${m.location}` : ""}
                      </p>
                    </div>
                    {myStatus && (
                      <Badge variant={statusVariant[myStatus]}>
                        {statusLabels[myStatus]}
                      </Badge>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="mt-8">
        <div className="mb-6 flex items-start justify-between">
          <h2 className="mb-3 text-lg">Mis Grupos</h2>
          <LinkButton to="/groups/new">Crear Grupo</LinkButton>
        </div>
        {groups?.length === 0 && (
          <p className="text-text-secondary p-6 text-center italic">
            Todavia no tenés grupos. Creá uno para arrancar!
          </p>
        )}
        <div className="flex flex-col gap-3">
          {groups?.map((g) => (
            <Card to={`/groups/${g.id}`} key={g.id}>
              <h3>{g.name}</h3>
              {g.description && <p>{g.description}</p>}
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
