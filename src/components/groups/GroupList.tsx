import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "react-oidc-context";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { api } from "../../api/postgrest";

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

const statusClass: Record<string, string> = {
  going: "badge-admin",
  maybe: "badge-member",
  not_going: "badge-danger",
};

export function GroupList() {
  const auth = useAuth();
  const userId = auth.user?.profile.sub;

  const now = new Date().toISOString();
  const oneWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

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
          and: `(starts_at.gte.${now},starts_at.lte.${oneWeek})`,
          order: "starts_at.asc",
          select:
            "id,group_id,starts_at,location,groups(name),attendance(status)",
          "attendance.user_id": `eq.${userId}`,
        },
      }),
    enabled: !!userId,
  });

  if (groupsLoading) return <div className="loading">Cargando grupos...</div>;

  console.log(upcomingMatches);
  return (
    <div>
      {upcomingMatches && upcomingMatches.length > 0 && (
        <section>
          <h2>Proximos Partidos</h2>
          <div className="card-list">
            {upcomingMatches.map((m) => {
              const myStatus = m.attendance[0]?.status;
              return (
                <Link
                  to={`/groups/${m.group_id}/matches/${m.id}`}
                  key={m.id}
                  className="card"
                >
                  <div
                    className="member-info"
                    style={{ justifyContent: "space-between" }}
                  >
                    <div>
                      <h3>
                        {format(new Date(m.starts_at), "EEE d MMM, HH:mm", {
                          locale: es,
                        })}
                      </h3>
                      <p className="match-meta">
                        {m.groups.name}
                        {m.location ? ` · ${m.location}` : ""}
                      </p>
                    </div>
                    {myStatus && (
                      <span className={`badge ${statusClass[myStatus]}`}>
                        {statusLabels[myStatus]}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <div className="page-header">
          <h2>Mis Grupos</h2>
          <Link to="/groups/new" className="btn btn-primary">
            Crear Grupo
          </Link>
        </div>
        {groups?.length === 0 && (
          <p className="empty-state">
            Todavia no tenés grupos. Creá uno para arrancar!
          </p>
        )}
        <div className="card-list">
          {groups?.map((g) => (
            <Link to={`/groups/${g.id}`} key={g.id} className="card">
              <h3>{g.name}</h3>
              {g.description && <p>{g.description}</p>}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
