/**
 * Núcleo compartilhado de upload resiliente (módulo China e demais telas).
 *
 * Por que existe: a equipe da China opera em rede instável e com arquivos
 * grandes de fornecedor (CAD, PSD, RAR). Cada tela tinha sua própria chamada
 * de upload — algumas sem timeout, sem retry e com mensagens genéricas. Este
 * módulo concentra:
 *
 *  - timeout por tentativa (padrão 120s, adequado à latência CN→BR)
 *  - retry com backoff exponencial apenas em falhas transitórias
 *  - tradução de erro técnico para mensagem acionável (PT + 中文)
 *  - progresso opcional para a UI
 *
 * A validação local (extensão/MIME/magic bytes/tamanho) continua em
 * `@/lib/utils/file-security`; use `guardFileUpload` antes de chamar aqui.
 *
 * Memória relacionada: mem://features/china/upload-documentos-hardening
 */
import { resumableUpload } from "@/lib/upload/resumableUpload";
import { UPLOAD_MAX_LABEL } from "@/lib/upload/limits";

export type UploadErrorCode =
  | "INVALID_FILE"
  | "NO_SESSION"
  | "STORAGE_PAYLOAD_TOO_LARGE"
  | "STORAGE_INVALID_KEY"
  | "STORAGE_MIME_REJECTED"
  | "STORAGE_DENIED"
  | "STORAGE_NETWORK"
  | "STORAGE_TIMEOUT"
  | "STORAGE_UNKNOWN"
  | "DB_DENIED"
  | "DB_CONFLICT"
  | "DB_UNKNOWN";

export interface UploadFailure {
  code: UploadErrorCode;
  /** Mensagem pronta para toast (PT + 中文). */
  message: string;
}

/** Timeout por tentativa. Generoso por causa da latência China → Brasil. */
export const UPLOAD_TIMEOUT_MS = 120_000;
export const UPLOAD_MAX_RETRIES = 2; // total = 3 tentativas
const RETRY_BASE_MS = 800;

function bilingual(pt: string, zh: string): string {
  return `${pt} ${zh}`;
}

export function mapStorageError(err: unknown): UploadFailure {
  const e = err as { message?: string; statusCode?: number; status?: number; name?: string };
  const raw = String(e?.message ?? err ?? "");
  const status = e?.statusCode ?? e?.status;

  if (/invalid key/i.test(raw)) {
    return {
      code: "STORAGE_INVALID_KEY",
      message: bilingual("Nome de arquivo inválido. Renomeie e tente novamente.", "文件名无效，请重命名后重试。"),
    };
  }
  if (status === 413 || /payload too large|exceeds|maximum allowed size/i.test(raw)) {
    return {
      code: "STORAGE_PAYLOAD_TOO_LARGE",
      message: bilingual(`Arquivo excede o limite de ${UPLOAD_MAX_LABEL}.`, "文件超过大小限制。"),
    };
  }
  if (/mime type .* is not supported|invalid mime/i.test(raw)) {
    return {
      code: "STORAGE_MIME_REJECTED",
      message: bilingual(
        "Este tipo de arquivo não é aceito pelo armazenamento. Compacte em ZIP e tente novamente.",
        "存储不接受此文件类型，请压缩为 ZIP 后重试。",
      ),
    };
  }
  if (status === 401 || status === 403 || /not authorized|forbidden|denied|row-level security/i.test(raw)) {
    return {
      code: "STORAGE_DENIED",
      message: bilingual("Você não tem permissão para enviar este arquivo.", "您没有上传此文件的权限。"),
    };
  }
  if (e?.name === "AbortError" || /timeout|aborted/i.test(raw)) {
    return {
      code: "STORAGE_TIMEOUT",
      message: bilingual("O envio demorou demais. Verifique a conexão e tente novamente.", "上传超时，请检查网络后重试。"),
    };
  }
  if (/network|fetch failed|load failed|connection/i.test(raw)) {
    return {
      code: "STORAGE_NETWORK",
      message: bilingual("Falha de rede ao enviar o arquivo. Tente novamente.", "网络异常，上传失败，请重试。"),
    };
  }
  return {
    code: "STORAGE_UNKNOWN",
    message: raw || bilingual("Falha ao enviar o arquivo.", "文件上传失败。"),
  };
}

export function mapDbError(err: unknown): UploadFailure {
  const e = err as { message?: string; code?: string };
  const raw = String(e?.message ?? err ?? "");
  if (e?.code === "42501" || /permission denied|rls|policy/i.test(raw)) {
    return {
      code: "DB_DENIED",
      message: bilingual("Você não tem permissão para registrar este documento.", "您没有登记此文档的权限。"),
    };
  }
  if (e?.code === "23505" || /duplicate|unique/i.test(raw)) {
    return {
      code: "DB_CONFLICT",
      message: bilingual("Este documento já foi registrado. Atualize a página.", "该文档已登记，请刷新页面。"),
    };
  }
  return { code: "DB_UNKNOWN", message: raw || bilingual("Falha ao registrar o documento.", "文档登记失败。") };
}

export function isTransient(code: UploadErrorCode): boolean {
  return code === "STORAGE_NETWORK" || code === "STORAGE_TIMEOUT" || code === "STORAGE_UNKNOWN";
}

export async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(Object.assign(new Error(`${label} timeout`), { name: "AbortError" })),
          ms,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export interface ResilientUploadInput {
  bucket: string;
  path: string;
  file: File;
  upsert?: boolean;
  /** Progresso 0–100 (best effort; resumable reporta por chunk). */
  onProgress?: (percent: number) => void;
  timeoutMs?: number;
  maxRetries?: number;
  /** Notificação de nova tentativa, para feedback na UI. */
  onRetry?: (attempt: number, failure: UploadFailure) => void;
}

export type ResilientUploadResult =
  | { ok: true; path: string; attempts: number }
  | { ok: false; failure: UploadFailure; attempts: number };

/**
 * Envia um arquivo com timeout, retry e erros traduzidos.
 * Não valida o arquivo — chame `guardFileUpload` antes.
 */
export async function uploadResilient(input: ResilientUploadInput): Promise<ResilientUploadResult> {
  const {
    bucket,
    path,
    file,
    upsert = false,
    onProgress,
    timeoutMs = UPLOAD_TIMEOUT_MS,
    maxRetries = UPLOAD_MAX_RETRIES,
    onRetry,
  } = input;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      onProgress?.(attempt === 0 ? 1 : 5);
      const result = await withTimeout(
        resumableUpload({
          bucket,
          path,
          file,
          upsert,
          skipValidation: true,
          onProgress: onProgress ? (p: number) => onProgress(Math.max(1, Math.min(99, p))) : undefined,
        } as Parameters<typeof resumableUpload>[0]),
        timeoutMs,
        "upload",
      );
      onProgress?.(100);
      return { ok: true, path: (result as { path?: string })?.path ?? path, attempts: attempt + 1 };
    } catch (err) {
      const failure = mapStorageError(err);
      if (!isTransient(failure.code) || attempt === maxRetries) {
        return { ok: false, failure, attempts: attempt + 1 };
      }
      onRetry?.(attempt + 1, failure);
      await new Promise((r) => setTimeout(r, RETRY_BASE_MS * Math.pow(2, attempt)));
    }
  }
  return {
    ok: false,
    failure: { code: "STORAGE_UNKNOWN", message: bilingual("Falha ao enviar.", "上传失败。") },
    attempts: maxRetries + 1,
  };
}
