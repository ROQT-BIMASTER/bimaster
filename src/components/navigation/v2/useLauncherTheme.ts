/**
 * Lê/escreve a preferência `launcher_theme` ('dark'|'light') em
 * public.user_ui_preferences. Reaproveita a mesma query key de PreferenciasUI.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type LauncherTheme = "dark" | "light";
export const DEFAULT_LAUNCHER_THEME: LauncherTheme = "dark";

const QUERY_KEY = ["user-ui-preferences", "self"] as const;

interface Row {
  user_id: string;
  launcher_theme?: LauncherTheme | null;
}

export function useLauncherTheme() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    enabled: !!user?.id,
    queryFn: async (): Promise<Row | null> => {
      const { data, error } = await supabase
        .from("user_ui_preferences" as any)
        .select("user_id,launcher_theme")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return ((data as unknown) as Row | null) ?? null;
    },
  });

  const save = useMutation({
    mutationFn: async (next: LauncherTheme) => {
      if (!user?.id) throw new Error("Sessão expirada.");
      if (next !== "dark" && next !== "light") {
        throw new Error("Tema inválido. Use 'dark' ou 'light'.");
      }
      const { error } = await supabase
        .from("user_ui_preferences" as any)
        .upsert(
          { user_id: user.id, launcher_theme: next },
          { onConflict: "user_id" },
        );
      if (error) throw error;
      return next;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  return {
    theme: (data?.launcher_theme as LauncherTheme | undefined) ?? DEFAULT_LAUNCHER_THEME,
    isLoading,
    save,
  };
}
