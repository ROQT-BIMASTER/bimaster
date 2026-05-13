// Resolve um evento da timeline em uma ação de navegação.
// - Quando aponta para outra aba interna do painel: devolve `tab`.
// - Quando aponta para uma rota externa: devolve `href`.
// - Quando o evento referencia um documento da submissão: devolve `documentoId`
//   para o consumidor abrir o preview correspondente via `onPreviewDoc`.

import type { ChinaTimelineEvent } from "@/lib/china/timeline/types";

export type VincularInternalTab =
  | "documentos"
  | "chat"
  | "despacho"
  | "aprovacao"
  | "processo";

export interface TimelineNavTarget {
  /** Aba interna do painel para a qual navegar. */
  tab?: VincularInternalTab;
  /** Rota externa (react-router) — ex.: `/china/oc/:id`. */
  href?: string;
  /** Documento a abrir em preview na aba "documentos". */
  documentoId?: string;
  /** Rótulo curto para tooltip do botão. */
  label: string;
}

export function resolveTimelineNav(event: ChinaTimelineEvent): TimelineNavTarget | null {
  const k = event.kind;
  const refs = event.refs ?? {};

  // Documento → abre preview na aba documentos
  if ((k === "documento_anexado" || k === "documento_status") && refs.documentoId) {
    return { tab: "documentos", documentoId: refs.documentoId, label: "Abrir documento" };
  }

  // Chat → muda para a aba chat
  if (k === "chat_mensagem") {
    return { tab: "chat", label: "Abrir conversa" };
  }

  // Aprovação → aba aprovacao
  if (k === "aprovacao_iniciada" || k === "aprovacao_concluida" || k === "aprovacao_rejeitada") {
    return { tab: "aprovacao", label: "Abrir aprovação" };
  }

  // Status / parecer / waiver / liberação → aba despacho
  if (
    k === "submissao_status" ||
    k === "parecer_china" ||
    k === "waiver_aplicado" ||
    k === "liberada_para_oc"
  ) {
    return { tab: "despacho", label: "Abrir despacho" };
  }

  // Rotas externas
  if ((k === "oc_emitida" || k === "oc_status") && refs.ocId) {
    return { href: `/china/oc/${refs.ocId}`, label: "Abrir OC" };
  }
  if ((k === "op_criada" || k === "apontamento_producao") && refs.opId) {
    return { href: `/china/op/${refs.opId}`, label: "Abrir OP" };
  }
  if ((k === "embarque_criado" || k === "embarque_status" || k === "container_evento") && refs.embarqueId) {
    return { href: `/china/embarques/${refs.embarqueId}`, label: "Abrir embarque" };
  }
  if ((k === "recebimento_iniciado" || k === "recebimento_status") && refs.recebimentoId) {
    return { href: `/china/recebimentos/${refs.recebimentoId}`, label: "Abrir recebimento" };
  }
  if ((k === "nc_aberta" || k === "nc_status") && refs.ncId) {
    return { href: `/china/nc/${refs.ncId}`, label: "Abrir não conformidade" };
  }

  return null;
}
