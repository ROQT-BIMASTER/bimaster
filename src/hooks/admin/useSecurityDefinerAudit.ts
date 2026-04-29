import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import snapshot from "@/data/security/security-definer-snapshot.json";
import {
  resolveStatus,
  type SecurityDefinerFunctionEnriched,
  type SecurityDefinerFunctionRaw,
  type SecurityDefinerOverride,
} from "@/lib/security/securityDefinerStatus";

interface Snapshot {
  generated_at: string;
  total: number;
  used_in_frontend: number;
  no_public_grant: number;
  functions: SecurityDefinerFunctionRaw[];
}

const SNAPSHOT = snapshot as unknown as Snapshot;

export function useSecurityDefinerAudit() {
  const overridesQuery = useQuery({
    queryKey: ["security-definer-overrides"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("security_definer_overrides")
        .select("*");
      if (error) throw error;
      return (data ?? []) as SecurityDefinerOverride[];
    },
    staleTime: 30_000,
  });

  const functions: SecurityDefinerFunctionEnriched[] = useMemo(() => {
    const overrides = new Map<string, SecurityDefinerOverride>();
    for (const o of overridesQuery.data ?? []) {
      overrides.set(`${o.schema_name}.${o.function_name}.${o.function_signature}`, o);
    }
    return SNAPSHOT.functions.map((fn) => {
      const key = `${fn.schema_name}.${fn.function_name}.${fn.function_signature}`;
      const override = overrides.get(key);
      const { inferred, final } = resolveStatus(fn, override);
      return {
        ...fn,
        status_inferred: inferred,
        status_final: final,
        override,
        used_in_frontend: fn.callers.length > 0,
        callers_count: fn.callers.length,
      };
    });
  }, [overridesQuery.data]);

  const reviewedCount = useMemo(
    () => functions.filter((f) => !!f.override).length,
    [functions],
  );

  return {
    snapshotMeta: {
      generated_at: SNAPSHOT.generated_at,
      total: SNAPSHOT.total,
      used_in_frontend: SNAPSHOT.used_in_frontend,
      no_public_grant: SNAPSHOT.no_public_grant,
    },
    functions,
    reviewedCount,
    isLoading: overridesQuery.isLoading,
    error: overridesQuery.error,
  };
}
