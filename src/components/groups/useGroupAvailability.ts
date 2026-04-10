import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/postgrest";

type SummaryRow = {
  day_of_week: number;
  time_slot: number;
  player_count: number;
  player_names: string[];
};

export function useGroupAvailability(groupId: string) {
  return useQuery({
    queryKey: ["availability_summary", groupId],
    queryFn: () =>
      api<SummaryRow[]>("/availability_summary", {
        params: { group_id: `eq.${groupId}` },
      }),
  });
}
