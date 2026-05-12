export type ChinaTimelineKind =
  | "submissao_criada"
  | "submissao_status"
  | "documento_anexado"
  | "documento_status"
  | "parecer_china"
  | "waiver_aplicado"
  | "liberada_para_oc"
  | "oc_emitida"
  | "oc_status"
  | "op_criada"
  | "apontamento_producao"
  | "pronto_embarque"
  | "embarque_criado"
  | "embarque_status"
  | "container_evento"
  | "recebimento_iniciado"
  | "recebimento_status"
  | "nc_aberta"
  | "nc_status"
  | "chat_mensagem";

export type ChinaTimelineActor = "china" | "brasil" | "sistema";

export interface ChinaTimelineScope {
  submissaoId?: string | null;
  ocId?: string | null;
  opId?: string | null;
  embarqueId?: string | null;
  containerId?: string | null;
  recebimentoId?: string | null;
  ncId?: string | null;
  produtoCodigo?: string | null;
}

export interface ChinaTimelineEvent {
  id: string;
  kind: ChinaTimelineKind | string;
  title: string;
  descricao?: string | null;
  payload?: Record<string, unknown> | null;
  actor: ChinaTimelineActor;
  actorLabel?: string | null;
  timestamp: string;
  refs: {
    submissaoId?: string | null;
    ocId?: string | null;
    opId?: string | null;
    embarqueId?: string | null;
    containerId?: string | null;
    recebimentoId?: string | null;
    ncId?: string | null;
    documentoId?: string | null;
    produtoCodigo?: string | null;
  };
}
