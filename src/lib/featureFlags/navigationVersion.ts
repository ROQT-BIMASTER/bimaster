/**
 * Feature flag de navegação — 100% dos usuários no ambiente v2 (Beta).
 *
 * Antes: default 'v1' com opt-in por usuário via user_ui_preferences.nav_version.
 * Agora: v2 é o único ambiente disponível. A coluna `nav_version` continua
 * existindo por compatibilidade histórica, mas seu valor é IGNORADO no
 * runtime — mesmo registros com 'v1' resolvem para 'v2'. Migração 100%
 * sem migration SQL (front força v2).
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type NavVersion = "v1" | "v2";

export const DEFAULT_NAV_VERSION: NavVersion = "v2";

const QUERY_KEY = ["feature-flag", "nav-version"] as const;
const STALE_MS = 5 * 60 * 1000;

/**
 * Sempre devolve 'v2'. Mantida a assinatura assíncrona/consulta a
 * `user_ui_preferences` fica desnecessária — retornamos v2 direto para
 * evitar round-trip e garantir que nenhum usuário volte para v1.
 */
export async function getNavVersion(_userId?: string | null): Promise<NavVersion> {
  // Consumimos supabase apenas para não quebrar tree-shaking em callers que
  // esperavam o efeito colateral de auth (nenhum hoje).
  void supabase;
  return "v2";
}

/**
 * Hook reativo. Sempre retorna 'v2'. Mantido para compatibilidade dos
 * consumidores atuais (SidebarSwitch, componentes v2).
 */
export function useNavVersion(): {
  version: NavVersion;
  isLoading: boolean;
} {
  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => "v2" as NavVersion,
    staleTime: STALE_MS,
    gcTime: STALE_MS * 2,
    retry: false,
  });
  return { version: data ?? "v2", isLoading };
}

