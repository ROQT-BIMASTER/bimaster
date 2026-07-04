// Formatters e labels do Suporte Analytics.
// Espelha o padrão do rubyCorp de Vendas, mas com métricas do Suporte.

export type SuporteMetrica =
  | "chamados"
  | "resolvidos"
  | "reabertos"
  | "frt_horas"
  | "resolucao_horas"
  | "pct_sla_resolucao"
  | "pct_sla_primeira"
  | "csat"
  | "transferencias";

export type SuporteDimensao =
  | "total"
  | "fila"
  | "categoria"
  | "prioridade"
  | "status"
  | "canal"
  | "sla"
  | "agente"
  | "solicitante"
  | "tag"
  | "dia"
  | "semana"
  | "mes";

const fmtInt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const fmt1 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const fmt2 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2, minimumFractionDigits: 2 });

export function formatValor(v: number | null | undefined, metrica: SuporteMetrica): string {
  if (v === null || v === undefined || !isFinite(v as number)) return "—";
  const n = Number(v);
  switch (metrica) {
    case "chamados":
    case "resolvidos":
    case "reabertos":
    case "transferencias":
      return fmtInt.format(Math.round(n));
    case "frt_horas":
    case "resolucao_horas":
      return `${fmt1.format(n)} h`;
    case "pct_sla_resolucao":
    case "pct_sla_primeira":
      return `${fmt1.format(n)}%`;
    case "csat":
      return `${fmt2.format(n)} ★`;
    default:
      return String(n);
  }
}

/** Formatter simples para eixo Y do gráfico (sem sufixos longos). */
export function axisFormatter(metrica: SuporteMetrica) {
  return (v: number) => {
    if (!isFinite(v)) return "";
    switch (metrica) {
      case "chamados":
      case "resolvidos":
      case "reabertos":
      case "transferencias":
        return fmtInt.format(Math.round(v));
      case "pct_sla_resolucao":
      case "pct_sla_primeira":
        return `${Math.round(v)}%`;
      case "csat":
        return v.toFixed(1);
      default:
        return v.toFixed(1);
    }
  };
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Label temporal exibido no eixo: dia → DD/MM, mes → MMM/AA, semana como vem. */
export function formatLabelTemporal(label: string, dim: SuporteDimensao): string {
  if (dim === "dia") {
    // YYYY-MM-DD → DD/MM
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(label);
    if (m) return `${m[3]}/${m[2]}`;
  }
  if (dim === "mes") {
    // YYYY-MM → MMM/AA
    const m = /^(\d{4})-(\d{2})$/.exec(label);
    if (m) {
      const idx = parseInt(m[2], 10) - 1;
      return `${MESES[idx] ?? m[2]}/${m[1].slice(2)}`;
    }
  }
  return label;
}

export const METRICAS_SUPORTE: { value: SuporteMetrica; label: string }[] = [
  { value: "chamados", label: "Chamados" },
  { value: "resolvidos", label: "Resolvidos" },
  { value: "reabertos", label: "Reabertos" },
  { value: "frt_horas", label: "1ª resposta (h úteis)" },
  { value: "resolucao_horas", label: "Resolução (h úteis)" },
  { value: "pct_sla_resolucao", label: "% SLA resolução" },
  { value: "pct_sla_primeira", label: "% SLA 1ª resposta" },
  { value: "csat", label: "CSAT" },
  { value: "transferencias", label: "Transferências" },
];

export const DIMENSOES_SUPORTE: { value: SuporteDimensao; label: string }[] = [
  { value: "fila", label: "Departamento" },
  { value: "categoria", label: "Categoria" },
  { value: "prioridade", label: "Prioridade" },
  { value: "status", label: "Status" },
  { value: "canal", label: "Canal" },
  { value: "sla", label: "Situação de SLA" },
  { value: "agente", label: "Agente" },
  { value: "solicitante", label: "Solicitante" },
  { value: "tag", label: "Tag" },
  { value: "dia", label: "Dia" },
  { value: "semana", label: "Semana" },
  { value: "mes", label: "Mês" },
];

export const DIMENSOES_TEMPORAIS: SuporteDimensao[] = ["dia", "semana", "mes"];
