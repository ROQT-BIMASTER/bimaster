import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type RiskLevel = "atencao" | "alerta" | "critico" | "inativo";

export interface ClienteReativacao {
  id: string;
  nome: string;
  codigo: string;
  cidade: string | null;
  uf: string | null;
  empresa_id: number | null;
  data_ultima_compra: string | null;
  valor_ultima_compra: number | null;
  limite_credito: number | null;
  dias_sem_compra: number;
  nivel_risco: RiskLevel;
  // Contact fields
  telefone: string | null;
  celular: string | null;
  email: string | null;
  cnpj: string | null;
  comprador: string | null;
  // Address fields
  endereco: string | null;
  bairro: string | null;
  cep: string | null;
  endereco_cobranca: string | null;
  bairro_cobranca: string | null;
  cidade_cobranca: string | null;
  uf_cobranca: string | null;
  cep_cobranca: string | null;
  // Commercial fields
  valor_maior_compra: number | null;
  data_maior_compra: string | null;
  status_bloqueio: string | null;
  conceito: string | null;
  observacoes: string | null;
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

export interface Empresa {
  id: number;
  nome: string;
}

export function useClienteReativacao(empresaId?: number | null) {
  const empresasQuery = useQuery({
    queryKey: ["empresas-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("id, nome")
        .order("nome");
      if (error) throw error;
      return (data || []) as Empresa[];
    },
    staleTime: 10 * 60 * 1000,
  });

  const clientesQuery = useQuery({
    queryKey: ["clientes-reativacao", empresaId ?? "todas"],
    queryFn: async () => {
      let query = supabase
        .from("clientes")
        .select("id, nome, codigo, cidade, uf, empresa_id, data_ultima_compra, valor_ultima_compra, limite_credito, telefone, celular, email, cnpj, comprador, endereco, bairro, cep, endereco_cobranca, bairro_cobranca, cidade_cobranca, uf_cobranca, cep_cobranca, valor_maior_compra, data_maior_compra, status_bloqueio, conceito, observacoes")
        .gt("valor_ultima_compra", 0)
        .not("data_ultima_compra", "is", null);

      if (empresaId) {
        query = query.eq("empresa_id", empresaId);
      }

      const { data, error } = await query;
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

        if (!nivel) continue;

        const cliente: ClienteReativacao = {
          id: c.id,
          nome: c.nome,
          codigo: c.codigo,
          cidade: c.cidade,
          uf: c.uf,
          empresa_id: c.empresa_id,
          data_ultima_compra: c.data_ultima_compra,
          valor_ultima_compra: c.valor_ultima_compra,
          limite_credito: c.limite_credito,
          dias_sem_compra: dias,
          nivel_risco: nivel,
          telefone: c.telefone,
          celular: c.celular,
          email: c.email,
          cnpj: c.cnpj,
          comprador: c.comprador,
          endereco: c.endereco,
          bairro: c.bairro,
          cep: c.cep,
          endereco_cobranca: c.endereco_cobranca,
          bairro_cobranca: c.bairro_cobranca,
          cidade_cobranca: c.cidade_cobranca,
          uf_cobranca: c.uf_cobranca,
          cep_cobranca: c.cep_cobranca,
          valor_maior_compra: c.valor_maior_compra,
          data_maior_compra: c.data_maior_compra,
          status_bloqueio: c.status_bloqueio,
          conceito: c.conceito,
          observacoes: c.observacoes,
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

  return {
    ...clientesQuery,
    empresas: empresasQuery.data || [],
    isLoadingEmpresas: empresasQuery.isLoading,
  };
}
