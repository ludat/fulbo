import { useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { rpc } from "../../api/postgrest";

type JoinResult = {
  group_id: string;
  user_id: string;
  role: string;
  joined_at: string;
  already_member: boolean;
};

export function JoinByInvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["join_group", token],
    queryFn: () => rpc<JoinResult[]>("join_group_by_invite", { invite_token: token }),
    enabled: !!token,
    retry: false,
    staleTime: Infinity,
  });

  const result = data?.[0];

  useEffect(() => {
    if (result === undefined) return;
    if (result.already_member) return;
    queryClient.invalidateQueries({ queryKey: ["groups"] });
    navigate(`/groups/${result.group_id}`, { replace: true });
  }, [result]);

  if (isLoading) return <div className="loading">Uniendose al grupo...</div>;

  if (isError) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p className="error">{error.message}</p>
        <Link to="/" className="back-link">Ir al inicio</Link>
      </div>
    );
  }

  if (result?.already_member) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p>Ya sos miembro de este grupo.</p>
        <Link to={`/groups/${result.group_id}`} className="btn btn-primary" style={{ marginTop: "1rem" }}>
          Ir al grupo
        </Link>
      </div>
    );
  }

  return <div className="loading">Redirigiendo...</div>;
}
