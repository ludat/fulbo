import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../../api/postgrest";

type Group = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
};

export function GroupList() {
  const { data: groups, isLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: () => api<Group[]>("/groups"),
  });

  if (isLoading) return <div className="loading">Cargando grupos...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Mis Grupos</h1>
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
    </div>
  );
}
