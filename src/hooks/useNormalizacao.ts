import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface NormalizacaoStats {
  total_processados: number;
  normalizados: number;
  sem_match: number;
  pct_sucesso: number;
  cidades_sem_match: Array<{
    uf: string;
    cidade: string;
    quantidade: number;
  }>;
}

export interface NormalizacaoResumo {
  totalClientes: number;
  comCnpjCompleto: number;
  semCnpjCompleto: number;
  normalizados: number;
  semMatch: number;
  cidadesSemMatch: Array<{
    uf: string;
    cidade: string;
    quantidade: number;
  }>;
}

export function useNormalizacao() {
  const queryClient = useQueryClient();

  const resumoQuery = useQuery({
    queryKey: ["normalizacao-resumo"],
    queryFn: async () => {
      // Run parallel queries for stats
      const [totalRes, cnpjRes, normRes, semMatchRes] = await Promise.all([
        supabase.from("clientes").select("id", { count: "exact", head: true }),
        supabase
          .from("clientes")
          .select("id", { count: "exact", head: true })
          .not("cnpj", "is", null)
          .gte("cnpj", "00000000000000"),
        supabase
          .from("clientes")
          .select("id", { count: "exact", head: true })
          .not("ibge_municipio_id", "is", null),
        supabase
          .from("clientes")
          .select("uf, cidade", { count: "exact" })
          .not("cnpj", "is", null)
          .gte("cnpj", "00000000000000")
          .is("ibge_municipio_id", null)
          .not("cidade", "is", null)
          .not("uf", "is", null)
          .limit(1),
      ]);

      const totalClientes = totalRes.count || 0;
      const comCnpjCompleto = cnpjRes.count || 0;
      const normalizados = normRes.count || 0;
      const semMatchCount = semMatchRes.count || 0;

      // Get unmatched cities grouped by UF via RPC or direct query
      const { data: cidadesRaw } = await supabase
        .rpc("fn_get_cidades_sem_match" as any);

      return {
        totalClientes,
        comCnpjCompleto,
        semCnpjCompleto: totalClientes - comCnpjCompleto,
        normalizados,
        semMatch: semMatchCount,
        cidadesSemMatch: (cidadesRaw as any[]) || [],
      } as NormalizacaoResumo;
    },
    staleTime: 5 * 60 * 1000,
  });

  const executarNormalizacao = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc(
        "fn_normalizar_municipios_clientes" as any
      );
      if (error) throw error;
      return data as unknown as NormalizacaoStats;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["normalizacao-resumo"] });
      queryClient.invalidateQueries({ queryKey: ["market-coverage-snapshot"] });
      queryClient.invalidateQueries({ queryKey: ["clientes-analytics"] });
      queryClient.invalidateQueries({ queryKey: ["clientes-reativacao"] });
      toast.success(
        `Normalização concluída: ${data.normalizados} de ${data.total_processados} clientes normalizados (${data.pct_sucesso}%)`
      );
    },
    onError: (err: Error) => {
      toast.error("Erro na normalização: " + err.message);
    },
  });

  const recalcularCobertura = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("fn_calcular_cobertura_mercado");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["market-coverage-snapshot"] });
      toast.success("Cobertura de mercado recalculada!");
    },
    onError: (err: Error) => {
      toast.error("Erro ao recalcular: " + err.message);
    },
  });

  return {
    resumo: resumoQuery.data,
    isLoading: resumoQuery.isLoading,
    executarNormalizacao: executarNormalizacao.mutate,
    isNormalizando: executarNormalizacao.isPending,
    resultadoNormalizacao: executarNormalizacao.data,
    recalcularCobertura: recalcularCobertura.mutate,
    isRecalculando: recalcularCobertura.isPending,
  };
}
