import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PosicaoFinanceiraCliente } from "@/lib/financeiro/semaforoCliente";

const sb = supabase as any;

const SELECT_COLS =
  "cliente_futura_id, cliente_nome, em_aberto, vencido, a_vencer, " +
  "n_parcelas_abertas, n_parcelas_vencidas, n_pedidos_abertos, n_titulos_abertos, " +
  "proximo_vencimento, maior_atraso_dias, sincronizado_em";

function normalize(r: any): PosicaoFinanceiraCliente {
  return {
    cliente_futura_id: Number(r.cliente_futura_id),
    cliente_nome: r.cliente_nome ?? null,
    em_aberto: Number(r.em_aberto ?? 0),
    vencido: Number(r.vencido ?? 0),
    a_vencer: Number(r.a_vencer ?? 0),
    n_parcelas_abertas: Number(r.n_parcelas_abertas ?? 0),
    n_parcelas_vencidas: Number(r.n_parcelas_vencidas ?? 0),
    n_pedidos_abertos: Number(r.n_pedidos_abertos ?? 0),
    n_titulos_abertos: Number(r.n_titulos_abertos ?? 0),
    proximo_vencimento: r.proximo_vencimento ?? null,
    maior_atraso_dias: Number(r.maior_atraso_dias ?? 0),
    sincronizado_em: r.sincronizado_em ?? null,
  };
}

/** Busca a posição financeira de um cliente. Retorna null quando não há linha (cliente em dia). */
export function usePosicaoFinanceiraCliente(clienteFuturaId: number | null | undefined) {
  return useQuery({
    queryKey: ["cliente_financeiro", clienteFuturaId ?? null],
    enabled: clienteFuturaId != null,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<PosicaoFinanceiraCliente | null> => {
      const { data, error } = await sb
        .from("cliente_financeiro")
        .select(SELECT_COLS)
        .eq("cliente_futura_id", clienteFuturaId)
        .maybeSingle();
      if (error) throw error;
      return data ? normalize(data) : null;
    },
  });
}

/** Busca em lote por vários clientes. Retorna um Map<id, posicao>. */
export function usePosicaoFinanceiraClientesBulk(ids: (number | null | undefined)[]) {
  const clean = Array.from(new Set(ids.filter((x): x is number => typeof x === "number" && x > 0))).sort();
  return useQuery({
    queryKey: ["cliente_financeiro_bulk", clean],
    enabled: clean.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Map<number, PosicaoFinanceiraCliente>> => {
      // supabase limita ~1000 items em .in(); chunk defensivo
      const CHUNK = 500;
      const map = new Map<number, PosicaoFinanceiraCliente>();
      for (let i = 0; i < clean.length; i += CHUNK) {
        const slice = clean.slice(i, i + CHUNK);
        const { data, error } = await sb
          .from("cliente_financeiro")
          .select(SELECT_COLS)
          .in("cliente_futura_id", slice);
        if (error) throw error;
        for (const row of data ?? []) {
          const n = normalize(row);
          map.set(n.cliente_futura_id, n);
        }
      }
      return map;
    },
  });
}
