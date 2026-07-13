import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;

export interface EntradaFuturaRow {
  venda_id: number;
  futura_nota_id: number;
  nro_nota: number | null;
  serie: string | null;
  data_entrada: string | null;
  empresa_id: number | null;
  empresa_nome: string | null;
  natureza: string | null;
  cfop_codigo: number | null;
  quantidade: number;
  total_produto: number;
  total_desconto: number;
  total_nota: number;
  total_icms_valor: number;
  total_st_valor: number;
  total_ipi_valor: number;
  total_tributos_valor: number;
}

export interface EntradasFiltros {
  from: string; // YYYY-MM-DD
  to: string;
  empresas: number[]; // vazio = todas
  naturezas: string[]; // vazio = todas
}

const PAGE = 1000;

export function useEntradasFutura(filtros: EntradasFiltros) {
  return useQuery({
    queryKey: ["compras-entradas-futura", filtros],
    queryFn: async (): Promise<EntradaFuturaRow[]> => {
      const acc: EntradaFuturaRow[] = [];
      let from = 0;
      // paginação defensiva
      // eslint-disable-next-line no-constant-condition
      while (true) {
        let q = sb
          .from("erp_compras")
          .select(
            "venda_id, futura_nota_id, nro_nota, serie, data_entrada, empresa_id, empresa_nome, natureza, cfop_codigo, quantidade, total_produto, total_desconto, total_nota, total_icms_valor, total_st_valor, total_ipi_valor, total_tributos_valor",
          )
          .gte("data_entrada", filtros.from)
          .lte("data_entrada", filtros.to)
          .order("data_entrada", { ascending: false })
          .range(from, from + PAGE - 1);

        if (filtros.empresas.length) q = q.in("empresa_id", filtros.empresas);
        if (filtros.naturezas.length) q = q.in("natureza", filtros.naturezas);

        const { data, error } = await q;
        if (error) throw error;
        if (!data || data.length === 0) break;
        for (const r of data) {
          acc.push({
            venda_id: Number(r.venda_id),
            futura_nota_id: Number(r.futura_nota_id),
            nro_nota: r.nro_nota ?? null,
            serie: r.serie ?? null,
            data_entrada: r.data_entrada ?? null,
            empresa_id: r.empresa_id ?? null,
            empresa_nome: r.empresa_nome ?? null,
            natureza: r.natureza ?? null,
            cfop_codigo: r.cfop_codigo ?? null,
            quantidade: Number(r.quantidade ?? 0),
            total_produto: Number(r.total_produto ?? 0),
            total_desconto: Number(r.total_desconto ?? 0),
            total_nota: Number(r.total_nota ?? 0),
            total_icms_valor: Number(r.total_icms_valor ?? 0),
            total_st_valor: Number(r.total_st_valor ?? 0),
            total_ipi_valor: Number(r.total_ipi_valor ?? 0),
            total_tributos_valor: Number(r.total_tributos_valor ?? 0),
          });
        }
        if (data.length < PAGE) break;
        from += PAGE;
        if (from > 100_000) break;
      }
      return acc;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export interface EntradaItemRow {
  id: number;
  sequencia: number | null;
  cod_produto: string | null;
  descricao: string | null;
  ncm: string | null;
  cfop_codigo: number | null;
  quantidade: number;
  quantidade_un: number | null;
  unidade_sigla: string | null;
  valor_unitario: number;
  total_item: number;
  icms_valor: number;
  st_valor: number;
  ipi_valor: number;
  tributos_valor: number;
}

export function useEntradaItens(futuraNotaId: number | null) {
  return useQuery({
    queryKey: ["compras-entrada-itens", futuraNotaId],
    enabled: !!futuraNotaId,
    queryFn: async (): Promise<EntradaItemRow[]> => {
      const { data, error } = await sb
        .from("erp_vendas_item")
        .select(
          "id, sequencia, cod_produto, descricao, ncm, cfop_codigo, quantidade, quantidade_un, unidade_sigla, valor_unitario, total_item, icms_valor, st_valor, ipi_valor, tributos_valor",
        )
        .eq("futura_nota_id", futuraNotaId)
        .order("sequencia", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: Number(r.id),
        sequencia: r.sequencia ?? null,
        cod_produto: r.cod_produto ?? null,
        descricao: r.descricao ?? null,
        ncm: r.ncm ?? null,
        cfop_codigo: r.cfop_codigo ?? null,
        quantidade: Number(r.quantidade ?? 0),
        quantidade_un: r.quantidade_un !== null ? Number(r.quantidade_un) : null,
        unidade_sigla: r.unidade_sigla ?? null,
        valor_unitario: Number(r.valor_unitario ?? 0),
        total_item: Number(r.total_item ?? 0),
        icms_valor: Number(r.icms_valor ?? 0),
        st_valor: Number(r.st_valor ?? 0),
        ipi_valor: Number(r.ipi_valor ?? 0),
        tributos_valor: Number(r.tributos_valor ?? 0),
      }));
    },
    staleTime: 60 * 1000,
  });
}

/** Busca ids de futura_nota_id que contêm itens com código/descrição casando o termo. */
export function useNotasComProduto(termo: string, from: string, to: string) {
  return useQuery({
    queryKey: ["compras-notas-com-produto", termo, from, to],
    enabled: termo.trim().length >= 2,
    queryFn: async (): Promise<Set<number>> => {
      const t = termo.trim();
      const ids = new Set<number>();
      let offset = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error } = await sb
          .from("erp_vendas_item")
          .select("futura_nota_id, cod_produto, descricao, data_emissao")
          .gte("data_emissao", from)
          .lte("data_emissao", to)
          .or(`cod_produto.ilike.%${t}%,descricao.ilike.%${t}%`)
          .range(offset, offset + PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        for (const r of data) {
          if (r.futura_nota_id != null) ids.add(Number(r.futura_nota_id));
        }
        if (data.length < PAGE) break;
        offset += PAGE;
        if (offset > 100_000) break;
      }
      return ids;
    },
    staleTime: 60 * 1000,
  });
}

