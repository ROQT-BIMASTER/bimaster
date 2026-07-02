/**
 * useUploadChinaDocumento
 * ------------------------------------------------------------------
 * Hook compartilhado para anexar um documento ao checklist de uma submissão
 * China. Hardened para tratar todas as falhas plausíveis:
 *  - validação local (tamanho, MIME, magic bytes, double-extension)
 *  - sessão expirada
 *  - timeout + retry com backoff em erros transitórios
 *  - rollback do Storage se o cadastro no DB falhar
 *  - mensagens humanas por código de erro
 *  - invalidação ampla de cache (submissão, tarefa vinculada, inbox)
 *
 * Memória relacionada: mem://features/china/upload-documentos-hardening
 */
import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { validateFileForUpload } from "@/lib/utils/file-security";
import { UPLOAD_MAX_LABEL } from "@/lib/upload/limits";
import { resumableUpload } from "@/lib/upload/resumableUpload";
import { reportGenericUploadSuccess, reportGenericUploadRejection, reportGenericUploadError } from "@/lib/telemetry/uploadTelemetry";
import { sanitizeStorageSegment } from "@/lib/china/sanitizeTipoKey";
import { logger } from "@/lib/logger";
import { toast } from "sonner";

const BUCKET = "china-documentos";
const UPLOAD_TIMEOUT_MS = 60_000;
const MAX_RETRIES = 2; // total = 3 tentativas
const RETRY_BASE_MS = 700;

const observacaoSchema = z
  .string()
  .trim()
  .max(2000, "Observação deve ter até 2000 caracteres.");

export type UploadErrorCode =
  | "INVALID_FILE"
  | "NO_SESSION"
  | "STORAGE_PAYLOAD_TOO_LARGE"
  | "STORAGE_INVALID_KEY"
  | "STORAGE_DENIED"
  | "STORAGE_NETWORK"
  | "STORAGE_TIMEOUT"
  | "STORAGE_UNKNOWN"
  | "DB_DENIED"
  | "DB_CONFLICT"
  | "DB_UNKNOWN";

export interface UploadVars {
  submissaoId: string;
  tipo: string;
  file: File;
  status?: "rascunho" | "pendente";
  observacoesChina?: string | null;
}

export interface UploadResult {
  documento_id: string | null;
  arquivo_path: string;
  signed_url: string;
}

interface UploadFailure {
  code: UploadErrorCode;
  message: string;
}

function mapStorageError(err: any): UploadFailure {
  const raw = String(err?.message ?? err ?? "");
  const status = err?.statusCode ?? err?.status;

  if (/invalid key/i.test(raw)) {
    return { code: "STORAGE_INVALID_KEY", message: "Nome de arquivo inválido. Renomeie e tente novamente." };
  }
  if (status === 413 || /payload too large|exceeds/i.test(raw)) {
    return { code: "STORAGE_PAYLOAD_TOO_LARGE", message: `Arquivo excede o limite permitido (${UPLOAD_MAX_LABEL}).` };
  }
  if (status === 401 || status === 403 || /not authorized|forbidden|denied/i.test(raw)) {
    return { code: "STORAGE_DENIED", message: "Você não tem permissão para enviar este documento." };
  }
  if (err?.name === "AbortError" || /timeout|aborted/i.test(raw)) {
    return { code: "STORAGE_TIMEOUT", message: "O envio demorou demais. Verifique sua conexão e tente novamente." };
  }
  if (/network|fetch failed|load failed/i.test(raw)) {
    return { code: "STORAGE_NETWORK", message: "Falha de rede ao enviar o arquivo. Tente novamente." };
  }
  return { code: "STORAGE_UNKNOWN", message: raw || "Falha ao enviar o arquivo." };
}

function mapDbError(err: any): UploadFailure {
  const raw = String(err?.message ?? err ?? "");
  const code = err?.code;
  if (code === "42501" || /permission denied|rls|policy/i.test(raw)) {
    return { code: "DB_DENIED", message: "Você não tem permissão para registrar este documento." };
  }
  if (code === "23505" || /duplicate|unique/i.test(raw)) {
    return { code: "DB_CONFLICT", message: "Este documento já foi registrado. Atualize a página." };
  }
  return { code: "DB_UNKNOWN", message: raw || "Falha ao registrar o documento." };
}

