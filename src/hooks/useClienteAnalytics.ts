import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PortfolioKPIs {
  totalClientes: number;
  clientesComCompra: number;
  clientesSemCompra: number;
  taxaConversao: number;
  ticketMedio: number;
  ticketMaiorMedio: number;
  totalReceitaUltima: number;
  limiteTotal: number;
  limiteUtilizacaoPct: number;
  ativos: number;
  emRisco: number;
  inativos: number;
}

export interface ConcentracaoUF {
  uf: string;
  totalClientes: number;
  clientesComCompra: number;
  receitaUltima: number;
  receitaMaior: number;
  limiteCredito: number;
  ticketMedio: number;
  pctReceita: number;
  pctClientes: number;
}

export interface FaixaTicket {
  faixa: string;
  min: number;
  max: number;
  quantidade: number;
  valorTotal: number;
  pctClientes: number;
}

export interface PotencialNaoExplorado {
  uf: string;
  cadastrados: number;
  semCompra: number;
  taxaInatividade: number;
  limiteDisponivel: number;
}

export function useClienteAnalytics() {
  return useQuery({
    queryKey: ["clientes-analytics"],
    queryFn: async () => {
      // Execute all RPCs in parallel instead of fetching 35k+ rows
      const [kpisRes, ufRes, faixasRes, potencialRes] = await Promise.all([
        supabase.rpc("get_portfolio_kpis" as any),
        supabase.rpc("get_concentracao_uf" as any),
        supabase.rpc("get_faixas_ticket" as any),
        supabase.rpc("get_potencial_uf" as any),
      ]);

      if (kpisRes.error) throw kpisRes.error;
      if (ufRes.error) throw ufRes.error;
      if (faixasRes.error) throw faixasRes.error;
      if (potencialRes.error) throw potencialRes.error;

      const portfolioKPIs: PortfolioKPIs = kpisRes.data as any;
      const concentracaoUF: ConcentracaoUF[] = ufRes.data as any;
      const faixasTicket: FaixaTicket[] = faixasRes.data as any;
      const potencialUF: PotencialNaoExplorado[] = potencialRes.data as any;

      return { portfolioKPIs, concentracaoUF, faixasTicket, potencialUF };
    },
    staleTime: 5 * 60 * 1000,
  });
}
