import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PedidoFornecedor } from "@/hooks/fornecedor/useFornecedorPedidos";

export interface RubyspMarcos {
  digitacao: string | null;
  liberacao: string | null;
  separacao: string | null;
  conferencia: string | null;
  expedicao: string | null;
  faturamento: string | null;
  entrega: string | null;
}

export interface RubyspTempos {
  digitacao_lib_min: number | null;
  aguard_separacao_min: number | null;
  separacao_min: number | null;
  aguard_expedicao_min: number | null;
  faturamento_min: number | null;
  entrega_min: number | null;
  lead_time_min: number | null;
  lead_time_entrega_min: number | null;
}

/** Pedido Futura-shape acrescido de marcos/tempos exclusivos do Result. */
export type PedidoRubyspExt = PedidoFornecedor & {
  tem_canhoto?: boolean;
  marcos?: RubyspMarcos;
  tempos?: RubyspTempos;
};

export interface PedidoRubyspRaw {
  rubysp_pedido_id: number | null;
  id: number | null;
  empresa_id: number | null;
  cliente_id: number | null;
  cliente_nome: string | null;
  cliente_cnpj: string | null;
  cliente_cidade: string | null;
  cliente_uf: string | null;
  vendedor_id: number | null;
  vendedor_nome: string | null;
  cond_pagamento_id: number | null;
  cond_pagamento_desc: string | null;
  nf_numero: number | null;
  data_pedido: string | null;
  data_entrega: string | null;
  etapa: string | null;
  etapa_ordem: number | null;
  etapa_desde: string | null;
  idade_etapa_min: number | null;
  finalizado: boolean | null;
  tem_canhoto: boolean | null;
  endereco_entrega: string | null;
  endereco_logradouro: string | null;
  endereco_numero: string | null;
  endereco_bairro: string | null;
  endereco_cep: string | null;
  entrega_local: string | null;
  entrega_obs: string | null;
  motivo_cancelamento: string | null;
  total_pedido: number | null;
  status: string | null;
  sincronizado_em: string | null;
  // marcos / tempos (vindos da tabela base nos finalizados; podem faltar na view)
  digitacao_fim?: string | null;
  ts_liberacao?: string | null;
  ts_separacao?: string | null;
  ts_conferencia?: string | null;
  ts_expedicao?: string | null;
  ts_faturamento?: string | null;
  ts_entrega?: string | null;
  tempo_digitacao_lib_min?: number | null;
  tempo_aguard_separacao_min?: number | null;
  tempo_separacao_min?: number | null;
  tempo_aguard_expedicao_min?: number | null;
  tempo_faturamento_min?: number | null;
  tempo_entrega_min?: number | null;
  lead_time_min?: number | null;
  lead_time_entrega_min?: number | null;
}

interface UseRubyspPedidosArgs {
  dateFrom?: Date;
  dateTo?: Date;
  /** Dias para trás considerados na 2ª query de finalizados (entregue/faturado). Default 7. */
  finalizadosDias?: number;
}

/**
 * Lê `vw_pedidos_kanban_rubysp` (pedidos em andamento) e complementa com uma 2ª query
 * em `erp_pedidos_rubysp` para os finalizados recentes (etapa = 'entregue' | 'faturado'),
 * que a view não retorna porque filtra `finalizado = false`. Dedupe por `rubysp_pedido_id`.
 */
