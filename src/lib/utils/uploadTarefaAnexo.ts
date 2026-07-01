/**
 * Fluxo compartilhado de upload de anexo em tarefas E subtarefas.
 *
 * Tarefas e subtarefas são o mesmo tipo de linha em `tarefas` (com
 * `parent_id` opcional). Este helper garante que ambos os hooks de detalhe
 * (`useProjetoTarefaDetalhe` e `useMinhasTarefaDetalhe`) executem exatamente
 * as mesmas etapas de validação + storage upload + insert em
 * `projeto_tarefa_anexos`, sem chance de divergência.
 *
 * Também emite eventos de auditoria (`uploadTelemetry`) em sucesso e em
 * qualquer rejeição — separando validação (tipo/tamanho), erro de storage
 * e erro de metadata para facilitar suporte.
 */
import { supabase } from "@/integrations/supabase/client";
import { sanitizeStorageFilename } from "@/lib/utils/sanitizeStorageFilename";
import { validateFileForUpload } from "@/lib/utils/file-security";
import {
  reportUploadError,
  reportUploadRejection,
  reportUploadSuccess,
} from "@/lib/telemetry/uploadTelemetry";

export interface UploadTarefaAnexoParams {
  file: File;
  userId: string;
  tarefaId: string;
  notificarIds?: string[];
}

export interface UploadTarefaAnexoResult {
  id: string;
  storagePath: string;
  nome: string;
}

export async function uploadTarefaAnexoToStorage(
  params: UploadTarefaAnexoParams,
): Promise<UploadTarefaAnexoResult> {
  const { file, userId, tarefaId, notificarIds } = params;
  const auditBase = { file, tarefaId, userId };

  // 1. Validação de segurança (mesmas regras para tarefa e subtarefa)
  const validation = await validateFileForUpload(file);
  if (!validation.valid) {
    reportUploadRejection({ ...auditBase, error: validation.error ?? "invalid" });
    throw new Error(validation.error);
  }

  // 2. Path canônico (UID/tarefa/timestamp_nome)
  const filePath = `${userId}/${tarefaId}/${Date.now()}_${sanitizeStorageFilename(file.name)}`;

  // 3. Upload ao bucket `projeto-anexos`
  const { error: uploadError } = await supabase.storage
    .from("projeto-anexos")
    .upload(filePath, file);
  if (uploadError) {
    // Erros do backend (ex.: trigger de tamanho, payload too large) chegam aqui.
    const msg = uploadError.message ?? "";
    const isSizeOrType =
      /payload too large|exceed|excede|máximo|maximo|mime|tipo|extens/i.test(msg);
    if (isSizeOrType) {
      reportUploadRejection({ ...auditBase, error: uploadError });
    } else {
      reportUploadError({ ...auditBase, error: uploadError, reason: "storage_upload_failed" });
    }
    throw uploadError;
  }

  // 4. Deduplicação de destinatários (nunca notifica o próprio uploader)
  const cleanedNotificados = Array.from(
    new Set((notificarIds || []).filter((id) => id && id !== userId)),
  );

  // 5. Insert do metadado
  const { data: inserted, error } = await supabase
    .from("projeto_tarefa_anexos")
    .insert({
      tarefa_id: tarefaId,
      user_id: userId,
      nome: file.name,
      storage_path: filePath,
      tipo_arquivo: file.type,
      tamanho: file.size,
      notificados: cleanedNotificados,
    } as any)
    .select("id")
    .single();
  if (error) {
    reportUploadError({ ...auditBase, error, reason: "metadata_insert_failed" });
    throw error;
  }

  reportUploadSuccess({ ...auditBase, storagePath: filePath });

  return {
    id: (inserted as any)?.id as string,
    storagePath: filePath,
    nome: file.name,
  };
}
