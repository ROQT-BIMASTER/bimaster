/**
 * Feature flag de navegação (v1 = clássica, v2 = AppRail + ContextualSidebar + Launcher).
 *
 * Inerte nesta PR: exportado mas não importado por nenhum componente.
 * Consumido a partir da Fase 1 por <SidebarSwitch/> em DashboardLayout.
 *
 * Fonte: coluna `user_ui_preferences.nav_version` (default 'v1', CHECK in ('v1','v2')).
 * A migration que cria a coluna está em supabase/migrations e NÃO é aplicada nesta PR.
 * Enquanto a coluna não existir, o fallback garante 'v1' sem quebrar runtime.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type NavVersion = "v1" | "v2";

export const DEFAULT_NAV_VERSION: NavVersion = "v1";

const QUERY_KEY = ["feature-flag", "nav-version"] as const;
const STALE_MS = 5 * 60 * 1000;

/**
 * Busca a versão de navegação preferida do usuário autenticado.
 * Retorna 'v1' em qualquer cenário de erro/ausência (sem auth, coluna não migrada,
 * registro inexistente, RLS bloqueada).
 */
export async function getNavVersion(userId?: string | null): Promise<NavVersion> {
  if (!userId) return DEFAULT_NAV_VERSION;
  try {
    const { data, error } = await supabase
      .from("user_ui_preferences" as any)
      .select("nav_version")
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data) return DEFAULT_NAV_VERSION;
    const v = (data as { nav_version?: string | null }).nav_version;
    return v === "v2" ? "v2" : DEFAULT_NAV_VERSION;
  } catch {
    return DEFAULT_NAV_VERSION;
  }
}

/**
 * Hook reativo. Cache 5min. Nunca lança — sempre devolve uma versão válida.
 */
export function useNavVersion(): {
  version: NavVersion;
  isLoading: boolean;
} {
  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      return getNavVersion(auth.user?.id ?? null);
    },
    staleTime: STALE_MS,
    gcTime: STALE_MS * 2,
    retry: false,
  });
  return { version: data ?? DEFAULT_NAV_VERSION, isLoading };
}
