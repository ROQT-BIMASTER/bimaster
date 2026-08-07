import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface IcsTokenFiltros {
  equipeIds?: string[];
  responsavelIds?: string[];
}

export interface IcsToken {
  token: string;
  filtros: IcsTokenFiltros;
}

const QUERY_KEY = ["calendario-ics-token"];

function gerarToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Token pessoal de assinatura da agenda (iCalendar). */
export function useCalendarioIcsToken() {
  return useQuery({
    queryKey: QUERY_KEY,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<IcsToken | null> => {
      const { data, error } = await (supabase as any)
        .from("calendario_ics_tokens")
        .select("token, filtros")
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return { token: data.token, filtros: (data.filtros || {}) as IcsTokenFiltros };
    },
  });
}

/** Cria/atualiza (ou revoga) o token de assinatura com os filtros escolhidos. */
export function useCalendarioIcsTokenMutations() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const invalidate = () => qc.invalidateQueries({ queryKey: QUERY_KEY });

  const gerar = useMutation({
    mutationFn: async (filtros: IcsTokenFiltros): Promise<IcsToken> => {
      if (!user?.id) throw new Error("Sessão expirada.");
      const token = gerarToken();
      const { error } = await (supabase as any)
        .from("calendario_ics_tokens")
        .upsert({ user_id: user.id, token, filtros }, { onConflict: "user_id" });
      if (error) throw error;
      return { token, filtros };
    },
    onSuccess: invalidate,
  });

  const atualizarFiltros = useMutation({
    mutationFn: async (filtros: IcsTokenFiltros) => {
      if (!user?.id) throw new Error("Sessão expirada.");
      const { error } = await (supabase as any)
        .from("calendario_ics_tokens")
        .update({ filtros })
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const revogar = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Sessão expirada.");
      const { error } = await (supabase as any)
        .from("calendario_ics_tokens")
        .delete()
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { gerar, atualizarFiltros, revogar };
}

/** URL pública (com token) do feed iCalendar. */
export function montarUrlIcs(token: string): string {
  const base = import.meta.env.VITE_SUPABASE_URL as string;
  return `${base}/functions/v1/calendario-ics?token=${token}`;
}
