/**
 * Telemetria/auditoria de uploads de anexo em tarefas e subtarefas.
 *
 * Registra sucesso e rejeições (tipo incompatível, tamanho excedido, erro de
 * storage, erro de insert) para facilitar suporte e depuração.
 *
 * Modelo idêntico ao `avatarTelemetry`:
 *  - Buffer em memória exposto em `window.__uploadAudit` para inspeção via
 *    DevTools (últimos 200 eventos).
 *  - `console.info` em sucessos e `console.warn` em rejeições, com payload
 *    estruturado.
 *  - Listeners plugáveis via `onUploadEvent(handler)` para persistência
 *    externa (edge function de auditoria, Sentry, etc.).
 */

export type UploadEventStatus = "success" | "rejected" | "error";

export type UploadRejectionReason =
  | "invalid_type"
  | "size_exceeded"
  | "payload_too_large_backend"
  | "storage_upload_failed"
  | "metadata_insert_failed"
  | "unknown";

/** Identificador do módulo/tela que originou o upload. */
export type UploadModule =
  | "projeto-tarefa"
  | "chat-v2"
  | "chat-briefing"
  | "chat-aprovacao"
  | "china-chat"
  | "china-doc"
  | "china-pasta-digital"
  | "china-revisao"
  | "fabrica-produto-foto"
  | "fabrica-cofre"
  | "fabrica-cotacao"
  | "fabrica-xml-insumo"
  | "fabrica-ficha-custo"
  | "generic";

export interface UploadAuditEvent {
  status: UploadEventStatus;
  reason?: UploadRejectionReason;
  message?: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  /** Mantido para compat: usado no fluxo de tarefas. Em outros módulos, mesmo valor de contextId. */
  tarefaId: string;
  /** Id de contexto genérico (conversa, produto, projeto, cofre, etc.). */
  contextId?: string | null;
  module?: UploadModule;
  userId: string;
  storagePath?: string;
  at: string;
  pageUrl?: string;
}

type Listener = (event: UploadAuditEvent) => void;

const buffer: UploadAuditEvent[] = [];
const MAX_BUFFER = 200;
const listeners = new Set<Listener>();

function inferReasonFromError(err: unknown): {
  reason: UploadRejectionReason;
  message: string;
} {
  const raw = typeof err === "string" ? err : (err as Error)?.message ?? "";
  const lower = raw.toLowerCase();

  if (lower.includes("payload too large") || lower.includes("exceeded the maximum")) {
    return { reason: "payload_too_large_backend", message: raw };
  }
  if (
    lower.includes("excede") ||
    lower.includes("máximo") ||
    lower.includes("maximo") ||
    lower.includes("mb")
  ) {
    return { reason: "size_exceeded", message: raw };
  }
  if (
    lower.includes("não permitido") ||
    lower.includes("nao permitido") ||
    lower.includes("tipo") ||
    lower.includes("extensão") ||
    lower.includes("extensao") ||
    lower.includes("mime")
  ) {
    return { reason: "invalid_type", message: raw };
  }
  return { reason: "unknown", message: raw };
}

function push(event: UploadAuditEvent): UploadAuditEvent {
  buffer.push(event);
  if (buffer.length > MAX_BUFFER) buffer.splice(0, buffer.length - MAX_BUFFER);

  if (typeof window !== "undefined") {
    (window as unknown as { __uploadAudit?: UploadAuditEvent[] }).__uploadAudit = [...buffer];
  }

  if (typeof console !== "undefined") {
    const payload = {
      status: event.status,
      reason: event.reason,
      message: event.message,
      fileName: event.fileName,
      fileType: event.fileType,
      fileSize: event.fileSize,
      tarefaId: event.tarefaId,
      userId: event.userId,
      storagePath: event.storagePath,
      pageUrl: event.pageUrl,
    };
    if (event.status === "success") {
      console.info("[upload] sucesso", payload);
    } else {
      console.warn("[upload] rejeição/erro", payload);
    }
  }

  listeners.forEach((l) => {
    try {
      l(event);
    } catch {
      /* isolado */
    }
  });

  return event;
}

function baseFields(input: {
  file: { name: string; type: string; size: number };
  tarefaId: string;
  userId: string;
}): Pick<UploadAuditEvent, "fileName" | "fileType" | "fileSize" | "tarefaId" | "userId" | "at" | "pageUrl"> {
  return {
    fileName: input.file.name,
    fileType: input.file.type || "unknown",
    fileSize: input.file.size,
    tarefaId: input.tarefaId,
    userId: input.userId,
    at: new Date().toISOString(),
    pageUrl: typeof window !== "undefined" ? window.location.href : undefined,
  };
}

export function reportUploadSuccess(input: {
  file: { name: string; type: string; size: number };
  tarefaId: string;
  userId: string;
  storagePath: string;
}): UploadAuditEvent {
  return push({
    status: "success",
    storagePath: input.storagePath,
    ...baseFields(input),
  });
}

export function reportUploadRejection(input: {
  file: { name: string; type: string; size: number };
  tarefaId: string;
  userId: string;
  error: unknown;
  /** Se conhecido pelo caller, sobrescreve a inferência automática. */
  reason?: UploadRejectionReason;
}): UploadAuditEvent {
  const inferred = inferReasonFromError(input.error);
  return push({
    status: "rejected",
    reason: input.reason ?? inferred.reason,
    message: inferred.message,
    ...baseFields(input),
  });
}

export function reportUploadError(input: {
  file: { name: string; type: string; size: number };
  tarefaId: string;
  userId: string;
  error: unknown;
  reason: Extract<UploadRejectionReason, "storage_upload_failed" | "metadata_insert_failed" | "unknown">;
}): UploadAuditEvent {
  const raw = typeof input.error === "string" ? input.error : (input.error as Error)?.message ?? "";
  return push({
    status: "error",
    reason: input.reason,
    message: raw,
    ...baseFields(input),
  });
}

export function getUploadAudit(): UploadAuditEvent[] {
  return [...buffer];
}

export function clearUploadAudit(): void {
  buffer.splice(0, buffer.length);
  if (typeof window !== "undefined") {
    (window as unknown as { __uploadAudit?: UploadAuditEvent[] }).__uploadAudit = [];
  }
}

export function onUploadEvent(handler: Listener): () => void {
  listeners.add(handler);
  return () => listeners.delete(handler);
}

// Exportado para testes.
export const __internal = { inferReasonFromError };
