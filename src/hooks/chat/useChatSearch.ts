/**
 * useChatSearch — busca global em mensagens do chat corporativo.
 *
 * Chama rpc_chat_search (SECURITY DEFINER) que respeita participação
 * do user nas conversas. Debounce de 300ms na query pra evitar fire
 * a cada keystroke.
 */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ChatSearchHit {
  id: string;
  conversa_id: string;
  remetente_id: string;
  conteudo: string;
  /** Snippet com tokens marcados <<...>> nos termos que casaram a query. */
  headline: string;
  tipo: string;
  created_at: string;
  rank: number;
}

export function useChatSearch(query: string) {
  const { user } = useAuth();
  const [debounced, setDebounced] = useState(query);

  // Debounce manual — 300ms é suficiente pra não disparar a cada keystroke
  // mas dar resposta rápida quando o user pausa a digitação.
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query), 300);
    return () => window.clearTimeout(t);
  }, [query]);

  return useQuery({
    queryKey: ["chat-search", debounced],
    enabled: !!user?.id && debounced.trim().length >= 2,
    staleTime: 30_000,
    queryFn: async (): Promise<ChatSearchHit[]> => {
      const { data, error } = await supabase.rpc("rpc_chat_search" as any, {
        p_query: debounced.trim(),
        p_limit: 50,
      });
      if (error) throw error;
      return (data ?? []) as ChatSearchHit[];
    },
  });
}
