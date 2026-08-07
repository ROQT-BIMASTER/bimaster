import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface HistoricoAlteracao {
  campo: string;
  de: string | null;
  para: string | null;
}

export interface CalendarioHistoricoEntry {
  id: string;
  evento_id: string;
  recorrencia_id: string | null;
  user_id: string;
  autor_nome: string | null;
  acao: "criado" | "editado" | "reagendado" | "excluido" | string;
  escopo: "unico" | "serie" | string;
  alteracoes: HistoricoAlteracao[];
  created_at: string;
}

const LABELS: Record<string, string> = {
  data_inicio: "Data de início",
  data_fim: "Data de término",
  hora_inicio: "Hora de início",
  hora_fim: "Hora de término",
  titulo: "Título",
  local: "Local",
  categoria: "Categoria",
  dia_inteiro: "Dia inteiro",
  tags: "Marcadores",
};

export const rotuloCampo = (campo: string) => LABELS[campo] ?? campo;

/**
 * Histórico de alterações de um evento (ou de toda a série, quando
 * `recorrenciaId` é informado).
 */
export function useCalendarioHistorico(eventoId?: string | null, recorrenciaId?: string | null) {
  return useQuery({
    queryKey: ["calendario-historico", eventoId, recorrenciaId],
    enabled: !!eventoId,
    staleTime: 15_000,
    queryFn: async (): Promise<CalendarioHistoricoEntry[]> => {
      let q = (supabase as any)
        .from("calendario_evento_historico")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      q = recorrenciaId
        ? q.or(`evento_id.eq.${eventoId},recorrencia_id.eq.${recorrenciaId}`)
        : q.eq("evento_id", eventoId);

      const { data, error } = await q;
      if (error) throw error;

      const rows = (data || []) as any[];
      const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));
      const nomes = new Map<string, string>();

      if (userIds.length) {
        const { data: perfis } = await (supabase as any)
          .from("profiles")
          .select("id, nome_completo")
          .in("id", userIds);
        (perfis || []).forEach((p: any) => nomes.set(p.id, p.nome_completo));
      }

      return rows.map((r): CalendarioHistoricoEntry => ({
        id: r.id,
        evento_id: r.evento_id,
        recorrencia_id: r.recorrencia_id ?? null,
        user_id: r.user_id,
        autor_nome: nomes.get(r.user_id) ?? null,
        acao: r.acao,
        escopo: r.escopo,
        alteracoes: Array.isArray(r.alteracoes) ? r.alteracoes : [],
        created_at: r.created_at,
      }));
    },
  });
}
