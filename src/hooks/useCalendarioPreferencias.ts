import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/** Configuração de lembretes por tipo (categoria) de evento. */
export interface LembretePorTipo {
  ativo: boolean;
  antecedenciaMinutos: number;
  email: boolean;
  notificacao: boolean;
}

export interface CalendarioLembretesPrefs {
  /** Chave mestre: desliga tudo. */
  ativo: boolean;
  /** instant = no horário do lembrete; daily/weekly = resumo. */
  frequencia: "instant" | "daily" | "weekly";
  email: boolean;
  notificacao: boolean;
  /** Sobrescritas por categoria de evento. */
  porTipo: Record<string, LembretePorTipo>;
}

export interface CalendarioPreferencias {
  filtros: Record<string, unknown>;
  lembretes: CalendarioLembretesPrefs;
}

export const DEFAULT_LEMBRETES: CalendarioLembretesPrefs = {
  ativo: true,
  frequencia: "instant",
  email: true,
  notificacao: true,
  porTipo: {},
};

const QUERY_KEY = ["calendario-preferencias"];

export function useCalendarioPreferencias() {
  const { user } = useAuth();

  return useQuery({
    queryKey: [...QUERY_KEY, user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async (): Promise<CalendarioPreferencias> => {
      const { data, error } = await (supabase as any)
        .from("calendario_preferencias")
        .select("filtros, lembretes")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;

      return {
        filtros: (data?.filtros as Record<string, unknown>) ?? {},
        lembretes: { ...DEFAULT_LEMBRETES, ...((data?.lembretes as object) ?? {}) },
      };
    },
  });
}

export function useCalendarioPreferenciasMutations() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const salvar = useMutation({
    mutationFn: async (patch: Partial<CalendarioPreferencias>) => {
      if (!user?.id) throw new Error("Sessão expirada.");
      const atual = qc.getQueryData<CalendarioPreferencias>([...QUERY_KEY, user.id]);

      const payload = {
        user_id: user.id,
        filtros: patch.filtros ?? atual?.filtros ?? {},
        lembretes: patch.lembretes ?? atual?.lembretes ?? DEFAULT_LEMBRETES,
      };

      const { error } = await (supabase as any)
        .from("calendario_preferencias")
        .upsert(payload, { onConflict: "user_id" });
      if (error) throw error;
      return payload;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  return { salvar };
}
