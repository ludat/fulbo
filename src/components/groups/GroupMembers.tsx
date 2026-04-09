import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "react-oidc-context";
import { api } from "../../api/postgrest";
import { MemberList } from "./MemberList";
import { GroupNav } from "./GroupNav";

type Group = {
  id: string;
  name: string;
  description: string | null;
};

type Admin = {
  user_id: string;
};

export function GroupMembers() {
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

  const isAdmin = admins?.some((a) => a.user_id === currentUserId) ?? false;
  const group = groups?.[0];

  if (isLoading)
    return (
      <div className="text-text-secondary p-8 text-center">Cargando...</div>
    );
  if (!group)
    return <div className="text-danger text-sm">Grupo no encontrado</div>;

  return (
    <div>
      <h1 className="mb-4">{group.name}</h1>
      <GroupNav groupId={groupId!} isAdmin={isAdmin} />
      <MemberList groupId={groupId!} />
    </div>
  );
}
