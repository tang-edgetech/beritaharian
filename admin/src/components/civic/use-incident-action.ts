"use client";

import { api } from "@/lib/api";
import { notify } from "@/lib/notify";
import type { AdminIncidentDetail, IncidentActionInput } from "@cendol/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";

type Result = { message: string; data: AdminIncidentDetail };

/**
 * Runs a change on one report (action, alert edit, note, upload...) and refreshes
 * the report, the queues and the sidebar counts. Returns the new report, or null when it failed.
 */
export function useIncidentMutation(ref: string) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const run = useCallback(
    async (key: string, send: () => Promise<Result>, onError?: (error: unknown) => void): Promise<AdminIncidentDetail | null> => {
      setBusy(key);
      try {
        const result = await send();
        notify.success(result.message);
        queryClient.setQueryData(["incident", ref], result.data);
        void queryClient.invalidateQueries({ queryKey: ["listing"] });
        void queryClient.invalidateQueries({ queryKey: ["incident-summary"] });
        return result.data;
      } catch (error) {
        onError?.(error);
        notify.error(error);
        return null;
      } finally {
        setBusy(null);
      }
    },
    [queryClient, ref],
  );

  const act = useCallback(
    (input: IncidentActionInput) => run(input.action, () => api.post<Result>(`admin/incidents/${ref}/action`, input)),
    [run, ref],
  );

  return { run, act, busy };
}
