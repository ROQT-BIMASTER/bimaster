/**
 * Persistência dos eventos de upload no backend.
 *
 * A telemetria de upload vivia apenas na memória do navegador, o que
 * impossibilitava diagnosticar falhas relatadas por equipes remotas (China).
 * Aqui registramos no backend todas as rejeições e erros — sucessos não são
 * persistidos para manter o volume baixo.
 *
 * Ativado uma única vez em `main.tsx` via `initUploadAuditPersistence()`.
 */
import { supabase } from "@/integrations/supabase/client";
import { onUploadEvent, type UploadAuditEvent } from "@/lib/telemetry/uploadTelemetry";

let initialized = false;
let queue: UploadAuditEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

const FLUSH_DELAY_MS = 1500;
const MAX_BATCH = 20;

function toRow(e: UploadAuditEvent) {
  return {
    module: e.module ?? "generic",
    status: e.status,
    reason: e.reason ?? null,
    error_code: (e as { errorCode?: string }).errorCode ?? null,
    message: e.message ? e.message.slice(0, 2000) : null,
    file_name: e.fileName ? e.fileName.slice(0, 300) : null,
    file_type: e.fileType ?? null,
    file_size: e.fileSize ?? null,
    context_id: e.contextId ?? e.tarefaId ?? null,
    page_url: e.pageUrl ? e.pageUrl.slice(0, 500) : null,
  };
}

async function flush() {
  flushTimer = null;
  const batch = queue.splice(0, MAX_BATCH);
  if (batch.length === 0) return;
  try {
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user?.id;
    if (!uid) return; // sem sessão não há como gravar (RLS por usuário)
    await (supabase as never as {
      from: (t: string) => { insert: (rows: unknown[]) => Promise<unknown> };
    })
      .from("upload_audit_events")
      .insert(batch.map((e) => ({ ...toRow(e), user_id: uid })));
  } catch {
    /* auditoria nunca pode quebrar o fluxo do usuário */
  }
  if (queue.length > 0) schedule();
}

function schedule() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => void flush(), FLUSH_DELAY_MS);
}

export function initUploadAuditPersistence(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  onUploadEvent((event) => {
    if (event.status === "success") return;
    queue.push(event);
    if (queue.length > 200) queue = queue.slice(-200);
    schedule();
  });

  window.addEventListener("beforeunload", () => {
    if (queue.length > 0) void flush();
  });
}
