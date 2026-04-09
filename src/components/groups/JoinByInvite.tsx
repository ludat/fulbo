import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "react-oidc-context";
import { rpc } from "../../api/postgrest";
import { Button, LinkButton } from "../ui/Button";
import { Input } from "../ui/Input";
import { BackLink } from "../ui/BackLink";

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
    queryFn: () =>
      rpc<JoinResult[]>("join_group_by_invite", { invite_token: token }),
    enabled: !!token,
    retry: false,
    staleTime: Infinity,
  });

  const result = data?.[0];

  const { data: unlinkedPlayers, isLoading: loadingPlayers } = useQuery({
    queryKey: ["unlinked_players_for_invite", token],
    queryFn: () =>
      rpc<UnlinkedPlayer[]>("unlinked_players_for_invite", {
        invite_token: token,
      }),
    enabled: !!result && !result.already_member,
  });

  const claimPlayer = useMutation({
    mutationFn: (playerId: string) =>
      rpc("complete_join_by_invite", {
        invite_token: token,
        p_player_id: playerId,
      }),
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

  if (isLoading)
    return (
      <div className="text-text-secondary p-8 text-center">
        Uniendose al grupo...
      </div>
    );

  if (isError) {
    return (
      <div className="p-8 text-center">
        <p className="text-danger text-sm">{error.message}</p>
        <BackLink to="/">Ir al inicio</BackLink>
      </div>
    );
  }

  if (result?.already_member) {
    return (
      <div className="p-8 text-center">
        <p>Ya sos miembro de este grupo.</p>
        <LinkButton to={`/groups/${result.group_id}`} className="mt-4">
          Ir al grupo
        </LinkButton>
      </div>
    );
  }

  if (loadingPlayers)
    return (
      <div className="text-text-secondary p-8 text-center">
        Cargando jugadores...
      </div>
    );

  const hasUnlinked = unlinkedPlayers && unlinkedPlayers.length > 0;

  if (showCreateForm || !hasUnlinked) {
    return (
      <div className="mx-auto max-w-sm p-8">
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
          <Input
            type="text"
            value={newPlayerName}
            onChange={(e) => setNewPlayerName(e.target.value)}
            placeholder="Tu nombre"
            className="mb-4 w-full"
            autoFocus
          />
          <Button
            type="submit"
            className="w-full justify-center"
            disabled={createPlayer.isPending || !newPlayerName.trim()}
          >
            {createPlayer.isPending ? "Creando..." : "Crear jugador"}
          </Button>
        </form>
        {hasUnlinked && (
          <Button
            variant="secondary"
            className="mt-2 w-full justify-center"
            onClick={() => setShowCreateForm(false)}
          >
            Volver a elegir jugador existente
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm p-8">
      <h2>Elegir tu jugador</h2>
      <p>Selecciona tu jugador o crea uno nuevo para unirte al grupo.</p>
      <ul className="list-none">
        {unlinkedPlayers.map((p) => (
          <li
            key={p.id}
            className="border-border flex items-center justify-between border-b py-2"
          >
            <span>{p.name}</span>
            <Button
              size="sm"
              onClick={() => claimPlayer.mutate(p.id)}
              disabled={claimPlayer.isPending}
            >
              Soy yo
            </Button>
          </li>
        ))}
      </ul>
      <Button
        variant="secondary"
        className="mt-4 w-full justify-center"
        onClick={() => setShowCreateForm(true)}
      >
        Crear nuevo jugador
      </Button>
    </div>
  );
}
