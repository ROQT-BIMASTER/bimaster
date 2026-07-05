// Hooks da fila de alertas da Torre (Fase 2): listar, transicionar (com trilha
// imutável) e reprocessar a detecção. Escrita SÓ via RPC SECURITY DEFINER —
// nunca UPDATE direto (a tabela não tem policy de escrita p/ authenticated).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ABAS_STATUS,
  SEVERIDADE_ORDEM,
  type AlertaAba,
  type AlertaSeveridade,
  type AlertaStatus,
  type DespesaAlerta,
  type DeteccaoResultado,
} from "@/types/financeiro/torre-alertas";

/** Evento imutável da trilha de transições (public.despesa_alertas_eventos). */
export interface DespesaAlertaEvento {
  id: string;
  alerta_id: string;
  de_status: AlertaStatus | null;
  para_status: AlertaStatus | null;
  usuario_id: string | null;
  nota: string | null;
  created_at: string;
}

/** Filtros da tela central de alertas. */
export interface AlertaFiltrosCentral {
  severidades: AlertaSeveridade[];
  statuses: AlertaStatus[];
  regras: string[]; // ex: ["R01", "R03"]
  empresaIds: number[];
  competenciaDe: string | null; // YYYY-MM-DD
  competenciaAte: string | null;
  busca: string; // fornecedor / titulo / descricao
}

const STALE = 30_000;

// As RPCs/tabela ainda não estão nos tipos gerados do Supabase — cast controlado.
function tbl() {
  return supabase.from("despesa_alertas" as never);
}

/** Lista alertas da aba, ranqueados por severidade × valor de impacto. */
export function useTorreAlertas(aba: AlertaAba) {
  const statuses = ABAS_STATUS[aba];
  return useQuery({
    queryKey: ["torre-alertas", aba],
    queryFn: async () => {
      const { data, error } = await tbl()
        .select("*")
        .in("status", statuses as never)
        .order("valor_impacto", { ascending: false, nullsFirst: false })
        .limit(300);
      if (error) throw error;
      const rows = (data ?? []) as unknown as DespesaAlerta[];
      // ordenação final por severidade (o servidor já trouxe por valor)
      return [...rows].sort(
        (a, b) =>
          (SEVERIDADE_ORDEM[b.severidade] ?? 0) - (SEVERIDADE_ORDEM[a.severidade] ?? 0) ||
          (b.valor_impacto ?? 0) - (a.valor_impacto ?? 0),
      );
    },
    staleTime: STALE,
  });
}

/** Contagem por aba (para os badges das tabs). */
export function useTorreAlertasContagem() {
  return useQuery({
    queryKey: ["torre-alertas-contagem"],
    queryFn: async () => {
      const { data, error } = await tbl().select("status");
      if (error) throw error;
      const rows = (data ?? []) as unknown as { status: AlertaStatus }[];
      const acc: Record<AlertaAba, number> = { novo: 0, em_analise: 0, acionado: 0, encerrado: 0 };
      for (const r of rows) {
        if (r.status === "novo") acc.novo++;
        else if (r.status === "em_analise") acc.em_analise++;
        else if (r.status === "acionado") acc.acionado++;
        else acc.encerrado++;
      }
      return acc;
    },
    staleTime: STALE,
  });
}

interface TransicaoArgs {
  alertaId: string;
  novoStatus: AlertaStatus;
  justificativa?: string | null;
  revisaoId?: string | null;
}

/** Transição de estado do alerta (grava na trilha imutável via RPC). */
export function useAlertaTransicao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ alertaId, novoStatus, justificativa, revisaoId }: TransicaoArgs) => {
      const { data, error } = await supabase.rpc("fn_despesas_alerta_transicao" as never, {
        p_alerta_id: alertaId,
        p_novo_status: novoStatus,
        p_justificativa: justificativa ?? null,
        p_revisao_id: revisaoId ?? null,
      } as never);
      if (error) throw error;
      return data as unknown as DespesaAlerta;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["torre-alertas"] });
      qc.invalidateQueries({ queryKey: ["torre-alertas-contagem"] });
    },
  });
}

/** Reprocessa a detecção (admin/supervisor). Pode levar 1-2 min na primeira vez. */
export function useReprocessarDeteccao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (regras?: string[]) => {
      const { data, error } = await supabase.rpc("rpc_torre_reprocessar_deteccao" as never, {
        p_regras: regras && regras.length > 0 ? regras : null,
      } as never);
      if (error) throw error;
      return (data ?? []) as unknown as DeteccaoResultado[];
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["torre-alertas"] });
      qc.invalidateQueries({ queryKey: ["torre-alertas-contagem"] });
    },
  });
}

/** Lista central com filtros combinados (paginado no cliente até 500). */
export function useAlertasCentral(f: AlertaFiltrosCentral) {
  return useQuery({
    queryKey: ["torre-alertas-central", f],
    queryFn: async () => {
      let q = tbl().select("*").order("primeiro_detectado_em", { ascending: false }).limit(500);
      if (f.severidades.length) q = q.in("severidade", f.severidades as never);
      if (f.statuses.length) q = q.in("status", f.statuses as never);
      if (f.empresaIds.length) q = q.in("empresa_id", f.empresaIds as never);
      if (f.competenciaDe) q = q.gte("competencia", f.competenciaDe);
      if (f.competenciaAte) q = q.lte("competencia", f.competenciaAte);
      const { data, error } = await q;
      if (error) throw error;
      let rows = (data ?? []) as unknown as DespesaAlerta[];
      if (f.regras.length) {
        rows = rows.filter((r) => f.regras.includes(r.regra_codigo.slice(0, 3)));
      }
      const t = f.busca.trim().toLowerCase();
      if (t) {
        rows = rows.filter(
          (r) =>
            r.titulo.toLowerCase().includes(t) ||
            (r.descricao ?? "").toLowerCase().includes(t) ||
            (r.fornecedor_nome ?? "").toLowerCase().includes(t) ||
            (r.fornecedor_codigo ?? "").toLowerCase().includes(t),
        );
      }
      return rows.sort(
        (a, b) =>
          (SEVERIDADE_ORDEM[b.severidade] ?? 0) - (SEVERIDADE_ORDEM[a.severidade] ?? 0) ||
          (b.valor_impacto ?? 0) - (a.valor_impacto ?? 0),
      );
    },
    staleTime: STALE,
  });
}

/** Trilha imutável de transições do alerta (public.despesa_alertas_eventos). */
export function useAlertaHistorico(alertaId: string | null) {
  return useQuery({
    queryKey: ["torre-alertas-eventos", alertaId],
    enabled: !!alertaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("despesa_alertas_eventos" as never)
        .select("*")
        .eq("alerta_id", alertaId as string)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as DespesaAlertaEvento[];
    },
    staleTime: 10_000,
  });
}
