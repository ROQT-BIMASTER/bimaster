import { useQuery } from "@tanstack/react-query";
import { fetchAllRows } from "@/lib/utils/fetchAllRows";

export interface PortfolioKPIs {
  totalClientes: number;
  clientesComCompra: number;
  clientesSemCompra: number;
  taxaConversao: number; // % cadastrados que compraram
  ticketMedio: number;
  ticketMaiorMedio: number;
  totalReceitaUltima: number;
  limiteTotal: number;
  limiteUtilizacaoPct: number;
  ativos: number; // 0-90 dias
  emRisco: number; // 91-365 dias
  inativos: number; // 365+ dias
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

const FAIXAS_TICKET = [
  { faixa: "Micro (< R$ 100)", min: 0, max: 100 },
  { faixa: "Pequeno (R$ 100-500)", min: 100, max: 500 },
  { faixa: "Médio (R$ 500-2k)", min: 500, max: 2000 },
  { faixa: "Alto (R$ 2k-5k)", min: 2000, max: 5000 },
  { faixa: "Premium (R$ 5k-20k)", min: 5000, max: 20000 },
  { faixa: "Enterprise (> R$ 20k)", min: 20000, max: Infinity },
];

export function useClienteAnalytics() {
  return useQuery({
    queryKey: ["clientes-analytics"],
    queryFn: async () => {
      const data = await fetchAllRows<any>(
        "clientes",
        "id, nome, uf, cidade, valor_ultima_compra, valor_maior_compra, limite_credito, data_ultima_compra, data_cadastro"
      );

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      // Portfolio KPIs
      const comCompra = (data || []).filter((c) => c.valor_ultima_compra && c.valor_ultima_compra > 0);
      const semCompra = (data || []).filter((c) => !c.valor_ultima_compra || c.valor_ultima_compra <= 0);
      const totalReceitaUltima = comCompra.reduce((s, c) => s + (c.valor_ultima_compra || 0), 0);
      const totalReceitaMaior = comCompra.reduce((s, c) => s + (c.valor_maior_compra || 0), 0);
      const limiteTotal = (data || []).reduce((s, c) => s + (c.limite_credito || 0), 0);

      let ativos = 0, emRisco = 0, inativos = 0;
      for (const c of comCompra) {
        if (!c.data_ultima_compra) continue;
        const d = new Date(c.data_ultima_compra);
        d.setHours(0, 0, 0, 0);
        const dias = Math.floor((hoje.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
        if (dias <= 90) ativos++;
        else if (dias <= 365) emRisco++;
        else inativos++;
      }

      const portfolioKPIs: PortfolioKPIs = {
        totalClientes: (data || []).length,
        clientesComCompra: comCompra.length,
        clientesSemCompra: semCompra.length,
        taxaConversao: (data || []).length > 0 ? (comCompra.length / (data || []).length) * 100 : 0,
        ticketMedio: comCompra.length > 0 ? totalReceitaUltima / comCompra.length : 0,
        ticketMaiorMedio: comCompra.length > 0 ? totalReceitaMaior / comCompra.length : 0,
        totalReceitaUltima,
        limiteTotal,
        limiteUtilizacaoPct: limiteTotal > 0 ? (totalReceitaUltima / limiteTotal) * 100 : 0,
        ativos,
        emRisco,
        inativos,
      };

      // Concentração por UF
      const ufMap: Record<string, { total: number; comCompra: number; receitaUltima: number; receitaMaior: number; limite: number }> = {};
      for (const c of data || []) {
        const uf = c.uf || "N/D";
        if (!ufMap[uf]) ufMap[uf] = { total: 0, comCompra: 0, receitaUltima: 0, receitaMaior: 0, limite: 0 };
        ufMap[uf].total++;
        if (c.valor_ultima_compra && c.valor_ultima_compra > 0) {
          ufMap[uf].comCompra++;
          ufMap[uf].receitaUltima += c.valor_ultima_compra;
          ufMap[uf].receitaMaior += c.valor_maior_compra || 0;
        }
        ufMap[uf].limite += c.limite_credito || 0;
      }

      const concentracaoUF: ConcentracaoUF[] = Object.entries(ufMap)
        .map(([uf, v]) => ({
          uf,
          totalClientes: v.total,
          clientesComCompra: v.comCompra,
          receitaUltima: v.receitaUltima,
          receitaMaior: v.receitaMaior,
          limiteCredito: v.limite,
          ticketMedio: v.comCompra > 0 ? v.receitaUltima / v.comCompra : 0,
          pctReceita: totalReceitaUltima > 0 ? (v.receitaUltima / totalReceitaUltima) * 100 : 0,
          pctClientes: (data || []).length > 0 ? (v.total / (data || []).length) * 100 : 0,
        }))
        .sort((a, b) => b.receitaUltima - a.receitaUltima);

      // Faixas de Ticket (valor_ultima_compra)
      const faixasTicket: FaixaTicket[] = FAIXAS_TICKET.map((f) => {
        const nessa = comCompra.filter((c) => {
          const v = c.valor_ultima_compra || 0;
          return v >= f.min && v < f.max;
        });
        return {
          faixa: f.faixa,
          min: f.min,
          max: f.max,
          quantidade: nessa.length,
          valorTotal: nessa.reduce((s, c) => s + (c.valor_ultima_compra || 0), 0),
          pctClientes: comCompra.length > 0 ? (nessa.length / comCompra.length) * 100 : 0,
        };
      });

      // Potencial não explorado por UF
      const potencialUF: PotencialNaoExplorado[] = Object.entries(ufMap)
        .map(([uf, v]) => ({
          uf,
          cadastrados: v.total,
          semCompra: v.total - v.comCompra,
          taxaInatividade: v.total > 0 ? ((v.total - v.comCompra) / v.total) * 100 : 0,
          limiteDisponivel: v.limite - v.receitaUltima,
        }))
        .filter((p) => p.semCompra > 0)
        .sort((a, b) => b.semCompra - a.semCompra);

      return { portfolioKPIs, concentracaoUF, faixasTicket, potencialUF };
    },
    staleTime: 5 * 60 * 1000,
  });
}
