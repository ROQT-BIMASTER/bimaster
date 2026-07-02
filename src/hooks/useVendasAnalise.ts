import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface VendasFilters {
  de: string | null;
  ate: string | null;
  empresa: number | null;
  /** legado (uuid) — não é enviado às novas RPCs, mantido apenas para telas antigas */
  vendedor: string | null;
  /** legado (uuid) — idem */
  coordenador: string | null;
  // Filtros globais da nova tela Resultados de Vendas
  tabelaPrecoId?: number | null;
  uf?: string | null;
  clienteId?: number | null;
  vendedorId?: number | null; // futura int
}

function rpcParams(f: VendasFilters) {
  return {
    p_de: f.de,
    p_ate: f.ate,
    p_empresa: f.empresa,
    p_tabela_preco: f.tabelaPrecoId ?? null,
    p_uf: f.uf ?? null,
    p_cliente: f.clienteId ?? null,
    p_vendedor: f.vendedorId ?? null,
  };
}

const STALE = 5 * 60 * 1000;
const sb = supabase as any;

export function useVendasKpis(f: VendasFilters) {
  return useQuery({
    queryKey: ["vendas_kpis", f],
    queryFn: async () => {
      const { data, error } = await sb.rpc("vendas_kpis", rpcParams(f));
      if (error) throw error;
      const row = (data?.[0] ?? {}) as any;
      return {
        faturamento: Number(row.faturamento ?? 0),
        notas: Number(row.notas ?? 0),
        ticket_medio: Number(row.ticket_medio ?? 0),
        qtd_total: Number(row.qtd_total ?? 0),
        qtd_un: Number(row.qtd_un ?? 0),
        clientes: Number(row.clientes ?? 0),
        vendedores: Number(row.vendedores ?? 0),
      };
    },
    staleTime: STALE,
  });
}

export function useVendasSerieMensal(f: VendasFilters) {
  return useQuery({
    queryKey: ["vendas_serie_mensal", f],
    queryFn: async () => {
      const { data, error } = await sb.rpc("vendas_serie_mensal", rpcParams(f));
      if (error) throw error;
      return (data || []).map((r: any) => ({
        mes: r.mes as string,
        faturamento: Number(r.faturamento ?? 0),
        notas: Number(r.notas ?? 0),
      }));
    },
    staleTime: STALE,
  });
}

export function useVendasRankingVendedor(f: VendasFilters) {
  return useQuery({
    queryKey: ["vendas_ranking_vendedor", f],
    queryFn: async () => {
      const { data, error } = await sb.rpc("vendas_ranking_vendedor", {
        p_de: f.de, p_ate: f.ate, p_empresa: f.empresa, p_coordenador: f.coordenador,
      });
      if (error) throw error;
      return (data || []).map((r: any) => ({
        vendedor_id: r.vendedor_id as string | null,
        vendedor_nome: r.vendedor_nome as string,
        coordenador_nome: r.coordenador_nome as string | null,
        notas: Number(r.notas ?? 0),
        faturamento: Number(r.faturamento ?? 0),
        ticket_medio: Number(r.ticket_medio ?? 0),
      }));
    },
    staleTime: STALE,
  });
}

export function useVendasRankingCoordenador(f: VendasFilters) {
  return useQuery({
    queryKey: ["vendas_ranking_coordenador", f],
    queryFn: async () => {
      const { data, error } = await sb.rpc("vendas_ranking_coordenador", {
        p_de: f.de, p_ate: f.ate, p_empresa: f.empresa,
      });
      if (error) throw error;
      return (data || []).map((r: any) => ({
        coordenador_id: r.coordenador_id as string | null,
        coordenador_nome: r.coordenador_nome as string,
        notas: Number(r.notas ?? 0),
        faturamento: Number(r.faturamento ?? 0),
      }));
    },
    staleTime: STALE,
  });
}

export function useVendasTopClientes(f: VendasFilters, limite = 10) {
  return useQuery({
    queryKey: ["vendas_top_clientes", f, limite],
    queryFn: async () => {
      const { data, error } = await sb.rpc("vendas_top_clientes", {
        ...rpcParams(f), p_limit: limite,
      });
      if (error) throw error;
      return (data || []).map((r: any) => ({
        cliente_futura_id: r.cliente_futura_id as number,
        cliente_nome: r.cliente_nome as string,
        notas: Number(r.notas ?? 0),
        faturamento: Number(r.faturamento ?? 0),
      }));
    },
    staleTime: STALE,
  });
}

