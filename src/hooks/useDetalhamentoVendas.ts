import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaContext } from "@/contexts/EmpresaContext";
import { useOperacaoFilter } from "./useConfigOperacoes";
import type { DashboardFilters } from "./useDashboardKPIs";

export interface VendaDetalhe {
  id: string;
  data: string;
  pedido: number;
  nota: number | null;
  cliente: string;
  cod_cliente: number;
  descricao: string;
  marca: string;
  quantidade: number;
  receita: number;
  vl_desconto: number;
  vl_icm_subst: number;
  tabela: string;
  vendedor: string;
  supervisor: string;
  empresa: string;
  id_empresa: number;
  uf: string;
  cidade: string;
  operacao: string;
}

export function useDetalhamentoVendas(filters: DashboardFilters) {
  const { empresaIds } = useEmpresaContext();
  const { visiveis, multipliers, loaded } = useOperacaoFilter();

  const query = useQuery<VendaDetalhe[]>({
    queryKey: ["detalhamento-vendas", filters, empresaIds, [...visiveis]],
    queryFn: async () => {
      const startDate = filters.mes
        ? `${filters.ano}-${String(filters.mes).padStart(2, "0")}-01`
        : `${filters.ano}-01-01`;
      const endDate = filters.mes
        ? new Date(filters.ano, filters.mes, 0).toISOString().split("T")[0]
        : `${filters.ano}-12-31`;

      const allData: any[] = [];
      let offset = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        let q = supabase
          .from("vendas_union")
          .select("id,data,pedido,nota,cliente,cod_cliente,descricao,marca,quantidade,venda,preco_venda,vl_desconto,vl_icm_subst,vl_outros_custos,tabela,vendedor,supervisor,empresa,id_empresa,uf,cidade,operacao")
          .gte("data", startDate)
          .lte("data", endDate)
          .order("data", { ascending: false })
          .range(offset, offset + batchSize - 1);

        if (empresaIds.length > 0) q = q.in("id_empresa", empresaIds);
        if (filters.supervisor) q = q.eq("supervisor", filters.supervisor);
        if (filters.codVend) q = q.eq("cod_vend", filters.codVend);
        if (filters.uf) q = q.eq("uf", filters.uf);
        if (filters.marca) q = q.eq("marca", filters.marca);

        const { data: batch, error } = await q;
        if (error) throw error;
        if (batch && batch.length > 0) {
          allData.push(...batch);
          offset += batchSize;
          hasMore = batch.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      return allData
        .filter(r => visiveis.has(r.operacao))
        .map(r => {
          const mult = multipliers.get(r.operacao) ?? 1;
          const receita = (r.venda ?? (r.preco_venda && r.quantidade ? r.preco_venda * r.quantidade : r.vl_outros_custos) ?? 0) * mult;
          return {
            id: r.id,
            data: r.data,
            pedido: r.pedido,
            nota: r.nota,
            cliente: r.cliente || "",
            cod_cliente: r.cod_cliente,
            descricao: r.descricao || "",
            marca: r.marca || "",
            quantidade: r.quantidade || 0,
            receita,
            vl_desconto: r.vl_desconto || 0,
            vl_icm_subst: r.vl_icm_subst || 0,
            tabela: r.tabela || "",
            vendedor: r.vendedor || "",
            supervisor: r.supervisor || "",
            empresa: r.empresa || "",
            id_empresa: r.id_empresa,
            uf: r.uf || "",
            cidade: r.cidade || "",
            operacao: r.operacao || "",
          };
        });
    },
    enabled: loaded,
    staleTime: 5 * 60 * 1000,
  });

  return {
    data: query.data || [],
    isLoading: query.isLoading,
    totalRows: query.data?.length || 0,
  };
}
