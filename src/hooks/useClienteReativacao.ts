import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type RiskLevel = "atencao" | "alerta" | "critico" | "inativo";

export interface ClienteReativacao {
  id: string;
  nome: string;
  codigo: string;
  cidade: string | null;
  uf: string | null;
  data_ultima_compra: string | null;
  valor_ultima_compra: number | null;
  limite_credito: number | null;
  dias_sem_compra: number;
  nivel_risco: RiskLevel;
}

export interface ReativacaoKPI {
  nivel: RiskLevel;
  label: string;
  quantidade: number;
  valor_total: number;
}

export interface RiscoPorUF {
  uf: string;
  quantidade: number;
  valor_total: number;
}

function classificarRisco(dias: number): RiskLevel | null {
  if (dias <= 30) return null; // Ativo
  if (dias <= 60) return "atencao";
  if (dias <= 90) return "alerta";
  if (dias <= 180) return "critico";
  return "inativo";
}

const RISK_LABELS: Record<RiskLevel, string> = {
  atencao: "Atenção",
  alerta: "Alerta",
  critico: "Crítico",
  inativo: "Inativo",
};

export function useClienteReativacao() {
  return useQuery({
    queryKey: ["clientes-reativacao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome, codigo, cidade, uf, data_ultima_compra, valor_ultima_compra, limite_credito")
        .gt("valor_ultima_compra", 0)
        .not("data_ultima_compra", "is", null);

      if (error) throw error;

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      const clientes: ClienteReativacao[] = [];
      const kpiMap: Record<RiskLevel, { quantidade: number; valor_total: number }> = {
        atencao: { quantidade: 0, valor_total: 0 },
        alerta: { quantidade: 0, valor_total: 0 },
        critico: { quantidade: 0, valor_total: 0 },
        inativo: { quantidade: 0, valor_total: 0 },
      };
      const ufMap: Record<string, { quantidade: number; valor_total: number }> = {};

      for (const c of data || []) {
        const dataUltima = new Date(c.data_ultima_compra!);
        dataUltima.setHours(0, 0, 0, 0);
        const dias = Math.floor((hoje.getTime() - dataUltima.getTime()) / (1000 * 60 * 60 * 24));
        const nivel = classificarRisco(dias);

        if (!nivel) continue; // Ativo, sem necessidade de ação

        const cliente: ClienteReativacao = {
          id: c.id,
          nome: c.nome,
          codigo: c.codigo,
          cidade: c.cidade,
          uf: c.uf,
          data_ultima_compra: c.data_ultima_compra,
          valor_ultima_compra: c.valor_ultima_compra,
          limite_credito: c.limite_credito,
          dias_sem_compra: dias,
          nivel_risco: nivel,
        };

        clientes.push(cliente);
        kpiMap[nivel].quantidade++;
        kpiMap[nivel].valor_total += c.valor_ultima_compra || 0;

        const uf = c.uf || "N/D";
        if (!ufMap[uf]) ufMap[uf] = { quantidade: 0, valor_total: 0 };
        ufMap[uf].quantidade++;
        ufMap[uf].valor_total += c.valor_ultima_compra || 0;
      }

      const kpis: ReativacaoKPI[] = (["atencao", "alerta", "critico", "inativo"] as RiskLevel[]).map(
        (nivel) => ({
          nivel,
          label: RISK_LABELS[nivel],
          quantidade: kpiMap[nivel].quantidade,
          valor_total: kpiMap[nivel].valor_total,
        })
      );

      const riscoPorUF: RiscoPorUF[] = Object.entries(ufMap)
        .map(([uf, v]) => ({ uf, ...v }))
        .sort((a, b) => b.valor_total - a.valor_total);

      // Ordenar por valor decrescente dentro de cada faixa
      clientes.sort((a, b) => {
        const ordemRisco: Record<RiskLevel, number> = { critico: 0, alerta: 1, atencao: 2, inativo: 3 };
        const diff = ordemRisco[a.nivel_risco] - ordemRisco[b.nivel_risco];
        if (diff !== 0) return diff;
        return (b.valor_ultima_compra || 0) - (a.valor_ultima_compra || 0);
      });

      return { clientes, kpis, riscoPorUF };
    },
    staleTime: 5 * 60 * 1000,
  });
}
