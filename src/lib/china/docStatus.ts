/**
 * Estados administrativos de documentos vindos da submissão China.
 * Fonte da verdade: `china_produto_documentos.status`.
 */
export type DocDecisao = "pendente" | "em_analise" | "aprovado" | "rejeitado";

export const DOC_STATUS_LABEL: Record<string, string> = {
  rascunho: "Pendente",
  pendente: "Pendente de aprovação",
  enviado: "Pendente de aprovação",
  enviado_brasil: "Pendente de aprovação",
  enviado_parcial: "Pendente de aprovação",
  em_analise: "Em análise",
  em_revisao: "Em análise",
  aprovado: "Aprovado",
  rejeitado: "Não aprovado",
  contestado: "Não aprovado",
};

export const DOC_STATUS_TONE: Record<string, string> = {
  aprovado: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200",
  rejeitado: "bg-rose-100 text-rose-900 dark:bg-rose-900/30 dark:text-rose-200",
  contestado: "bg-rose-100 text-rose-900 dark:bg-rose-900/30 dark:text-rose-200",
  em_analise: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
  em_revisao: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
};

/** Normaliza qualquer status bruto para uma das quatro decisões administrativas. */
export function normalizarDecisao(status: string | null | undefined): DocDecisao {
  const s = (status || "").toLowerCase();
  if (s === "aprovado") return "aprovado";
  if (s === "rejeitado" || s === "contestado") return "rejeitado";
  if (s === "em_analise" || s === "em_revisao") return "em_analise";
  if (s === "rascunho" || s === "") return "pendente";
  return "pendente";
}

export function docStatusLabel(status: string | null | undefined): string {
  const s = (status || "rascunho").toLowerCase();
  return DOC_STATUS_LABEL[s] || s;
}

export function docStatusTone(status: string | null | undefined): string {
  const s = (status || "rascunho").toLowerCase();
  return DOC_STATUS_TONE[s] || "bg-muted text-muted-foreground";
}

/** Prioridade para consolidar o status de várias peças numa tarefa. */
const PESO: Record<DocDecisao, number> = {
  rejeitado: 4,
  em_analise: 3,
  pendente: 2,
  aprovado: 1,
};

export function consolidarDecisoes(statuses: Array<string | null | undefined>): DocDecisao | null {
  if (statuses.length === 0) return null;
  const decisoes = statuses.map(normalizarDecisao);
  if (decisoes.every((d) => d === "aprovado")) return "aprovado";
  return decisoes.reduce((acc, d) => (PESO[d] > PESO[acc] ? d : acc), "aprovado" as DocDecisao);
}

export const DECISAO_LABEL: Record<DocDecisao, string> = {
  pendente: "Pendente de aprovação",
  em_analise: "Em análise",
  aprovado: "Aprovado",
  rejeitado: "Não aprovado",
};