export function useEmpresasDistintas() {
  return useQuery({
    queryKey: ["v_vendas_empresas"],
    queryFn: async () => {
      const { data, error } = await sb.from("v_vendas").select("empresa_id").limit(5000);
      if (error) throw error;
      const set = new Set<number>();
      (data || []).forEach((r: any) => { if (r.empresa_id != null) set.add(r.empresa_id); });
      return [...set].sort((a, b) => a - b);
    },
    staleTime: 60 * 60 * 1000,
  });
}

export function useVendedoresLista() {
  return useQuery({
    queryKey: ["vendedores_lista"],
    queryFn: async () => {
      const { data, error } = await sb.from("vendedores")
        .select("id,nome").eq("ativo", true).order("nome");
      if (error) throw error;
      return (data || []) as { id: string; nome: string }[];
    },
    staleTime: 60 * 60 * 1000,
  });
}

export function useCoordenadoresLista() {
  return useQuery({
    queryKey: ["coordenadores_lista"],
    queryFn: async () => {
      const { data, error } = await sb.from("coordenadores").select("id,nome").order("nome");
      if (error) throw error;
      return (data || []) as { id: string; nome: string }[];
    },
    staleTime: 60 * 60 * 1000,
  });
}

export interface NotaItemAgg {
  qtd_un: number;
  sigla_dominante: string | null; // "DZ" | "UN" | "CX" ... ou null se misto
  itens_caixa: number | null;     // único quando todos os itens compartilham; senão null
}

export function useNotasPeriodo(f: VendasFilters, page: number, pageSize = 50) {
  return useQuery({
    queryKey: ["notas_periodo", f, page, pageSize],
    queryFn: async () => {
      let q = sb.from("v_vendas")
        .select("futura_nota_id,data_emissao,nro_nota,serie,cliente_nome,vendedor_nome,coordenador_nome,total_nota", { count: "exact" })
        .order("data_emissao", { ascending: false })
        .range(page * pageSize, page * pageSize + pageSize - 1);
      if (f.de) q = q.gte("data_emissao", f.de);
      if (f.ate) q = q.lte("data_emissao", f.ate);
      if (f.empresa != null) q = q.eq("empresa_id", f.empresa);
      if (f.vendedor) q = q.eq("vendedor_id", f.vendedor);
      if (f.coordenador) q = q.eq("coordenador_id", f.coordenador);
      const { data, error, count } = await q;
      if (error) throw error;
      const rows = (data || []) as any[];

      // Sub-agregação por nota (sem fan-out no header)
      const ids = rows.map((r) => r.futura_nota_id).filter((x) => x != null);
      const itemMap: Record<string, NotaItemAgg> = {};
      if (ids.length > 0) {
        const { data: items, error: e2 } = await sb
          .from("erp_vendas_item")
          .select("futura_nota_id,quantidade_un,unidade_sigla,itens_caixa")
          .in("futura_nota_id", ids);
        if (e2) throw e2;
        for (const it of (items || []) as any[]) {
          const key = String(it.futura_nota_id);
          const cur = itemMap[key] ?? { qtd_un: 0, sigla_dominante: undefined as any, itens_caixa: undefined as any };
          cur.qtd_un += Number(it.quantidade_un ?? 0);
          // sigla dominante: única em todos os itens, ou null
          if (cur.sigla_dominante === undefined) cur.sigla_dominante = it.unidade_sigla ?? null;
          else if (cur.sigla_dominante !== (it.unidade_sigla ?? null)) cur.sigla_dominante = null;
          // itens_caixa: único em todos os itens, ou null
          const ic = it.itens_caixa == null ? null : Number(it.itens_caixa);
          if (cur.itens_caixa === undefined) cur.itens_caixa = ic;
          else if (cur.itens_caixa !== ic) cur.itens_caixa = null;
          itemMap[key] = cur;
        }
        // normaliza undefined -> null
        for (const k of Object.keys(itemMap)) {
          if (itemMap[k].sigla_dominante === undefined) itemMap[k].sigla_dominante = null;
          if (itemMap[k].itens_caixa === undefined) itemMap[k].itens_caixa = null;
        }
      }

      return { rows, count: count || 0, itemMap };
    },
    staleTime: 60 * 1000,
  });
}
