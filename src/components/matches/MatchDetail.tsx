import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "react-oidc-context";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { api } from "../../api/postgrest";
import { AttendanceToggle } from "./AttendanceToggle";
import { AttendanceList } from "./AttendanceList";
import { ConfirmButton } from "../ui/ConfirmButton";

type Member = {
  user_id: string;
  role: string;
};

type Match = {
  id: string;
  group_id: string;
  location: string | null;
  starts_at: string;
  notes: string | null;
  created_by: string;
};

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
      api<Match[]>("/matches", { params: { id: `eq.${matchId}`, deleted_at: "is.null" } }),
  });

  const match = matches?.[0];

  const { data: members } = useQuery({
    queryKey: ["group_members", groupId],
    queryFn: () =>
      api<Member[]>("/group_members", {
        params: { group_id: `eq.${groupId}`, select: "user_id,role" },
      }),
    enabled: !!match,
  });

  const isAdmin = members?.some(
    (m) => m.user_id === currentUserId && m.role === "admin"
  );

  const repeatMatch = useMutation({
    mutationFn: () => {
      const nextWeek = new Date(new Date(match!.starts_at).getTime() + 7 * 24 * 60 * 60 * 1000);
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

  if (isLoading) return <div className="loading">Cargando...</div>;
  if (!match) return <div className="error">Partido no encontrado</div>;

  return (
    <div>
      <div className="page-header">
        <Link to={`/groups/${groupId}`} className="back-link">
          &larr; Volver al grupo
        </Link>
        {isAdmin && (
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <ConfirmButton
              label="Eliminar Partido"
              onConfirm={() => deleteMatch.mutate()}
              disabled={deleteMatch.isPending}
            />
            <button
              className="btn btn-secondary"
              onClick={() => repeatMatch.mutate()}
              disabled={repeatMatch.isPending}
            >
              Repetir Partido
            </button>
            <Link
              to={`/groups/${groupId}/matches/${matchId}/edit`}
              className="btn btn-secondary"
            >
              Editar
            </Link>
          </div>
        )}
      </div>
      <h1>{format(new Date(match.starts_at), "EEEE d 'de' MMMM, yyyy - HH:mm", { locale: es })}</h1>
      <div className="match-info">
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

      <section>
        <h2>Tu Asistencia</h2>
        <AttendanceToggle matchId={matchId!} />
      </section>

      <section>
        <h2>Quienes van</h2>
        <AttendanceList matchId={matchId!} groupId={groupId!} />
      </section>
    </div>
  );
}
