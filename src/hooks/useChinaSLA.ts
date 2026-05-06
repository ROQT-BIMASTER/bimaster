import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SLARow {
  id: string;
  submissao_id: string;
  documento_id: string;
  status: string;
  sla_status: string;
  prazo_sla: string | null;
  prazo_origem: string | null;
  prioridade: string;
  vinculo_projeto_id: string | null;
  vinculo_tarefa_id: string | null;
  despachado_para_nome: string | null;
  modulo_destino: string | null;
  concluido_em: string | null;
  created_at: string;
}

export interface SLAFilters {
  submissao_id?: string;
  projeto_id?: string;
  responsavel_nome?: string;
  status?: string[];
  desde?: string; // YYYY-MM-DD
}

export function useChinaSLA(filters: SLAFilters = {}) {
  return useQuery({
    queryKey: ["china-sla", filters],
    queryFn: async () => {
      let q = (supabase
        .from("process_despacho_documento" as any)
        .select("*")
        .order("prazo_sla", { ascending: true, nullsFirst: false }) as any);
      if (filters.submissao_id) q = q.eq("submissao_id", filters.submissao_id);
      if (filters.projeto_id) q = q.eq("vinculo_projeto_id", filters.projeto_id);
      if (filters.status?.length) q = q.in("sla_status", filters.status);
      if (filters.desde) q = q.gte("created_at", filters.desde);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as SLARow[];
    },
  });
}

export interface SLAKpis {
  total: number;
  no_prazo: number;
  em_risco: number;
  atrasado: number;
  concluido: number;
  aderencia_pct: number;
}

export function calcularKpis(rows: SLARow[]): SLAKpis {
  const total = rows.length;
  const no_prazo = rows.filter((r) => r.sla_status === "no_prazo").length;
  const em_risco = rows.filter((r) => r.sla_status === "em_risco").length;
  const atrasado = rows.filter((r) => r.sla_status === "atrasado").length;
  const concluido = rows.filter((r) => r.sla_status === "concluido").length;
  const concluidos_no_prazo = rows.filter(
    (r) => r.concluido_em && r.prazo_sla && new Date(r.concluido_em) <= new Date(r.prazo_sla + "T23:59:59"),
  ).length;
  const aderencia_pct = concluido > 0 ? Math.round((concluidos_no_prazo / concluido) * 100) : 0;
  return { total, no_prazo, em_risco, atrasado, concluido, aderencia_pct };
}
