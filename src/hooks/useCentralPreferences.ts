import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";

export interface CentralPreferences {
  default_tab: string;
  default_view: string;
  default_filter: string;
  default_priority: string;
  default_project: string;
  updated_at?: string | null;
}

const DEFAULTS: CentralPreferences = {
  default_tab: "hoje",
  default_view: "list",
  default_filter: "all",
  default_priority: "all",
  default_project: "all",
  updated_at: null,
};

export function useCentralPreferences() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["central-preferences", user?.id],
    queryFn: async (): Promise<CentralPreferences> => {
      if (!user?.id) return DEFAULTS;
      const { data, error } = await supabase
        .from("user_central_preferences")
        .select("default_tab, default_view, default_filter, default_priority, default_project, updated_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error || !data) return DEFAULTS;
      return data as CentralPreferences;
    },
    enabled: !!user?.id,
    // Always fetch fresh prefs after a login / device switch.
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  // Realtime: keep preferences in sync across devices for the same user.
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`central-prefs-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_central_preferences",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["central-preferences", user.id] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  // Drop any cached prefs from previous accounts on sign-out.
  useEffect(() => {
    if (!user?.id) {
      queryClient.removeQueries({ queryKey: ["central-preferences"], exact: false });
    }
  }, [user?.id, queryClient]);

  const save = useMutation({
    mutationFn: async (prefs: Partial<CentralPreferences>) => {
      if (!user?.id) return;
      const { error } = await supabase
        .from("user_central_preferences")
        .upsert(
          { user_id: user.id, ...prefs },
          { onConflict: "user_id" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["central-preferences", user?.id] });
    },
  });

  // Best-effort audit logger. Failures must NOT break the user-facing reset
  // flow, so errors are swallowed after console reporting.
  const logAudit = async (
    resetType: "full" | "filters_only",
    previous: CentralPreferences,
    applied: Partial<CentralPreferences>,
  ) => {
    if (!user?.id) return;
    try {
      await supabase.from("central_preferences_audit").insert([
        {
          user_id: user.id,
          reset_type: resetType,
          previous_preferences: previous as unknown as Json,
          applied_preferences: applied as unknown as Json,
          user_agent:
            typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null,
        },
      ]);
    } catch (err) {
      // Audit is best-effort; never block the UX on logging failures.
      // eslint-disable-next-line no-console
      console.warn("[central-prefs] audit insert failed", err);
    }
  };

  const reset = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      const previous = query.data || DEFAULTS;
      const { error } = await supabase
        .from("user_central_preferences")
        .delete()
        .eq("user_id", user.id);
      if (error) throw error;
      await logAudit("full", previous, DEFAULTS);
    },
    onSuccess: () => {
      // Optimistically seed the cache with system DEFAULTS so any consumer
      // (URL sync, header summary, KPIs) sees the new state immediately,
      // without waiting for the refetch round-trip.
      queryClient.setQueryData(["central-preferences", user?.id], DEFAULTS);
      queryClient.invalidateQueries({ queryKey: ["central-preferences", user?.id] });
    },
  });

  // Partial reset: clears filter-related fields but keeps tab + view.
  const resetFiltersOnly = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      const previous = query.data || DEFAULTS;
      const applied: Partial<CentralPreferences> = {
        default_filter: DEFAULTS.default_filter,
        default_priority: DEFAULTS.default_priority,
        default_project: DEFAULTS.default_project,
      };
      const { error } = await supabase
        .from("user_central_preferences")
        .upsert({ user_id: user.id, ...applied }, { onConflict: "user_id" });
      if (error) throw error;
      await logAudit("filters_only", previous, applied);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["central-preferences", user?.id] });
    },
  });

  return {
    preferences: query.data || DEFAULTS,
    isLoading: query.isLoading,
    isFetched: query.isFetched,
    save: save.mutate,
    isSaving: save.isPending,
    reset: reset.mutateAsync,
    isResetting: reset.isPending,
    resetFiltersOnly: resetFiltersOnly.mutateAsync,
    isResettingFilters: resetFiltersOnly.isPending,
    systemDefaults: DEFAULTS,
  };
}
