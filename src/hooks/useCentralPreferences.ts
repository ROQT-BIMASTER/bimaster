import { useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
  // Throttle save-error toasts so a flapping connection doesn't spam the UI
  // (the autosave hook can fire many writes in succession).
  const lastSaveErrorToastRef = useRef<number>(0);

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
    // Realtime subscription (below) keeps prefs in sync; aggressive refetches
    // would cause the entire Central to re-render and visually flicker every
    // time the user changes a filter (each change triggers an autosave).
    staleTime: 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
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
      if (!user?.id) return prefs;
      const { error } = await supabase
        .from("user_central_preferences")
        .upsert(
          { user_id: user.id, ...prefs },
          { onConflict: "user_id" }
        );
      if (error) throw error;
      return prefs;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["central-preferences", user?.id] });
    },
    // Failure handling: surface a discreet error toast and DO NOT touch the
    // cached preferences. The user keeps seeing the values they had before
    // the save attempt (no rollback is needed because we never wrote
    // optimistically here). A retry button re-runs the same payload.
    onError: (err, variables) => {
      // eslint-disable-next-line no-console
      console.error("[central-prefs] save failed", err);
      const now = Date.now();
      if (now - lastSaveErrorToastRef.current < 4000) return;
      lastSaveErrorToastRef.current = now;
      toast.error("Não foi possível salvar suas preferências", {
        description:
          "Suas escolhas continuam visíveis nesta sessão, mas não foram sincronizadas.",
        action: {
          label: "Tentar novamente",
          onClick: () => save.mutate(variables),
        },
      });
    },
  });

  // Manual save: persists ALL current preference fields in one shot so the
  // server-side trigger refreshes `updated_at`. Used by the "Salvar agora"
  // button so the user can confirm the snapshot they're currently viewing.
  const saveNow = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Usuário não autenticado");
      const current = query.data || DEFAULTS;
      const payload = {
        user_id: user.id,
        default_tab: current.default_tab,
        default_view: current.default_view,
        default_filter: current.default_filter,
        default_priority: current.default_priority,
        default_project: current.default_project,
      };
      const { data, error } = await supabase
        .from("user_central_preferences")
        .upsert(payload, { onConflict: "user_id" })
        .select("default_tab, default_view, default_filter, default_priority, default_project, updated_at")
        .maybeSingle();
      if (error) throw error;
      return data as CentralPreferences | null;
    },
    onSuccess: (data) => {
      // Seed the cache with the freshly-returned row (incl. new updated_at)
      // so the tooltip updates immediately, before the refetch lands.
      if (data) {
        queryClient.setQueryData(["central-preferences", user?.id], data);
      }
      queryClient.invalidateQueries({ queryKey: ["central-preferences", user?.id] });
    },
    onError: (err) => {
      // eslint-disable-next-line no-console
      console.error("[central-prefs] manual save failed", err);
      toast.error("Não foi possível salvar suas preferências", {
        description: "Tente novamente em instantes.",
      });
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
      // Merge the cleared filter fields into the cached prefs so the URL
      // sync effect sees them on the very next render (no refetch wait).
      const current = queryClient.getQueryData<CentralPreferences>([
        "central-preferences",
        user?.id,
      ]);
      queryClient.setQueryData(["central-preferences", user?.id], {
        ...(current ?? DEFAULTS),
        default_filter: DEFAULTS.default_filter,
        default_priority: DEFAULTS.default_priority,
        default_project: DEFAULTS.default_project,
      });
      queryClient.invalidateQueries({ queryKey: ["central-preferences", user?.id] });
    },
  });

  return {
    preferences: query.data || DEFAULTS,
    isLoading: query.isLoading,
    isFetched: query.isFetched,
    save: save.mutate,
    isSaving: save.isPending,
    saveError: save.error as Error | null,
    retrySave: () => {
      const variables = save.variables;
      if (variables) save.mutate(variables);
    },
    reset: reset.mutateAsync,
    isResetting: reset.isPending,
    resetFiltersOnly: resetFiltersOnly.mutateAsync,
    isResettingFilters: resetFiltersOnly.isPending,
    saveNow: saveNow.mutateAsync,
    isSavingNow: saveNow.isPending,
    systemDefaults: DEFAULTS,
  };
}
