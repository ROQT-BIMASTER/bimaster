/**
 * Fluxo compartilhado de upload de anexo em tarefas E subtarefas.
 *
 * Tarefas e subtarefas são o mesmo tipo de linha em `tarefas` (com
 * `parent_id` opcional). Este helper garante que ambos os hooks de detalhe
 * (`useProjetoTarefaDetalhe` e `useMinhasTarefaDetalhe`) executem exatamente
 * as mesmas etapas de validação + storage upload + insert em
 * `projeto_tarefa_anexos`, sem chance de divergência.
 *
 * Regras aplicadas (todas centralizadas):
 *   1. Validação de segurança (`validateFileForUpload`) — extensão, MIME,
 *      tamanho (20 MB documentos / 100 MB vídeos MP4/MOV/WEBM), magic bytes.
 *   2. Sanitização do nome do arquivo antes de compor o path.
 *   3. Path canônico: `<uid>/<tarefaId>/<timestamp>_<nomeSanitizado>` — o
 *      trigger de `storage.objects` e as RLS policies dependem deste formato.
 *   4. Insert em `projeto_tarefa_anexos` com metadados básicos e lista
 *      opcional de usuários a notificar.
 */
import { supabase } from "@/integrations/supabase/client";
import { sanitizeStorageFilename } from "@/lib/utils/sanitizeStorageFilename";
import { validateFileForUpload } from "@/lib/utils/file-security";

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

/**
 * Executa o fluxo completo de upload de anexo de tarefa/subtarefa.
 * Lança `Error` (mensagem amigável) em qualquer falha — o caller mapeia
 * via `describeUploadError` para o toast.
 */
export async function uploadTarefaAnexoToStorage(
  params: UploadTarefaAnexoParams,
): Promise<UploadTarefaAnexoResult> {
  const { file, userId, tarefaId, notificarIds } = params;

  // 1. Validação de segurança (mesmas regras para tarefa e subtarefa)
  const validation = await validateFileForUpload(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // 2. Path canônico (UID/tarefa/timestamp_nome)
  const filePath = `${userId}/${tarefaId}/${Date.now()}_${sanitizeStorageFilename(file.name)}`;

  // 3. Upload ao bucket `projeto-anexos`
  const { error: uploadError } = await supabase.storage
    .from("projeto-anexos")
    .upload(filePath, file);
  if (uploadError) throw uploadError;

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
  if (error) throw error;

  return {
    id: (inserted as any)?.id as string,
    storagePath: filePath,
    nome: file.name,
  };
}
