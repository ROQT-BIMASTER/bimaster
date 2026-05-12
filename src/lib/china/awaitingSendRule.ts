/**
 * Regra de "Pendentes de envio" (China → Brasil) — centralizada em um único
 * módulo para facilitar ajustes futuros e testes.
 *
 * Um item entra em "Pendentes de envio" quando, do ponto de vista da China,
 * o checklist ainda não está pronto para ser despachado ao Brasil:
 *  - é um rascunho explícito; OU
 *  - não tem documento anexado (`documento_id` vazio); OU
 *  - não tem parecer técnico da China (`observacoes_china` vazio);
 *
 * Status finais (aprovado / rejeitado pela diretoria) nunca entram.
 *
 * As checagens são parametrizáveis via {@link AwaitingSendConfig}.
 */

export type AwaitingSendReason =
  | "rascunho"
  | "sem_documento"
  | "sem_parecer";

export interface AwaitingSendItemLike {
  is_deleted?: boolean;
  submissao_status?: string | null;
  doc_status?: string | null;
  documento_id?: string | null;
  observacoes_china?: string | null;
}

export interface AwaitingSendConfig {
  /** Tratar `submissao_status === "rascunho"` (ou `doc_status === "rascunho"`) como pendente. */
  treatRascunhoAsAwaiting: boolean;
  /** Marcar como pendente quando não há documento anexado. */
  requireDocumentoAnexado: boolean;
  /** Marcar como pendente quando não há parecer técnico (`observacoes_china`). */
  requireParecerChina: boolean;
  /** Status de submissão que nunca contam como pendente (ex.: aprovado/rejeitado). */
  excludeSubmissaoStatuses: string[];
  /** Status de documento que nunca contam como pendente. */
  excludeDocStatuses: string[];
}

export const DEFAULT_AWAITING_SEND_CONFIG: AwaitingSendConfig = {
  treatRascunhoAsAwaiting: true,
  requireDocumentoAnexado: true,
  requireParecerChina: true,
  excludeSubmissaoStatuses: ["aprovado", "rejeitado"],
  excludeDocStatuses: [],
};

export interface AwaitingSendEvaluation {
  matches: boolean;
  reasons: AwaitingSendReason[];
}

const isBlank = (v: string | null | undefined) =>
  !v || String(v).trim().length === 0;

export function evaluateAwaitingSend(
  item: AwaitingSendItemLike,
  config: AwaitingSendConfig = DEFAULT_AWAITING_SEND_CONFIG,
): AwaitingSendEvaluation {
  if (item.is_deleted) return { matches: false, reasons: [] };

  const sStatus = item.submissao_status ?? "";
  const dStatus = item.doc_status ?? "";
  if (config.excludeSubmissaoStatuses.includes(sStatus)) return { matches: false, reasons: [] };
  if (dStatus && config.excludeDocStatuses.includes(dStatus)) return { matches: false, reasons: [] };

  const reasons: AwaitingSendReason[] = [];

  if (
    config.treatRascunhoAsAwaiting &&
    (sStatus === "rascunho" || dStatus === "rascunho")
  ) {
    reasons.push("rascunho");
  }

  if (config.requireDocumentoAnexado && !item.documento_id) {
    reasons.push("sem_documento");
  }

  if (config.requireParecerChina && isBlank(item.observacoes_china)) {
    reasons.push("sem_parecer");
  }

  return { matches: reasons.length > 0, reasons };
}

/** Rótulos curtos para exibição na UI. */
export const AWAITING_SEND_REASON_LABEL: Record<AwaitingSendReason, string> = {
  rascunho: "Rascunho",
  sem_documento: "Sem documento",
  sem_parecer: "Sem parecer",
};
