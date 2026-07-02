/**
 * Upload resiliente para arquivos grandes (>50 MB) — barra de progresso,
 * cancelamento e retry com backoff exponencial.
 *
 * Estratégia:
 *  1. Cria uma signed upload URL no bucket alvo (short-lived, 60s).
 *  2. Faz PUT XHR direto para o Storage — permite `onUploadProgress`
 *     nativo do browser, `abort()` real e retry idempotente.
 *  3. Timeout adaptativo: base 60s + 200ms por MB (arquivo de 500 MB → ~160s).
 *
 * Callers passam apenas o bucket, path e File; o helper lida com o resto.
 * Reusa `validateFileForUpload` para manter paridade com single-shot.
 */
import { supabase } from "@/integrations/supabase/client";
import { validateFileForUpload } from "@/lib/utils/file-security";

export interface ResumableUploadOptions {
  bucket: string;
  path: string;
  file: File;
  /** Chamado várias vezes; percent ∈ [0,100]. */
  onProgress?: (percent: number, bytesSent: number, totalBytes: number) => void;
  /** Sinal externo de cancelamento (ex.: usuário clica em "Cancelar"). */
  signal?: AbortSignal;
  /** Máx. de tentativas por falha transitória (5xx / rede). Default 3. */
  maxRetries?: number;
  /** Pula `validateFileForUpload` (uso avançado — validador já executado). */
  skipValidation?: boolean;
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

function computeTimeoutMs(sizeBytes: number): number {
  const perMb = 200;
  const base = 60_000;
  const mb = sizeBytes / (1024 * 1024);
  return Math.min(base + Math.round(mb * perMb), 30 * 60_000); // cap em 30 min
}

async function performXhrPut(
  url: string,
  file: File,
  headers: Record<string, string>,
  opts: {
    onProgress?: ResumableUploadOptions["onProgress"];
    signal?: AbortSignal;
    timeoutMs: number;
  },
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.timeout = opts.timeoutMs;
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);

    if (opts.onProgress) {
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) {
          const percent = Math.min(99, Math.round((ev.loaded / ev.total) * 100));
          opts.onProgress?.(percent, ev.loaded, ev.total);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        opts.onProgress?.(100, file.size, file.size);
        resolve();
      } else {
        reject(new ResumableUploadError("http_error", `Upload falhou (${xhr.status}): ${xhr.responseText}`, xhr.status));
      }
    };
    xhr.onerror = () => reject(new ResumableUploadError("network", "Falha de rede durante o upload."));
    xhr.ontimeout = () => reject(new ResumableUploadError("timeout", `Upload excedeu ${opts.timeoutMs / 1000}s.`));
    xhr.onabort = () => reject(new ResumableUploadError("aborted", "Upload cancelado."));

    if (opts.signal) {
      if (opts.signal.aborted) {
        xhr.abort();
        return;
      }
      opts.signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }

    xhr.send(file);
  });
}

/**
 * Upload resiliente com progress + retry + abort.
 *
 * Para arquivos < 5 MB usa o path direto do supabase-js (sem overhead do XHR);
 * arquivos maiores passam pelo XHR com progresso real.
 */
export async function resumableUpload(opts: ResumableUploadOptions): Promise<ResumableUploadResult> {
  const { bucket, path, file, onProgress, signal, maxRetries = 3, skipValidation } = opts;

  if (!skipValidation) {
    const v = await validateFileForUpload(file);
    if (!v.valid) throw new ResumableUploadError(v.code || "invalid", v.error || "Arquivo inválido");
  }

  // Arquivos pequenos: fast-path via supabase-js (sem progresso granular)
  const SMALL_UPLOAD_THRESHOLD = 5 * 1024 * 1024;
  if (file.size < SMALL_UPLOAD_THRESHOLD) {
    onProgress?.(0, 0, file.size);
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false, contentType: file.type || undefined });
    if (error) throw new ResumableUploadError("supabase_upload", error.message);
    onProgress?.(100, file.size, file.size);
    return { path };
  }

  // Arquivos grandes: signed upload URL + XHR PUT com progresso
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) throw new ResumableUploadError("aborted", "Upload cancelado antes do envio.");
    try {
      const { data: signed, error: signErr } = await supabase.storage
        .from(bucket)
        .createSignedUploadUrl(path);
      if (signErr || !signed) throw new ResumableUploadError("signed_url", signErr?.message || "Não foi possível preparar upload.");

      await performXhrPut(
        signed.signedUrl,
        file,
        { "Content-Type": file.type || "application/octet-stream", "x-upsert": "false" },
        { onProgress, signal, timeoutMs: computeTimeoutMs(file.size) },
      );
      return { path };
    } catch (err) {
      lastErr = err;
      const e = err as ResumableUploadError;
      // Não retenta em cancelamento explícito ou erro 4xx (exceto 408/429)
      const nonRetryable = e.code === "aborted"
        || (typeof e.status === "number" && e.status >= 400 && e.status < 500 && e.status !== 408 && e.status !== 429);
      if (nonRetryable || attempt === maxRetries) throw err;
      // Backoff exponencial: 800ms, 1.6s, 3.2s...
      const delay = 800 * Math.pow(2, attempt - 1);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr instanceof Error ? lastErr : new ResumableUploadError("unknown", "Falha desconhecida no upload.");
}