function isTransient(code: UploadErrorCode): boolean {
  return code === "STORAGE_NETWORK" || code === "STORAGE_TIMEOUT" || code === "STORAGE_UNKNOWN";
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(Object.assign(new Error(`${label} timeout`), { name: "AbortError" })), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function uploadWithRetry(
  path: string,
  file: File,
): Promise<{ ok: true } | { ok: false; failure: UploadFailure }> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await withTimeout(
        resumableUpload({
          bucket: BUCKET,
          path,
          file,
          upsert: false,
          skipValidation: true,
        }),
        UPLOAD_TIMEOUT_MS,
        "upload",
      );
      return { ok: true };
    } catch (err: any) {
      const failure = mapStorageError(err);
      if (!isTransient(failure.code) || attempt === MAX_RETRIES) {
        return { ok: false, failure };
      }
    }
    await new Promise((r) => setTimeout(r, RETRY_BASE_MS * Math.pow(2, attempt)));
  }
  return { ok: false, failure: { code: "STORAGE_UNKNOWN", message: "Falha ao enviar." } };
}

export function useUploadChinaDocumento() {
  const qc = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invalidateAll = useCallback(
    (submissaoId: string) => {
      // Delegamos para o invalidador compartilhado para garantir que TODAS as
      // telas que mostram o checklist atualizem sem precisar de F5.
      import("@/lib/china/invalidateChecklist").then(({ invalidateChinaChecklist }) => {
        invalidateChinaChecklist(qc, submissaoId);
      });
    },
    [qc],
  );

  const uploadAndAttach = useCallback(
    async ({
      submissaoId,
      tipo,
      file,
      status = "rascunho",
      observacoesChina,
    }: UploadVars): Promise<UploadResult | null> => {
      setError(null);

      // 0. Sanity de inputs do chamador.
      if (!submissaoId || !tipo || !file) {
        const msg = "Parâmetros inválidos para upload.";
        setError(msg);
        toast.error(msg);
        return null;
      }

      // 1. Validação local (extensão, MIME, magic bytes, double-extension, tamanho).
      const v = await validateFileForUpload(file);
      if (!v.valid) {
        const msg = v.error || "Arquivo rejeitado pela validação de segurança.";
        setError(msg);
        toast.error(msg);
        reportGenericUploadRejection({
          module: "china-doc",
          file,
          userId: "anon",
          contextId: submissaoId,
          error: msg,
        });
        return null;
      }

      // 2. Observação opcional (trim + tamanho).
      let observacaoNorm: string | null | undefined;
      if (typeof observacoesChina === "string") {
        const parsed = observacaoSchema.safeParse(observacoesChina);
        if (!parsed.success) {
          const msg = parsed.error.issues[0]?.message ?? "Observação inválida.";
          setError(msg);
          toast.error(msg);
          return null;
        }
        observacaoNorm = parsed.data.length > 0 ? parsed.data : null;
      }

      setIsUploading(true);
      let uploadedPath: string | null = null;
      try {
        // 3. Sessão válida (revalida a cada upload).
        const { data: sessionData, error: sessErr } = await supabase.auth.getSession();
        if (sessErr || !sessionData?.session) {
          const msg = "Sua sessão expirou. Faça login novamente.";
          setError(msg);
          toast.error(msg);
          return null;
        }
        const uid = sessionData.session.user.id;

        // 4. Path determinístico e ASCII-safe.
        const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 120) || "arquivo";
        const safeTipo = sanitizeStorageSegment(tipo);
        const path = `${uid}/${submissaoId}/${safeTipo}/${Date.now()}_${safeName}`;

        // 5. Upload com retry/timeout/abort.
        const up = await uploadWithRetry(path, file);
        if (up.ok === false) {
          const failure = up.failure;
          setError(failure.message);
          toast.error(failure.message);
          logger.error("Upload China — storage", {
            action: "china_upload_storage_fail",
            metadata: {
              code: failure.code,
              submissaoId,
              tipo: safeTipo,
              size: file.size,
              mime: file.type,
            },
          });
          reportGenericUploadError({
            module: "china-doc",
            file,
            userId: uid,
            contextId: submissaoId,
            error: failure.message,
            reason: "storage_upload_failed",
          });
          return null;
        }
        uploadedPath = path;
        reportGenericUploadSuccess({
          module: "china-doc",
          file,
          userId: uid,
          contextId: submissaoId,
          storagePath: path,
        });

        // 6. Signed URL (1 ano — já é cadastrada em arquivo_url; preview renova quando precisar).
        const { data: signed, error: signErr } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(path, 31_536_000);
        if (signErr || !signed?.signedUrl) {
          throw signErr || new Error("Não foi possível gerar a URL do arquivo.");
        }
        const signedUrl = signed.signedUrl;

        // 7. Cadastro/atualização no banco (reaproveita placeholder "planejado" se houver).
        const { data: existing } = await (supabase as any)
          .from("china_produto_documentos")
          .select("id")
          .eq("submissao_id", submissaoId)
          .eq("tipo_documento", tipo)
          .eq("status", "planejado")
          .limit(1)
          .maybeSingle();

        const payload: Record<string, unknown> = {
          arquivo_url: signedUrl,
          arquivo_path: path,
          nome_arquivo: file.name,
          status,
        };
        if (observacaoNorm !== undefined) payload.observacao = observacaoNorm;

        let documentoId: string | null = null;
        if (existing?.id) {
          const { error: updErr } = await (supabase as any)
            .from("china_produto_documentos")
            .update(payload)
            .eq("id", existing.id);
          if (updErr) throw updErr;
          documentoId = existing.id as string;
        } else {
          const { data: inserted, error: insErr } = await (supabase as any)
            .from("china_produto_documentos")
            .insert({ submissao_id: submissaoId, tipo_documento: tipo, ...payload })
            .select("id")
            .single();
          if (insErr) throw insErr;
          documentoId = (inserted?.id as string) ?? null;
        }

        invalidateAll(submissaoId);
        toast.success("Documento anexado.");
        return { documento_id: documentoId, arquivo_path: path, signed_url: signedUrl };
      } catch (err: any) {
        // Rollback: se o arquivo já subiu mas o cadastro falhou, remove do Storage para
        // não deixar lixo órfão.
        if (uploadedPath) {
          try {
            await supabase.storage.from(BUCKET).remove([uploadedPath]);
          } catch (rmErr) {
            logger.warn("Upload China — rollback falhou", {
              action: "china_upload_rollback_fail",
              metadata: { path: uploadedPath, err: String(rmErr) },
            });
          }
        }
        const failure = mapDbError(err);
        setError(failure.message);
        toast.error(failure.message);
        logger.error("Upload China — db", {
          action: "china_upload_db_fail",
          metadata: { code: failure.code, submissaoId, tipo, hadRollback: !!uploadedPath },
        });
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [invalidateAll],
  );

  /** Atualiza apenas a observação da China em um documento já existente. */
  const updateObservacaoChina = useCallback(
    async (documentoId: string, observacaoChina: string | null) => {
      if (!documentoId) {
        toast.error("Documento inválido.");
        return false;
      }
      const parsed = observacaoSchema.safeParse(observacaoChina ?? "");
      if (!parsed.success) {
        const msg = parsed.error.issues[0]?.message ?? "Observação inválida.";
        toast.error(msg);
        return false;
      }
      const value = parsed.data.length > 0 ? parsed.data : null;
      try {
        const { error: e } = await (supabase as any)
          .from("china_produto_documentos")
          .update({ observacao: value })
          .eq("id", documentoId);
        if (e) throw e;
        qc.invalidateQueries({ queryKey: ["china-mailbox-dataset"] });
        qc.invalidateQueries({ queryKey: ["china-docs-da-tarefa"] });
        return true;
      } catch (err: any) {
        const failure = mapDbError(err);
        toast.error(failure.message);
        logger.error("Observação China — falha ao salvar", {
          action: "china_obs_save_fail",
          metadata: { code: failure.code, documentoId },
        });
        return false;
      }
    },
    [qc],
  );

  return { uploadAndAttach, updateObservacaoChina, isUploading, error };
}
