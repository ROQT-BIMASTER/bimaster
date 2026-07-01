/**
 * Guard compartilhado para uploads de anexos em qualquer tela do app.
 *
 * Uso único para padronizar validação + toast + telemetria em Chat, China,
 * Fábrica, Trade, Financeiro, etc., mantendo o bucket/caminho de cada módulo.
 *
 *   const ok = await guardFileUpload({ file, module: "china-doc", userId, contextId });
 *   if (!ok) return;
 *   // segue para supabase.storage.from(<bucket>).upload(...)
 */

import { toast } from "sonner";
import { validateFileForUpload, describeUploadError } from "@/lib/utils/file-security";
import {
  reportGenericUploadRejection,
  reportGenericUploadSuccess,
  reportGenericUploadError,
  type UploadModule,
  type UploadRejectionReason,
} from "@/lib/telemetry/uploadTelemetry";

export interface GuardFileUploadInput {
  file: File;
  module: UploadModule;
  userId?: string | null;
  /** Id de contexto (conversa, projeto, produto, cofre, etc.) — opcional. */
  contextId?: string | null;
  /** Se true, não dispara toast (o caller trata). */
  silent?: boolean;
}

/**
 * Valida um único arquivo. Retorna true se pode seguir com o upload.
 * Em caso de rejeição: dispara toast padronizado e telemetria.
 */
export async function guardFileUpload(input: GuardFileUploadInput): Promise<boolean> {
  const { file, module, userId, contextId, silent } = input;
  const result = await validateFileForUpload(file);
  if (result.valid) return true;

  const desc = describeUploadError(result.error ?? "Arquivo inválido");
  if (!silent) toast.error(desc.title, { description: desc.description });

  reportGenericUploadRejection({
    module,
    file,
    userId: userId ?? "anon",
    contextId: contextId ?? null,
    error: result.error,
    reason: mapCodeToReason(result.code),
  });
  return false;
}

/**
 * Valida múltiplos arquivos. Retorna somente os aprovados; rejeita os demais
 * via toast (um por arquivo) e telemetria.
 */
export async function guardFilesUpload(
  files: File[],
  base: Omit<GuardFileUploadInput, "file">,
): Promise<File[]> {
  const approved: File[] = [];
  for (const file of files) {
    if (await guardFileUpload({ ...base, file })) approved.push(file);
  }
  return approved;
}

export function reportUploadSuccessShared(input: {
  module: UploadModule;
  file: File;
  userId?: string | null;
  contextId?: string | null;
  storagePath: string;
}): void {
  reportGenericUploadSuccess({
    module: input.module,
    file: input.file,
    userId: input.userId ?? "anon",
    contextId: input.contextId ?? null,
    storagePath: input.storagePath,
  });
}

export function reportUploadFailureShared(input: {
  module: UploadModule;
  file: File;
  userId?: string | null;
  contextId?: string | null;
  error: unknown;
  reason?: Extract<UploadRejectionReason, "storage_upload_failed" | "metadata_insert_failed" | "unknown">;
  /** Se true, dispara toast além de logar. */
  toast?: boolean;
}): void {
  reportGenericUploadError({
    module: input.module,
    file: input.file,
    userId: input.userId ?? "anon",
    contextId: input.contextId ?? null,
    error: input.error,
    reason: input.reason ?? "storage_upload_failed",
  });
  if (input.toast) {
    const raw = typeof input.error === "string" ? input.error : (input.error as Error)?.message ?? "";
    const desc = describeUploadError(raw);
    toast.error(desc.title, { description: desc.description });
  }
}

function mapCodeToReason(code?: string): UploadRejectionReason {
  switch (code) {
    case "SIZE_EXCEEDED":
      return "size_exceeded";
    case "EXTENSION_BLOCKED":
    case "EXTENSION_NOT_ALLOWED":
    case "DOUBLE_EXTENSION":
    case "MIME_REJECTED":
    case "MAGIC_BYTES_MISMATCH":
      return "invalid_type";
    default:
      return "unknown";
  }
}
