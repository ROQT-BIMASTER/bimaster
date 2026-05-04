import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface HistoricoEntry {
  id: string;
  item_id: string;
  user_id: string | null;
  user_nome?: string | null;
  acao: string;
  origem: string;
  coluna_origem: string | null;
  coluna_destino: string | null;
  status_anterior: string | null;
  status_novo: string | null;
  etapa_anterior_nome: string | null;
  etapa_atual_nome: string | null;
  comentario: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export function useItemHistorico(itemId: string | null | undefined) {
  return useQuery({
    queryKey: ["item-historico", itemId],
    enabled: !!itemId,
    queryFn: async (): Promise<HistoricoEntry[]> => {
      const { data, error } = await supabase
        .from("aprovacao_kanban_audit" as any)
        .select("*")
        .eq("item_id", itemId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as any[];
      const userIds = Array.from(
        new Set(rows.map((r) => r.user_id).filter(Boolean)),
      ) as string[];
      let nomes: Record<string, string> = {};
      if (userIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds);
        nomes = Object.fromEntries(
          (profs ?? []).map((p: any) => [p.id, p.full_name || p.email || "—"]),
        );
      }
      return rows.map((r) => ({
        ...r,
        user_nome: r.user_id ? nomes[r.user_id] ?? null : null,
      })) as HistoricoEntry[];
    },
  });
}
