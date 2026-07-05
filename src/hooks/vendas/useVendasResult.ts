import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;
const HOUR = 60 * 60 * 1000;

export interface EmpresaOpt { value: number; label: string }
export interface VendedorOpt { value: number; label: string }

export function useEmpresasResult() {
  return useQuery({
    queryKey: ["result_empresas"],
    staleTime: HOUR,
    queryFn: async (): Promise<EmpresaOpt[]> => {
      // Empresas presentes na base rubysp, cruzadas com dim_empresa para nomes.
      const { data: presentes, error: e1 } = await sb
        .from("v_vendas_rubysp")
        .select("empresa_id")
        .not("empresa_id", "is", null)
        .limit(50000);
      if (e1) throw e1;
      const set = new Set<number>();
      (presentes ?? []).forEach((r: any) => {
        if (r.empresa_id != null) set.add(Number(r.empresa_id));
      });
      if (set.size === 0) return [];
      const { data: nomes, error: e2 } = await sb
        .from("dim_empresa")
        .select("id_empresa,nome_empresa")
        .in("id_empresa", [...set]);
      if (e2) throw e2;
      const map = new Map<number, string>();
      (nomes ?? []).forEach((r: any) => map.set(Number(r.id_empresa), r.nome_empresa));
      return [...set]
        .map((id) => ({ value: id, label: map.get(id) ?? `Empresa ${id}` }))
        .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
    },
  });
}

export function useVendedoresResult() {
  return useQuery({
    queryKey: ["result_vendedores"],
    staleTime: HOUR,
    queryFn: async (): Promise<VendedorOpt[]> => {
      const { data, error } = await sb
        .from("v_vendas_rubysp")
        .select("vendedor_id,vendedor_nome")
        .not("vendedor_id", "is", null)
        .limit(50000);
      if (error) throw error;
      const map = new Map<number, string>();
      (data ?? []).forEach((r: any) => {
        const id = Number(r.vendedor_id);
        if (!map.has(id)) map.set(id, r.vendedor_nome ?? `Vendedor ${id}`);
      });
      return [...map.entries()]
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
    },
  });
}

export interface NotaResultRow {
  venda_id: number;
  nf_numero: number | null;
  data_venda: string;
  cliente_nome: string | null;
  vendedor_nome: string | null;
  total_venda: number;
  etapa: string | null;
}

export interface NotasResultParams {
  de: string;
  ate: string;
  empresa: number | null;
  vendedor: number | null;
  page: number;
  pageSize: number;
}

export function useNotasPeriodoResult(p: NotasResultParams) {
  return useQuery({
    queryKey: ["notas_result", p],
    staleTime: 60 * 1000,
    queryFn: async () => {
      let q = sb
        .from("v_vendas_rubysp")
        .select(
          "venda_id,nf_numero,data_venda,cliente_nome,vendedor_nome,total_venda,etapa",
          { count: "exact" },
        )
        .gte("data_venda", p.de)
        .lte("data_venda", p.ate)
        .order("data_venda", { ascending: false })
        .range(p.page * p.pageSize, p.page * p.pageSize + p.pageSize - 1);
      if (p.empresa != null) q = q.eq("empresa_id", p.empresa);
      if (p.vendedor != null) q = q.eq("vendedor_id", p.vendedor);
      const { data, error, count } = await q;
      if (error) throw error;
      return {
        rows: (data ?? []) as NotaResultRow[],
        count: count ?? 0,
      };
    },
  });
}
