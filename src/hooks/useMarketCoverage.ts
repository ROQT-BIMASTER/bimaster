import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface MarketCoverageRow {
  id: string;
  uf: string;
  regiao_nome: string | null;
  total_municipios: number;
  municipios_com_clientes: number;
  municipios_com_prospects: number;
  municipios_com_leads: number;
  total_clientes_erp: number;
  total_prospects: number;
  total_leads_minerados: number;
  penetracao_percentual: number;
  cobertura_percentual: number;
  pipeline_percentual: number;
  populacao_total: number;
  pib_total_mil_reais: number;
  vendedores_atribuidos: string[] | null;
  updated_at: string;
}

export interface MarketKPIs {
  totalMunicipios: number;
  municipiosAtendidos: number;
  penetracaoNacional: number;
  totalClientesERP: number;
  totalProspects: number;
  totalLeads: number;
  municipiosProspectados: number;
  municipiosMinerados: number;
  populacaoAtendida: number;
  populacaoTotal: number;
  ufsAtendidas: number;
  totalUFs: number;
}

export function useMarketCoverage() {
  const queryClient = useQueryClient();

  const { data: coverageData, isLoading, error } = useQuery({
    queryKey: ["market-coverage-snapshot"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("market_coverage_snapshot")
        .select("*")
        .order("penetracao_percentual", { ascending: false });

      if (error) throw error;
      return data as MarketCoverageRow[];
    },
  });

  const kpis: MarketKPIs = coverageData
    ? {
        totalMunicipios: coverageData.reduce((s, r) => s + r.total_municipios, 0),
        municipiosAtendidos: coverageData.reduce((s, r) => s + r.municipios_com_clientes, 0),
        penetracaoNacional:
          coverageData.reduce((s, r) => s + r.total_municipios, 0) > 0
            ? Number(
                (
                  (coverageData.reduce((s, r) => s + r.municipios_com_clientes, 0) /
                    coverageData.reduce((s, r) => s + r.total_municipios, 0)) *
                  100
                ).toFixed(2)
              )
            : 0,
        totalClientesERP: coverageData.reduce((s, r) => s + r.total_clientes_erp, 0),
        totalProspects: coverageData.reduce((s, r) => s + r.total_prospects, 0),
        totalLeads: coverageData.reduce((s, r) => s + r.total_leads_minerados, 0),
        municipiosProspectados: coverageData.reduce((s, r) => s + r.municipios_com_prospects, 0),
        municipiosMinerados: coverageData.reduce((s, r) => s + r.municipios_com_leads, 0),
        populacaoAtendida: coverageData
          .filter((r) => r.municipios_com_clientes > 0)
          .reduce((s, r) => s + r.populacao_total, 0),
        populacaoTotal: coverageData.reduce((s, r) => s + r.populacao_total, 0),
        ufsAtendidas: coverageData.filter((r) => r.municipios_com_clientes > 0).length,
        totalUFs: coverageData.length,
      }
    : {
        totalMunicipios: 0,
        municipiosAtendidos: 0,
        penetracaoNacional: 0,
        totalClientesERP: 0,
        totalProspects: 0,
        totalLeads: 0,
        municipiosProspectados: 0,
        municipiosMinerados: 0,
        populacaoAtendida: 0,
        populacaoTotal: 0,
        ufsAtendidas: 0,
        totalUFs: 0,
      };

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("fn_calcular_cobertura_mercado");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["market-coverage-snapshot"] });
      toast.success("Dados de cobertura atualizados com sucesso!");
    },
    onError: (err: Error) => {
      toast.error("Erro ao atualizar dados: " + err.message);
    },
  });

  return {
    coverageData: coverageData || [],
    kpis,
    isLoading,
    error,
    refresh: refreshMutation.mutate,
    isRefreshing: refreshMutation.isPending,
  };
}
