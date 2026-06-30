import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";

export interface SerieMensalClienteRubyspPoint {
  mes: Date;
  faturamento: number;
  quantidade: number;
  n_pedidos: number;
}

const sb = supabase as any;

/**
 * Série mensal de compras do cliente (painel Result / Ruby_SP).
 *
 * - RPC: serie_mensal_cliente_rubysp(p_cliente_id bigint)
 * - ano_mes vem como char(7) 'YYYY-MM' → montamos com '-01' antes do parseLocalDate.
 * - faturamento/quantidade vêm como numeric (string via PostgREST) → Number(...) || 0.
 * - Preenche meses faltantes com 0 entre o 1º e o último mês (essencial p/ forecast).
 */
export function useSerieMensalClienteRubysp(
  clienteId: number | null | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: ["rubysp-serie-mensal-cliente", clienteId],
    queryFn: async (): Promise<SerieMensalClienteRubyspPoint[]> => {
      if (!clienteId) return [];
      const { data, error } = await sb.rpc("serie_mensal_cliente_rubysp", {
        p_cliente_id: Number(clienteId),
      });
      if (error) throw error;

      const raw = ((data ?? []) as any[])
        .map((r) => {
          const ym = String(r.ano_mes ?? "").slice(0, 7);
          const dt = parseLocalDate(`${ym}-01`);
          return {
            mes: dt ?? new Date(`${ym}-01T00:00:00`),
            faturamento: Number(r.faturamento) || 0,
            quantidade: Number(r.quantidade) || 0,
            n_pedidos: Number(r.n_pedidos) || 0,
          };
        })
        .filter((p) => !isNaN(p.mes.getTime()))
        .sort((a, b) => a.mes.getTime() - b.mes.getTime());

      if (raw.length === 0) return [];

      // Preencher meses faltantes com zero (iteração mês a mês).
      const filled: SerieMensalClienteRubyspPoint[] = [];
      const first = raw[0].mes;
      const last = raw[raw.length - 1].mes;
      const map = new Map<string, SerieMensalClienteRubyspPoint>();
      for (const p of raw) {
        const key = `${p.mes.getFullYear()}-${p.mes.getMonth()}`;
        map.set(key, p);
      }
      const cur = new Date(first.getFullYear(), first.getMonth(), 1);
      const end = new Date(last.getFullYear(), last.getMonth(), 1);
      while (cur.getTime() <= end.getTime()) {
        const key = `${cur.getFullYear()}-${cur.getMonth()}`;
        const existing = map.get(key);
        filled.push(
          existing ?? {
            mes: new Date(cur.getFullYear(), cur.getMonth(), 1),
            faturamento: 0,
            quantidade: 0,
            n_pedidos: 0,
          },
        );
        cur.setMonth(cur.getMonth() + 1);
      }
      return filled;
    },
    enabled: Boolean(clienteId) && enabled,
    staleTime: 5 * 60 * 1000,
  });
}
