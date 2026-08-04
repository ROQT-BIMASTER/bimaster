import { CheckCircle2, CircleDashed, Clock, Search, Send, XCircle, type LucideIcon } from "lucide-react";

/**
 * Estados administrativos de documentos vindos da submissão China.
 * Fonte da verdade: `china_produto_documentos.status`.
 */
export type DocDecisao = "pendente" | "em_analise" | "aprovado" | "rejeitado";

/** Rótulo bilíngue (português + chinês) de um status. */
export interface DocStatusTexto {
  pt: string;
  zh: string;
}

export type DocStatusIdioma = "bi" | "pt" | "zh";

/** Formata um par PT/中文 conforme o idioma pedido (padrão: bilíngue). */
export function formatarLabelBilingue(
  texto: DocStatusTexto,
  idioma: DocStatusIdioma = "bi",
): string {
  if (idioma === "pt") return texto.pt;
  if (idioma === "zh") return texto.zh;
  return `${texto.pt} ${texto.zh}`;
}

/** Rótulos administrativos (decisão) — usados em tarefas, drawer e ações em lote. */
export const DOC_STATUS_LABEL: Record<string, DocStatusTexto> = {
  rascunho: { pt: "Pendente", zh: "待处理" },
  pendente: { pt: "Pendente de aprovação", zh: "待审批" },
  enviado: { pt: "Pendente de aprovação", zh: "待审批" },
  enviado_brasil: { pt: "Pendente de aprovação", zh: "待审批" },
  enviado_parcial: { pt: "Pendente de aprovação", zh: "待审批" },
  em_analise: { pt: "Em análise", zh: "审核中" },
  em_revisao: { pt: "Em análise", zh: "审核中" },
  aprovado: { pt: "Aprovado", zh: "已批准" },
  rejeitado: { pt: "Não aprovado", zh: "未批准" },
  contestado: { pt: "Não aprovado", zh: "未批准" },
};

/**
 * Rótulos operacionais do checklist China (tela de Status, Modo Foco,
 * painel do item e seletor de status). Fonte única bilíngue.
 */
export const CHECKLIST_STATUS_LABEL: Record<string, DocStatusTexto> = {
  nao_criado: { pt: "Não criado", zh: "未创建" },
  rascunho: { pt: "Rascunho", zh: "草稿" },
  planejado: { pt: "Planejado", zh: "已计划" },
  pendente: { pt: "Pendente análise", zh: "待审核" },
  em_analise: { pt: "Em análise", zh: "审核中" },
  em_revisao: { pt: "Em análise", zh: "审核中" },
  enviado: { pt: "Enviado", zh: "已发送" },
  enviado_brasil: { pt: "Enviado ao Brasil", zh: "已发送至巴西" },
  enviado_parcial: { pt: "Enviado (parcial)", zh: "已发送（部分）" },
  arte_enviada: { pt: "Docs enviados", zh: "文件已发送" },
  aprovado: { pt: "Aprovado", zh: "已批准" },
  ciencia: { pt: "Ciente", zh: "已确认" },
  rejeitado: { pt: "Não aprovado", zh: "未批准" },
  contestado: { pt: "Contestado", zh: "异议" },
};

/** Par PT/中文 do status no vocabulário do checklist. */
export function checklistStatusTexto(status: string | null | undefined): DocStatusTexto {
  const s = (status || "nao_criado").toLowerCase();
  return CHECKLIST_STATUS_LABEL[s] ?? { pt: s, zh: s };
}

/** Rótulo do checklist já formatado (bilíngue por padrão). */
export function checklistStatusLabel(
  status: string | null | undefined,
  idioma: DocStatusIdioma = "bi",
): string {
  return formatarLabelBilingue(checklistStatusTexto(status), idioma);
}

