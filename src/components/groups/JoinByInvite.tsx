import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "react-oidc-context";
import { rpc } from "../../api/postgrest";

type JoinResult = {
  group_id: string;
  user_id: string;
  already_member: boolean;
};

type UnlinkedPlayer = {
  id: string;
  name: string;
};

export function JoinByInvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const auth = useAuth();
  const displayName = auth.user?.profile.name ?? "Jugador";
  const [newPlayerName, setNewPlayerName] = useState(displayName);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["join_group", token],
    queryFn: () => rpc<JoinResult[]>("join_group_by_invite", { invite_token: token }),
    enabled: !!token,
    retry: false,
    staleTime: Infinity,
  });

  const result = data?.[0];

  // Fetch unlinked players via invite token (bypasses RLS)
  const { data: unlinkedPlayers, isLoading: loadingPlayers } = useQuery({
    queryKey: ["unlinked_players_for_invite", token],
    queryFn: () => rpc<UnlinkedPlayer[]>("unlinked_players_for_invite", { invite_token: token }),
    enabled: !!result && !result.already_member,
  });

  const claimPlayer = useMutation({
    mutationFn: (playerId: string) =>
      rpc("complete_join_by_invite", { invite_token: token, p_player_id: playerId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      queryClient.invalidateQueries({ queryKey: ["players"] });
      navigate(`/groups/${result!.group_id}`, { replace: true });
    },
  });

  const createPlayer = useMutation({
    mutationFn: (name: string) =>
      rpc("complete_join_by_invite", { invite_token: token, p_name: name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      queryClient.invalidateQueries({ queryKey: ["players"] });
      navigate(`/groups/${result!.group_id}`, { replace: true });
    },
  });

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

  if (loadingPlayers) return <div className="loading">Cargando jugadores...</div>;

  // Show claim/create flow
  const hasUnlinked = unlinkedPlayers && unlinkedPlayers.length > 0;

  if (showCreateForm || !hasUnlinked) {
    return (
      <div style={{ padding: "2rem", maxWidth: "400px", margin: "0 auto" }}>
        <h2>Crear tu jugador</h2>
        <p>Crea tu perfil de jugador para unirte al grupo.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (newPlayerName.trim()) {
              createPlayer.mutate(newPlayerName.trim());
            }
          }}
        >
          <input
            type="text"
            value={newPlayerName}
            onChange={(e) => setNewPlayerName(e.target.value)}
            placeholder="Tu nombre"
            className="input"
            style={{ width: "100%", marginBottom: "1rem" }}
            autoFocus
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={createPlayer.isPending || !newPlayerName.trim()}
            style={{ width: "100%" }}
          >
            {createPlayer.isPending ? "Creando..." : "Crear jugador"}
          </button>
        </form>
        {hasUnlinked && (
          <button
            className="btn btn-secondary"
            onClick={() => setShowCreateForm(false)}
            style={{ width: "100%", marginTop: "0.5rem" }}
          >
            Volver a elegir jugador existente
          </button>
        )}
      </div>
    );
  }

  // Show list of unlinked players to claim
  return (
    <div style={{ padding: "2rem", maxWidth: "400px", margin: "0 auto" }}>
      <h2>Elegir tu jugador</h2>
      <p>Selecciona tu jugador o crea uno nuevo para unirte al grupo.</p>
      <ul className="member-list">
        {unlinkedPlayers.map((p) => (
          <li key={p.id} className="member-item">
            <span>{p.name}</span>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => claimPlayer.mutate(p.id)}
              disabled={claimPlayer.isPending}
            >
              Soy yo
            </button>
          </li>
        ))}
      </ul>
      <button
        className="btn btn-secondary"
        onClick={() => setShowCreateForm(true)}
        style={{ width: "100%", marginTop: "1rem" }}
      >
        Crear nuevo jugador
      </button>
    </div>
  );
}
