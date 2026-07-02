/**
 * Upload resiliente com suporte a upload em partes (TUS/chunked).
 *
 * Estratégia adaptativa por tamanho:
 *  - < 5 MB   → fast-path via supabase-js (single-shot).
 *  - >= 5 MB  → protocolo TUS 1.0 contra o endpoint nativo do Storage
 *               (`/storage/v1/upload/resumable`), em chunks de 6 MB (múltiplo
 *               exigido pelo Supabase). Permite retomar após falha de rede,
 *               reduz risco de timeout de proxy/CDN em requisições longas
 *               e escala até o limite do bucket (1 GB neste projeto).
 *
 * Vantagens do modo chunked:
 *  - Uma única requisição HTTP não precisa carregar 1 GB de uma vez.
 *  - Retry por chunk (backoff exponencial embutido no tus-js-client).
 *  - Progresso granular (por byte enviado) e `abort()` real.
 *  - Se a rede cair no meio, o tus-js-client retoma do último chunk aceito.
 */
import { supabase } from "@/integrations/supabase/client";
import { validateFileForUpload } from "@/lib/utils/file-security";
import * as tus from "tus-js-client";

export interface ResumableUploadOptions {
  bucket: string;
  path: string;
  file: File;
  /** Chamado várias vezes; percent ∈ [0,100]. */
  onProgress?: (percent: number, bytesSent: number, totalBytes: number) => void;
  /** Sinal externo de cancelamento (ex.: usuário clica em "Cancelar"). */
  signal?: AbortSignal;
  /** Máx. de tentativas por falha transitória (rede/5xx). Default 5. */
  maxRetries?: number;
  /** Pula `validateFileForUpload` (uso avançado — validador já executado). */
  skipValidation?: boolean;
  /** Sobrescreve o objeto se já existir. Default false. */
  upsert?: boolean;
}

export interface ResumableUploadResult {
  path: string;
}

export class ResumableUploadError extends Error {
  constructor(public code: string, message: string, public status?: number) {
    super(message);
    this.name = "ResumableUploadError";
  }
}

// TUS chunk size — Supabase exige múltiplo de 6 MB (exceto o último).
const TUS_CHUNK_SIZE = 6 * 1024 * 1024;
const SMALL_UPLOAD_THRESHOLD = 5 * 1024 * 1024;

async function chunkedTusUpload(opts: ResumableUploadOptions & { upsert: boolean }): Promise<void> {
  const { bucket, path, file, onProgress, signal, maxRetries = 5, upsert } = opts;

  const { data: sess } = await supabase.auth.getSession();
  const accessToken = sess.session?.access_token;
  if (!accessToken) throw new ResumableUploadError("no_session", "Sessão expirada. Faça login novamente.");

  const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL as string;
  if (!supabaseUrl) throw new ResumableUploadError("config", "URL do backend não configurada.");

  await new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `${supabaseUrl}/storage/v1/upload/resumable`,
      retryDelays: [0, 800, 1600, 3200, 6400, 12800].slice(0, maxRetries + 1),
      headers: {
        authorization: `Bearer ${accessToken}`,
        "x-upsert": upsert ? "true" : "false",
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: TUS_CHUNK_SIZE,
      metadata: {
        bucketName: bucket,
        objectName: path,
        contentType: file.type || "application/octet-stream",
        cacheControl: "3600",
      },
      onError: (err: any) => {
        const status = err?.originalResponse?.getStatus?.();
        const base = err?.message || "Falha no upload em partes.";
        // Anexa "413" ao texto quando aplicável para que `describeUploadError`
        // reconheça o payload-too-large e exiba a mensagem amigável correta.
        const msg = status === 413 && !/413/.test(base)
          ? `413 Payload Too Large — ${base}`
          : base;
        reject(new ResumableUploadError(status === 413 ? "payload_too_large" : "tus_error", msg, status));
      },
      onProgress: (bytesSent, bytesTotal) => {
        const percent = bytesTotal > 0 ? Math.min(99, Math.round((bytesSent / bytesTotal) * 100)) : 0;
        onProgress?.(percent, bytesSent, bytesTotal);
      },
      onSuccess: () => {
        onProgress?.(100, file.size, file.size);
        resolve();
      },
    });

    if (signal) {
      if (signal.aborted) {
        reject(new ResumableUploadError("aborted", "Upload cancelado antes do envio."));
        return;
      }
      signal.addEventListener("abort", () => {
        upload.abort(true).catch(() => {});
        reject(new ResumableUploadError("aborted", "Upload cancelado."));
      }, { once: true });
    }

    // Retoma upload anterior se existir fingerprint no localStorage.
    upload.findPreviousUploads().then((prev) => {
      if (prev.length > 0) upload.resumeFromPreviousUpload(prev[0]);
      upload.start();
    }).catch(() => upload.start());
  });
}

/**
 * Upload resiliente com progresso, retry e cancelamento.
 *
 * - < 5 MB   → single-shot via supabase-js.
 * - >= 5 MB  → chunked (TUS) em partes de 6 MB, com retomada automática.
 */
export async function resumableUpload(opts: ResumableUploadOptions): Promise<ResumableUploadResult> {
  const { bucket, path, file, onProgress, skipValidation, upsert = false } = opts;

  if (!skipValidation) {
    const v = await validateFileForUpload(file);
    if (!v.valid) throw new ResumableUploadError(v.code || "invalid", v.error || "Arquivo inválido");
  }

  // Fast-path para arquivos pequenos.
  if (file.size < SMALL_UPLOAD_THRESHOLD) {
    onProgress?.(0, 0, file.size);
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      upsert,
      contentType: file.type || undefined,
    });
    if (error) throw new ResumableUploadError("supabase_upload", error.message);
    onProgress?.(100, file.size, file.size);
    return { path };
  }

  // Chunked TUS para tudo acima de 5 MB — cobre até 1 GB com retomada.
  await chunkedTusUpload({ ...opts, upsert });
  return { path };
}