export const DOC_STATUS_TONE: Record<string, string> = {
  aprovado: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200",
  rejeitado: "bg-rose-100 text-rose-900 dark:bg-rose-900/30 dark:text-rose-200",
  contestado: "bg-rose-100 text-rose-900 dark:bg-rose-900/30 dark:text-rose-200",
  em_analise: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
  em_revisao: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
};

/**
 * Estágio do fluxo China → Brasil. É a fonte ÚNICA que decide:
 *  - a coluna do Kanban da Caixa de Entrada,
 *  - a pasta da Caixa de Entrada,
 *  - o chip/contador do Checklist (Status e Modo Foco).
 *
 * Qualquer tela que precise interpretar `china_produto_documentos.status`
 * deve passar por aqui — nunca reimplementar a cadeia de comparações.
 */
export type FluxoBucket =
  | "nao_criado"
  | "rascunho"
  | "pendente_envio"
  | "enviado"
  | "em_analise"
  | "aprovado"
  | "devolvido";

/**
 * Mapa explícito status persistido → estágio do fluxo.
 * Todos os valores realmente gravados pelo sistema estão aqui; qualquer
 * novo status precisa ser adicionado nesta tabela (e nos testes).
 */
export const STATUS_TO_FLUXO: Record<string, FluxoBucket> = {
  // Ainda em preparação do lado da China
  rascunho: "rascunho",
  planejado: "pendente_envio",
  em_preparacao: "pendente_envio",
  pendente: "pendente_envio",
  // Despachado ao Brasil, aguardando o Brasil abrir
  enviado: "enviado",
  enviado_brasil: "enviado",
  enviado_parcial: "enviado",
  arte_enviada: "enviado",
  // Brasil abriu / está avaliando
  em_analise: "em_analise",
  em_revisao: "em_analise",
  contestado: "em_analise",
  // Decisão favorável (ciência é aceite com ressalva, conta como aprovado)
  aprovado: "aprovado",
  ciencia: "aprovado",
  // Decisão de devolução
  rejeitado: "devolvido",
  devolvido_china: "devolvido",
};

const fluxoDesconhecidoLogado = new Set<string>();

/** Estágio do fluxo de um status persistido. `null`/vazio = item ainda não criado. */
export function bucketFluxo(status: string | null | undefined): FluxoBucket {
  const s = (status || "").trim().toLowerCase();
  if (!s) return "nao_criado";
  const bucket = STATUS_TO_FLUXO[s];
  if (bucket) return bucket;
  if (!fluxoDesconhecidoLogado.has(s)) {
    fluxoDesconhecidoLogado.add(s);
    console.warn(`[china/docStatus] status desconhecido "${s}" — tratado como pendente de envio.`);
  }
  return "pendente_envio";
}

/** Documento já teve decisão favorável do Brasil (aprovado ou ciência). */
export function isAprovado(status: string | null | undefined): boolean {
  return bucketFluxo(status) === "aprovado";
}

/** Documento foi devolvido pelo Brasil (rejeitado ou devolvido à China). */
export function isDevolvido(status: string | null | undefined): boolean {
  return bucketFluxo(status) === "devolvido";
}

/** Normaliza qualquer status bruto para uma das quatro decisões administrativas. */
export function normalizarDecisao(status: string | null | undefined): DocDecisao {
  switch (bucketFluxo(status)) {
    case "aprovado":
      return "aprovado";
    case "devolvido":
      return "rejeitado";
    case "em_analise":
      return "em_analise";
    default:
      return "pendente";
  }
}

export function docStatusLabel(
  status: string | null | undefined,
  idioma: DocStatusIdioma = "bi",
): string {
  const s = (status || "rascunho").toLowerCase();
  const texto = DOC_STATUS_LABEL[s];
  if (!texto) return s;
  return formatarLabelBilingue(texto, idioma);
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
  pendente: "Pendente de aprovação 待审批",
  em_analise: "Em análise 审核中",
  aprovado: "Aprovado 已批准",
  rejeitado: "Não aprovado 未批准",
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
