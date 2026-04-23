import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
        .select("default_tab, default_view, default_filter, default_priority, default_project")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error || !data) return DEFAULTS;
      return data as CentralPreferences;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
  });

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

  const reset = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      const { error } = await supabase
        .from("user_central_preferences")
        .delete()
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["central-preferences", user?.id] });
    },
  });

  return {
    preferences: query.data || DEFAULTS,
    isLoading: query.isLoading,
    save: save.mutate,
    isSaving: save.isPending,
    reset: reset.mutateAsync,
    isResetting: reset.isPending,
    systemDefaults: DEFAULTS,
  };
}
