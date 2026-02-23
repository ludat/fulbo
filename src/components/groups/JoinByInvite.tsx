import { useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rpc } from "../../api/postgrest";

type GroupMember = {
  group_id: string;
  user_id: string;
  role: string;
};

export function JoinByInvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const joinGroup = useMutation({
    mutationFn: () =>
      rpc<GroupMember[]>("join_group_by_invite", { invite_token: token }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      const groupId = data?.[0]?.group_id;
      navigate(groupId ? `/groups/${groupId}` : "/", { replace: true });
    },
  });

  useEffect(() => {
    if (token) {
      joinGroup.mutate();
    }
  }, [token]);

  if (joinGroup.isPending) {
    return <div className="loading">Uniendose al grupo...</div>;
  }

  if (joinGroup.isError) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p className="error">{joinGroup.error.message}</p>
        <Link to="/" className="back-link">
          Ir al inicio
        </Link>
      </div>
    );
  }

  return <div className="loading">Redirigiendo...</div>;
}
