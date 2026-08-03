import { CheckCircle2, CircleDashed, Clock, Search, Send, XCircle, type LucideIcon } from "lucide-react";

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
  return docStatusVisual(status).badge;
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

/* ────────────────────────────────────────────────────────────────
 * Paleta visual única dos status de documento.
 * Fonte da verdade para badge, borda lateral, ponto e ícone em
 * TODOS os ambientes do checklist (tela de status, Modo Foco,
 * cartões, drawer da tarefa, ações em lote).
 * ──────────────────────────────────────────────────────────────── */

export type DocStatusTom =
  | "neutro"
  | "pendente"
  | "analise"
  | "enviado"
  | "aprovado"
  | "rejeitado";

export interface DocStatusVisual {
  /** Tom semântico do status. */
  tom: DocStatusTom;
  /** Classes do badge (fundo + texto + borda). */
  badge: string;
  /** Classe de borda lateral do cartão/linha. */
  border: string;
  /** Classe de fundo do ponto indicador. */
  dot: string;
  /** Classe de texto para ícones. */
  text: string;
  /** Nome do ícone lucide correspondente. */
  icone: "circle-dashed" | "clock" | "search" | "send" | "check" | "x";
}

const VISUAL_POR_TOM: Record<DocStatusTom, DocStatusVisual> = {
  neutro: {
    tom: "neutro",
    badge: "bg-doc-neutro/10 text-doc-neutro border-doc-neutro/30",
    border: "border-l-4 border-l-doc-neutro/40 border-dashed",
    dot: "bg-doc-neutro",
    text: "text-doc-neutro",
    icone: "circle-dashed",
  },
  pendente: {
    tom: "pendente",
    badge: "bg-doc-pendente/15 text-doc-pendente border-doc-pendente/35",
    border: "border-l-4 border-l-doc-pendente",
    dot: "bg-doc-pendente",
    text: "text-doc-pendente",
    icone: "clock",
  },
  analise: {
    tom: "analise",
    badge: "bg-doc-analise/15 text-doc-analise border-doc-analise/35",
    border: "border-l-4 border-l-doc-analise",
    dot: "bg-doc-analise",
    text: "text-doc-analise",
    icone: "search",
  },
  enviado: {
    tom: "enviado",
    badge: "bg-doc-enviado/15 text-doc-enviado border-doc-enviado/35",
    border: "border-l-4 border-l-doc-enviado",
    dot: "bg-doc-enviado",
    text: "text-doc-enviado",
    icone: "send",
  },
  aprovado: {
    tom: "aprovado",
    badge: "bg-doc-aprovado/15 text-doc-aprovado border-doc-aprovado/35",
    border: "border-l-4 border-l-doc-aprovado",
    dot: "bg-doc-aprovado",
    text: "text-doc-aprovado",
    icone: "check",
  },
  rejeitado: {
    tom: "rejeitado",
    badge: "bg-doc-rejeitado/15 text-doc-rejeitado border-doc-rejeitado/35",
    border: "border-l-4 border-l-doc-rejeitado",
    dot: "bg-doc-rejeitado",
    text: "text-doc-rejeitado",
    icone: "x",
  },
};

/** status bruto → tom visual. */
const TOM_POR_STATUS: Record<string, DocStatusTom> = {
  nao_criado: "neutro",
  rascunho: "neutro",
  planejado: "neutro",
  pendente: "pendente",
  contestado: "pendente",
  em_analise: "analise",
  em_revisao: "analise",
  enviado: "enviado",
  enviado_brasil: "enviado",
  enviado_parcial: "enviado",
  arte_enviada: "enviado",
  aprovado: "aprovado",
  ciencia: "aprovado",
  rejeitado: "rejeitado",
};

export function docStatusTom(status: string | null | undefined): DocStatusTom {
  return TOM_POR_STATUS[(status || "rascunho").toLowerCase()] ?? "neutro";
}

/** Visual completo (badge/borda/ponto/ícone) para qualquer status bruto. */
export function docStatusVisual(status: string | null | undefined): DocStatusVisual {
  return VISUAL_POR_TOM[docStatusTom(status)];
}

export { VISUAL_POR_TOM as DOC_STATUS_VISUAL };


/** Componente lucide correspondente ao status (cor não é o único sinal). */
export function docStatusIconComponent(status: string | null | undefined): LucideIcon {
  const map: Record<DocStatusVisual["icone"], LucideIcon> = {
    "circle-dashed": CircleDashed,
    clock: Clock,
    search: Search,
    send: Send,
    check: CheckCircle2,
    x: XCircle,
  };
  return map[docStatusVisual(status).icone];
}
