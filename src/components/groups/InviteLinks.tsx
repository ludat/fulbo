import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/postgrest";
import { Button } from "../ui/Button";
import { InfoTooltip } from "../ui/InfoTooltip";

type Invite = {
  id: string;
  group_id: string;
  token: string;
  created_at: string;
};

export function InviteLinks({ groupId }: { groupId: string }) {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState<string | null>(null);

  const { data: invites } = useQuery({
    queryKey: ["group_invites", groupId],
    queryFn: () =>
      api<Invite[]>("/group_invites", {
        params: {
          group_id: `eq.${groupId}`,
          select: "id,group_id,token,created_at",
        },
      }),
  });

  const createInvite = useMutation({
    mutationFn: () =>
      api("/group_invites", {
        method: "POST",
        body: { group_id: groupId },
        headers: { Prefer: "return=representation" },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group_invites", groupId] });
    },
  });

  const deleteInvite = useMutation({
    mutationFn: (inviteId: string) =>
      api("/group_invites", {
        method: "DELETE",
        params: { id: `eq.${inviteId}` },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group_invites", groupId] });
    },
  });

  function copyInviteLink(token: string) {
    const url = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(url);
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <section>
      <h3>
        Links de Invitación
        <InfoTooltip text="Compartí estos links para que otras personas se unan al grupo. Cada link se puede revocar en cualquier momento." />
      </h3>
      {invites?.length ? (
        <ul className="list-none">
          {invites.map((inv) => (
            <li
              key={inv.id}
              className="border-border flex items-center justify-between gap-2 border-b py-2"
            >
              <code className="text-text-secondary min-w-0 overflow-hidden text-xs text-ellipsis whitespace-nowrap">
                {`${window.location.origin}/invite/${inv.token}`}
              </code>
              <div className="flex shrink-0 gap-1">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => copyInviteLink(inv.token)}
                >
                  {copied === inv.token ? "Copiado!" : "Copiar"}
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => deleteInvite.mutate(inv.id)}
                >
                  Revocar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-text-secondary italic">
          No hay links de invitación todavía.
        </p>
      )}
      <Button
        size="sm"
        className="mt-2"
        onClick={() => createInvite.mutate()}
        disabled={createInvite.isPending}
      >
        Crear Link de Invitación
      </Button>
    </section>
  );
}
