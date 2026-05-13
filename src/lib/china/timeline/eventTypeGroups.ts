// Agrupamento dos `kind` da timeline em tipos amplos (filtros da Vincular China).

export type TimelineEventType = "status" | "documento" | "chat" | "outros";

const TYPE_BY_KIND: Record<string, TimelineEventType> = {
  // Status (mudanças de estado, governança, aprovações)
  submissao_status: "status",
  oc_status: "status",
  embarque_status: "status",
  recebimento_status: "status",
  nc_status: "status",
  container_evento: "status",
  aprovacao_iniciada: "status",
  aprovacao_concluida: "status",
  aprovacao_rejeitada: "status",
  liberada_para_oc: "status",

  // Documentos
  documento_anexado: "documento",
  documento_status: "documento",
  parecer_china: "documento",
  waiver_aplicado: "documento",

  // Chat
  chat_mensagem: "chat",
};

export function eventTypeOf(kind: string): TimelineEventType {
  return TYPE_BY_KIND[kind] ?? "outros";
}

export const TIMELINE_TYPE_LABELS: Record<TimelineEventType, string> = {
  status: "Status",
  documento: "Documento",
  chat: "Chat",
  outros: "Outros",
};

export const TIMELINE_ACTOR_LABELS: Record<"china" | "brasil" | "sistema", string> = {
  china: "China",
  brasil: "Brasil",
  sistema: "Sistema",
};
