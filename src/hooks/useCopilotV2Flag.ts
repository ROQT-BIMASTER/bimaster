// useCopilotV2Flag — reads the v2 rollout feature flag for a given copilot.
// Flags live in `feature_flags` and default to OFF so legacy paths stay safe.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CopilotV2Id = "central" | "projeto" | "sofia" | "estoque" | "china";

const FLAG_BY_ID: Record<CopilotV2Id, string> = {
  central: "ff_copilot_v2_central",
  projeto: "ff_copilot_v2_projeto",
  sofia: "ff_copilot_v2_sofia",
  estoque: "ff_copilot_v2_estoque",
  china: "ff_copilot_v2_china",
};

const cache = new Map<string, boolean>();

export function useCopilotV2Flag(copilotId: CopilotV2Id): boolean {
  const flagName = FLAG_BY_ID[copilotId];
  const [enabled, setEnabled] = useState<boolean>(cache.get(flagName) ?? false);

  useEffect(() => {
    let cancelled = false;
    if (cache.has(flagName)) return;
    (async () => {
      try {
        const { data } = await (supabase as any)
          .from("feature_flags")
          .select("enabled")
          .eq("name", flagName)
          .maybeSingle();
        const v = !!data?.enabled;
        cache.set(flagName, v);
        if (!cancelled) setEnabled(v);
      } catch {
        cache.set(flagName, false);
      }
    })();
    return () => { cancelled = true; };
  }, [flagName]);

  return enabled;
}

/** Choose the edge function name based on the v2 flag. */
export function pickCopilotEdgeFn(copilotId: CopilotV2Id, legacy: string, v2: string, v2Enabled: boolean): string {
  return v2Enabled ? v2 : legacy;
}
