import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PedidoFornecedor } from "@/hooks/fornecedor/useFornecedorPedidos";

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
}

interface UseRubyspPedidosArgs {
  dateFrom?: Date;
  dateTo?: Date;
}

/**
 * Lê `vw_pedidos_kanban_rubysp` e adapta cada linha para o shape `PedidoFornecedor`
 * usado pelos componentes `PedidosKanban` / `PedidoCard` / `PedidoDetalheDrawer`.
 * Assim o painel Result reaproveita exatamente os mesmos blocos visuais do Futura.
 */
export function useRubyspPedidos({ dateFrom, dateTo }: UseRubyspPedidosArgs) {
  return useQuery({
    queryKey: ["rubysp-pedidos", dateFrom?.toISOString(), dateTo?.toISOString()],
    queryFn: async (): Promise<PedidoFornecedor[]> => {
      let q = (supabase as any)
        .from("vw_pedidos_kanban_rubysp")
        .select("*")
        .order("data_pedido", { ascending: false })
        .limit(5000);
      if (dateFrom) q = q.gte("data_pedido", dateFrom.toISOString().slice(0, 10));
      if (dateTo) q = q.lte("data_pedido", dateTo.toISOString().slice(0, 10));
      const { data, error } = await q;
      if (error) throw error;
      return ((data ?? []) as PedidoRubyspRaw[]).map((r) => adaptRubyspToPedido(r));
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

function adaptRubyspToPedido(r: PedidoRubyspRaw): PedidoFornecedor {
  const idadeMin = r.idade_etapa_min ?? 0;
  const diasNaEtapa = idadeMin > 0 ? idadeMin / 1440 : 0;
  const enderecoEntrega = r.endereco_entrega
    ?? [r.endereco_logradouro, r.endereco_numero, r.endereco_bairro, r.cliente_cidade, r.cliente_uf]
      .filter(Boolean)
      .join(", ")
    ?? null;
  const futuraPedidoId = (r.rubysp_pedido_id ?? r.id ?? 0) as number;
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
  };
}
