import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const EMPRESA_RESULT_NOME: Record<number, string> = {
  3: "Union MG",
  4: "Union PR",
  5: "Party",
  6: "Union SP / Glass",
  8: "Union PE",
  9: "New Cosmic",
  10: "Midday",
  11: "A Gente",
};

export function nomeEmpresaResult(id: number | null | undefined): string {
  if (id == null) return "—";
  return EMPRESA_RESULT_NOME[id] ?? `Empresa ${id}`;
}

export interface EntradaResultRow {
  id: number;
  empresa_result: number;
  fornecedor_nome: string | null;
  fornecedor_cnpj: string | null;
  numero_nota: string | null;
  serie: string | null;
  chave_nfe: string | null;
  data_emissao: string | null;
  data_entrada: string | null;
  cfop: number | null;
  cst: string | null;
  classe: string | null;
  valor_contabil: number;
  base_icms: number;
  valor_icms: number;
  base_st: number;
  valor_st: number;
  valor_ipi: number;
}

export interface UseEntradasResultOpts {
  from: string;
  to: string;
  empresas: number[];
  classes: string[];
}

const HARD_CAP = 20000;

export function useEntradasResult(opts: UseEntradasResultOpts) {
  return useQuery({
    queryKey: [
      "compras-entradas-result",
      opts.from,
      opts.to,
      [...opts.empresas].sort(),
      [...opts.classes].sort(),
    ],
    staleTime: 60_000,
    queryFn: async (): Promise<EntradaResultRow[]> => {
      let q = supabase
        .from("erp_compras_result" as any)
        .select(
          "id,empresa_result,fornecedor_nome,fornecedor_cnpj,numero_nota,serie,chave_nfe,data_emissao,data_entrada,cfop,cst,classe,valor_contabil,base_icms,valor_icms,base_st,valor_st,valor_ipi",
        )
        .gte("data_entrada", opts.from)
        .lte("data_entrada", opts.to)
        .order("data_entrada", { ascending: false })
        .limit(HARD_CAP);
      if (opts.empresas.length) q = q.in("empresa_result", opts.empresas);
      if (opts.classes.length) q = q.in("classe", opts.classes);
      const { data, error } = await q;
      if (error) throw error;
      return ((data as any[]) ?? []).map((r) => ({
        id: Number(r.id),
        empresa_result: Number(r.empresa_result),
        fornecedor_nome: r.fornecedor_nome,
        fornecedor_cnpj: r.fornecedor_cnpj,
        numero_nota: r.numero_nota,
        serie: r.serie,
        chave_nfe: r.chave_nfe,
        data_emissao: r.data_emissao,
        data_entrada: r.data_entrada,
        cfop: r.cfop == null ? null : Number(r.cfop),
        cst: r.cst,
        classe: r.classe,
        valor_contabil: Number(r.valor_contabil ?? 0),
        base_icms: Number(r.base_icms ?? 0),
        valor_icms: Number(r.valor_icms ?? 0),
        base_st: Number(r.base_st ?? 0),
        valor_st: Number(r.valor_st ?? 0),
        valor_ipi: Number(r.valor_ipi ?? 0),
      }));
    },
  });
}

export interface ComprasVendasRow {
  empresa_result: number;
  mes: string;
  compras_revenda: number;
  compras_uso_consumo: number;
  devolucoes_venda: number;
  transferencias: number;
  vendas_preco: number;
  vendas_ultimo_custo: number;
  vendas_custo_familia: number;
}

export function useComprasVendasMensal(opts: {
  empresas: number[];
  from: string;
  to: string;
}) {
  return useQuery({
    queryKey: [
      "compras-vendas-mensal",
      [...opts.empresas].sort(),
      opts.from,
      opts.to,
    ],
    staleTime: 60_000,
    queryFn: async (): Promise<ComprasVendasRow[]> => {
      let q = supabase
        .from("erp_compras_vendas_mensal" as any)
        .select(
          "empresa_result,mes,compras_revenda,compras_uso_consumo,devolucoes_venda,transferencias,vendas_preco,vendas_ultimo_custo,vendas_custo_familia",
        )
        .gte("mes", opts.from)
        .lte("mes", opts.to)
        .order("mes", { ascending: true });
      if (opts.empresas.length) q = q.in("empresa_result", opts.empresas);
      const { data, error } = await q;
      if (error) throw error;
      return ((data as any[]) ?? []).map((r) => ({
        empresa_result: Number(r.empresa_result),
        mes: r.mes,
        compras_revenda: Number(r.compras_revenda ?? 0),
        compras_uso_consumo: Number(r.compras_uso_consumo ?? 0),
        devolucoes_venda: Number(r.devolucoes_venda ?? 0),
        transferencias: Number(r.transferencias ?? 0),
        vendas_preco: Number(r.vendas_preco ?? 0),
        vendas_ultimo_custo: Number(r.vendas_ultimo_custo ?? 0),
        vendas_custo_familia: Number(r.vendas_custo_familia ?? 0),
      }));
    },
  });
}
