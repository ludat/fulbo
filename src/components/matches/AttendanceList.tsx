import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "react-oidc-context";
import { api } from "../../api/postgrest";

type AttendanceRow = {
  user_id: string;
  status: string;
  users: { display_name: string; avatar_url: string | null };
};

type Member = {
  user_id: string;
  role: string;
  users: { display_name: string; avatar_url: string | null };
};

const statusLabels: Record<string, string> = {
  going: "Voy",
  maybe: "Capaz",
  not_going: "No voy",
};

const statuses = ["going", "maybe", "not_going"] as const;

export function AttendanceList({
  matchId,
  groupId,
}: {
  matchId: string;
  groupId: string;
}) {
  const auth = useAuth();
  const currentUserId = auth.user?.profile.sub;
  const queryClient = useQueryClient();

  const { data: rows, isLoading } = useQuery({
    queryKey: ["attendance", matchId],
    queryFn: () =>
      api<AttendanceRow[]>("/attendance", {
        params: {
          match_id: `eq.${matchId}`,
          select: "user_id,status,users(display_name,avatar_url)",
          order: "status.asc",
        },
      }),
  });

  const { data: members } = useQuery({
    queryKey: ["group_members", groupId],
    queryFn: () =>
      api<Member[]>("/group_members", {
        params: {
          group_id: `eq.${groupId}`,
          select: "user_id,role,users(display_name,avatar_url)",
        },
      }),
  });

  const isAdmin = members?.some(
    (m) => m.user_id === currentUserId && m.role === "admin"
  );

  const upsert = useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: string }) =>
      api("/attendance", {
        method: "POST",
        body: { match_id: matchId, user_id: userId, status },
        headers: {
          Prefer: "resolution=merge-duplicates,return=representation",
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance", matchId] });
    },
  });

  const remove = useMutation({
    mutationFn: (userId: string) =>
      api("/attendance", {
        method: "DELETE",
        params: { match_id: `eq.${matchId}`, user_id: `eq.${userId}` },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance", matchId] });
    },
  });

  if (isLoading) return <div className="loading">Cargando...</div>;

  // Admin view: all group members with inline toggle buttons
  if (isAdmin && members) {
    const attendanceByUser = new Map(rows?.map((r) => [r.user_id, r.status]));

    return (
      <div className="attendance-list">
        <ul>
          {members.map((m) => {
            const currentStatus = attendanceByUser.get(m.user_id);
            return (
              <li key={m.user_id} className="member-item attendance-admin-row">
                <div className="member-info">
                  {m.users.avatar_url && (
                    <img
                      src={m.users.avatar_url}
                      alt=""
                      className="member-avatar"
                    />
                  )}
                  <span>{m.users.display_name}</span>
                </div>
                <div className="attendance-toggle">
                  {statuses.map((s) => (
                    <button
                      key={s}
                      className={`btn btn-sm ${currentStatus === s ? "btn-active" : "btn-secondary"}`}
                      onClick={() =>
                        upsert.mutate({ userId: m.user_id, status: s })
                      }
                      disabled={upsert.isPending || remove.isPending}
                    >
                      {statusLabels[s]}
                    </button>
                  ))}
                  {currentStatus && (
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => remove.mutate(m.user_id)}
                      disabled={upsert.isPending || remove.isPending}
                    >
                      Borrar
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  // Non-admin view: simple grouped list
  if (!rows?.length) return <p className="empty-state">Nadie confirmo todavia.</p>;

  const grouped = Object.groupBy(rows, (r) => r.status);

  return (
    <div className="attendance-list">
      {(["going", "maybe", "not_going"] as const).map((status) => {
        const group = grouped[status];
        if (!group?.length) return null;
        return (
          <div key={status} className="attendance-group">
            <h3>
              {statusLabels[status]} ({group.length})
            </h3>
            <ul>
              {group.map((r) => (
                <li key={r.user_id} className="member-item">
                  {r.users.avatar_url && (
                    <img
                      src={r.users.avatar_url}
                      alt=""
                      className="member-avatar"
                    />
                  )}
                  <span>{r.users.display_name}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
