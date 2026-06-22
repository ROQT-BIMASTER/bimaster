import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface VendasFilters {
  de: string | null;
  ate: string | null;
  empresa: number | null;
  vendedor: string | null;
  coordenador: string | null;
}

function rpcParams(f: VendasFilters) {
  return {
    p_de: f.de,
    p_ate: f.ate,
    p_empresa: f.empresa,
    p_vendedor: f.vendedor,
    p_coordenador: f.coordenador,
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
        ...rpcParams(f), p_limite: limite,
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

export function useNotasPeriodo(f: VendasFilters, page: number, pageSize = 50) {
  return useQuery({
    queryKey: ["notas_periodo", f, page, pageSize],
    queryFn: async () => {
      let q = sb.from("v_vendas")
        .select("data_emissao,nro_nota,serie,cliente_nome,vendedor_nome,coordenador_nome,total_nota", { count: "exact" })
        .order("data_emissao", { ascending: false })
        .range(page * pageSize, page * pageSize + pageSize - 1);
      if (f.de) q = q.gte("data_emissao", f.de);
      if (f.ate) q = q.lte("data_emissao", f.ate);
      if (f.empresa != null) q = q.eq("empresa_id", f.empresa);
      if (f.vendedor) q = q.eq("vendedor_id", f.vendedor);
      if (f.coordenador) q = q.eq("coordenador_id", f.coordenador);
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: data || [], count: count || 0 };
    },
    staleTime: 60 * 1000,
  });
}
