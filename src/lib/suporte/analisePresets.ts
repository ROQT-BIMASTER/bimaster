import type { AnaliseChartTipo } from "@/components/suporte/SuporteAnaliseChart";
import type { SuporteMetrica, SuporteDimensao } from "@/lib/suporte/analyticsFormat";

export interface SuportePreset {
  id: string;
  titulo: string;
  grupo: string;
  metrica: SuporteMetrica;
  dimensao: SuporteDimensao;
  tipo: AnaliseChartTipo;
  descricao?: string;
}

export const PRESETS_SUPORTE: SuportePreset[] = [
  // SLA (5)
  { id: "sla-fila-bar", titulo: "% SLA resolução por departamento", grupo: "SLA", metrica: "pct_sla_resolucao", dimensao: "fila", tipo: "bar" },
  { id: "sla1-fila-bar", titulo: "% SLA 1ª resposta por departamento", grupo: "SLA", metrica: "pct_sla_primeira", dimensao: "fila", tipo: "bar" },
  { id: "sla-prio-bar", titulo: "% SLA por prioridade", grupo: "SLA", metrica: "pct_sla_resolucao", dimensao: "prioridade", tipo: "bar" },
  { id: "sla-mix-pie", titulo: "Situação de SLA — mix atual", grupo: "SLA", metrica: "chamados", dimensao: "sla", tipo: "pie" },
  { id: "sla-mes-line", titulo: "% SLA resolução por mês", grupo: "SLA", metrica: "pct_sla_resolucao", dimensao: "mes", tipo: "line" },

  // Volume (7)
  { id: "vol-dia-area", titulo: "Chamados por dia", grupo: "Volume", metrica: "chamados", dimensao: "dia", tipo: "area" },
  { id: "vol-mes-bar", titulo: "Chamados por mês", grupo: "Volume", metrica: "chamados", dimensao: "mes", tipo: "bar" },
  { id: "vol-fila-bar", titulo: "Chamados por departamento", grupo: "Volume", metrica: "chamados", dimensao: "fila", tipo: "bar" },
  { id: "vol-cat-bar", titulo: "Chamados por categoria", grupo: "Volume", metrica: "chamados", dimensao: "categoria", tipo: "bar" },
  { id: "vol-canal-pie", titulo: "Chamados por canal", grupo: "Volume", metrica: "chamados", dimensao: "canal", tipo: "pie" },
  { id: "vol-status-pie", titulo: "Chamados por status", grupo: "Volume", metrica: "chamados", dimensao: "status", tipo: "pie" },
  { id: "vol-tag-bar", titulo: "Chamados por tag", grupo: "Volume", metrica: "chamados", dimensao: "tag", tipo: "bar" },

  // Tempos (5)
  { id: "frt-fila-bar", titulo: "1ª resposta média por departamento", grupo: "Tempos", metrica: "frt_horas", dimensao: "fila", tipo: "bar" },
  { id: "frt-prio-bar", titulo: "1ª resposta média por prioridade", grupo: "Tempos", metrica: "frt_horas", dimensao: "prioridade", tipo: "bar" },
  { id: "res-fila-bar", titulo: "Resolução média por departamento", grupo: "Tempos", metrica: "resolucao_horas", dimensao: "fila", tipo: "bar" },
  { id: "res-cat-bar", titulo: "Resolução média por categoria", grupo: "Tempos", metrica: "resolucao_horas", dimensao: "categoria", tipo: "bar" },
  { id: "res-mes-line", titulo: "Resolução média por mês", grupo: "Tempos", metrica: "resolucao_horas", dimensao: "mes", tipo: "line" },

  // Qualidade (4)
  { id: "csat-fila-bar", titulo: "CSAT por departamento", grupo: "Qualidade", metrica: "csat", dimensao: "fila", tipo: "bar" },
  { id: "csat-agente-bar", titulo: "CSAT por agente", grupo: "Qualidade", metrica: "csat", dimensao: "agente", tipo: "bar", descricao: "CSAT é média por resposta (coerente com nº de respostas)." },
  { id: "reab-fila-bar", titulo: "Reabertos por departamento", grupo: "Qualidade", metrica: "reabertos", dimensao: "fila", tipo: "bar" },
  { id: "reab-mes-line", titulo: "Reabertos por mês", grupo: "Qualidade", metrica: "reabertos", dimensao: "mes", tipo: "line" },

  // Fluxo & time (3)
  { id: "transf-fila-bar", titulo: "Transferências por departamento", grupo: "Fluxo & time", metrica: "transferencias", dimensao: "fila", tipo: "bar", descricao: "Conta transferências sofridas por tickets hoje na fila (fluxo origem→destino fica no Sankey da Visão Executiva)." },
  { id: "cham-agente-bar", titulo: "Chamados por agente", grupo: "Fluxo & time", metrica: "chamados", dimensao: "agente", tipo: "bar", descricao: "Ex-funcionários (perfil inativo) aparecem como “(sem responsável)”." },
  { id: "res-agente-bar", titulo: "Resolvidos por agente", grupo: "Fluxo & time", metrica: "resolvidos", dimensao: "agente", tipo: "bar" },
];