export function useRubyspPedidos({ dateFrom, dateTo, finalizadosDias = 7 }: UseRubyspPedidosArgs) {
  return useQuery({
    queryKey: [
      "rubysp-pedidos",
      dateFrom?.toISOString(),
      dateTo?.toISOString(),
      finalizadosDias,
    ],
    queryFn: async (): Promise<PedidoRubyspExt[]> => {
      const sb = supabase as any;

      // 1) Em andamento (view)
      let qView = sb
        .from("vw_pedidos_kanban_rubysp")
        .select("*")
        .order("data_pedido", { ascending: false })
        .limit(5000);
      if (dateFrom) qView = qView.gte("data_pedido", dateFrom.toISOString().slice(0, 10));
      if (dateTo) qView = qView.lte("data_pedido", dateTo.toISOString().slice(0, 10));

      // 2) Finalizados recentes (tabela base) — view filtra finalizado=false
      const sinceIso = new Date(Date.now() - finalizadosDias * 86_400_000).toISOString();
      const qFinal = sb
        .from("erp_pedidos_rubysp")
        .select(
          "rubysp_pedido_id,empresa_id,cliente_id,cliente_nome,cliente_cnpj,cliente_cidade,cliente_uf,vendedor_id,vendedor_nome,cond_pagamento_id,cond_pagamento_desc,nf_numero,data_pedido,data_entrega,etapa,etapa_ordem,etapa_desde,finalizado,tem_canhoto,endereco_entrega,endereco_logradouro,endereco_numero,endereco_bairro,endereco_cep,entrega_local,entrega_obs,motivo_cancelamento,total_pedido,status,sincronizado_em,digitacao_fim,ts_liberacao,ts_separacao,ts_conferencia,ts_expedicao,ts_faturamento,ts_entrega,tempo_digitacao_lib_min,tempo_aguard_separacao_min,tempo_separacao_min,tempo_aguard_expedicao_min,tempo_faturamento_min,tempo_entrega_min,lead_time_min,lead_time_entrega_min",
        )
        .in("etapa", ["entregue", "faturado"])
        .or(`ts_entrega.gte.${sinceIso},ts_faturamento.gte.${sinceIso}`)
        .order("ts_entrega", { ascending: false, nullsFirst: false })
        .limit(2000);

      const [{ data: dataView, error: errView }, { data: dataFinal, error: errFinal }] =
        await Promise.all([qView, qFinal]);
      if (errView) throw errView;
      if (errFinal) throw errFinal;

      // 3) Para os pedidos em andamento, buscamos marcos/tempos na tabela base em lote
      const inProgressIds = ((dataView ?? []) as PedidoRubyspRaw[])
        .map((r) => r.rubysp_pedido_id ?? r.id)
        .filter((x): x is number => typeof x === "number");

      let marcosMap: Record<number, Partial<PedidoRubyspRaw>> = {};
      if (inProgressIds.length > 0) {
        const { data: marcosRows, error: errMarcos } = await sb
          .from("erp_pedidos_rubysp")
          .select(
            "rubysp_pedido_id,digitacao_fim,ts_liberacao,ts_separacao,ts_conferencia,ts_expedicao,ts_faturamento,ts_entrega,tempo_digitacao_lib_min,tempo_aguard_separacao_min,tempo_separacao_min,tempo_aguard_expedicao_min,tempo_faturamento_min,tempo_entrega_min,lead_time_min,lead_time_entrega_min",
          )
          .in("rubysp_pedido_id", inProgressIds);
        if (errMarcos) throw errMarcos;
        for (const m of (marcosRows ?? []) as PedidoRubyspRaw[]) {
          if (m.rubysp_pedido_id != null) marcosMap[m.rubysp_pedido_id] = m;
        }
      }

      const adaptedView = ((dataView ?? []) as PedidoRubyspRaw[]).map((r) => {
        const extra = r.rubysp_pedido_id != null ? marcosMap[r.rubysp_pedido_id] : undefined;
        return adaptRubyspToPedido({ ...r, ...(extra ?? {}) });
      });
      const adaptedFinal = ((dataFinal ?? []) as PedidoRubyspRaw[]).map((r) =>
        adaptRubyspToPedido(r),
      );

      // Dedupe por id
      const map = new Map<number, PedidoRubyspExt>();
      for (const p of adaptedView) map.set(p.futura_pedido_id, p);
      for (const p of adaptedFinal) map.set(p.futura_pedido_id, p); // finalizados sobrescrevem
      return Array.from(map.values());
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

function adaptRubyspToPedido(r: PedidoRubyspRaw): PedidoRubyspExt {
  // Para finalizados, etapa_desde pode estar nula — usar ts_entrega/ts_faturamento como referência.
  const refEtapa = r.etapa_desde ?? r.ts_entrega ?? r.ts_faturamento ?? null;
  let diasNaEtapa = 0;
  if (r.idade_etapa_min != null && r.idade_etapa_min > 0) {
    diasNaEtapa = r.idade_etapa_min / 1440;
  } else if (refEtapa) {
    diasNaEtapa = Math.max(0, (Date.now() - new Date(refEtapa).getTime()) / 86_400_000);
  }

  const enderecoEntrega =
    r.endereco_entrega ??
    [r.endereco_logradouro, r.endereco_numero, r.endereco_bairro, r.cliente_cidade, r.cliente_uf]
      .filter(Boolean)
      .join(", ") ??
    null;

  const futuraPedidoId = (r.rubysp_pedido_id ?? r.id ?? 0) as number;

  const marcos: RubyspMarcos = {
    digitacao: r.digitacao_fim ?? r.data_pedido ?? null,
    liberacao: r.ts_liberacao ?? null,
    separacao: r.ts_separacao ?? null,
    conferencia: r.ts_conferencia ?? null,
    expedicao: r.ts_expedicao ?? null,
    faturamento: r.ts_faturamento ?? null,
    entrega: r.ts_entrega ?? null,
  };

  const tempos: RubyspTempos = {
    digitacao_lib_min: r.tempo_digitacao_lib_min ?? null,
    aguard_separacao_min: r.tempo_aguard_separacao_min ?? null,
    separacao_min: r.tempo_separacao_min ?? null,
    aguard_expedicao_min: r.tempo_aguard_expedicao_min ?? null,
    faturamento_min: r.tempo_faturamento_min ?? null,
    entrega_min: r.tempo_entrega_min ?? null,
    lead_time_min: r.lead_time_min ?? null,
    lead_time_entrega_min: r.lead_time_entrega_min ?? null,
  };

  return {
    futura_pedido_id: futuraPedidoId,
    empresa_id: r.empresa_id ?? null,
    nro_pedido: futuraPedidoId ? String(futuraPedidoId) : null,
    tipo_pedido_id: null,
    data_emissao: r.data_pedido,
    data_movimentacao: r.etapa_desde,
    data_previsao: r.data_entrega,
    cliente_futura_id: r.cliente_id ?? null,
    cliente_nome: r.cliente_nome,
    cliente_cnpj_cpf: r.cliente_cnpj,
    vendedor_futura_id: r.vendedor_id ?? null,
    vendedor_id: null,
    vendedor_nome: r.vendedor_nome,
    status: null,
    situacao_id: null,
    situacao_desc: r.status,
    cond_pagto_id: r.cond_pagamento_id ?? null,
    cond_pagto_desc: r.cond_pagamento_desc,
    nf_numero: r.nf_numero,
    endereco_entrega: enderecoEntrega || null,
    endereco_cep: r.endereco_cep,
    rastreio_link: null,
    etapa: r.etapa ?? "digitacao",
    etapa_ordem: r.etapa_ordem,
    urgente: false,
    etapa_desde: r.etapa_desde,
    dias_na_etapa: diasNaEtapa,
    em_andamento: !r.finalizado,
    total_produto: r.total_pedido,
    total_desconto: 0,
    total_pedido: r.total_pedido,
    observacao: r.entrega_obs,
    data_cancelamento: null,
    motivo_cancelamento: r.motivo_cancelamento,
    sincronizado_em: r.sincronizado_em,
    tem_canhoto: r.tem_canhoto ?? false,
    marcos,
    tempos,
  };
}
