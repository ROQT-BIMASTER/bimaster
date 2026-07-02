/**
 * Utilitário centralizado de validação de segurança para uploads de arquivos.
 * Protege contra arquivos maliciosos com 3 camadas:
 *   1. Whitelist de extensões e MIME types
 *   2. Detecção de extensão dupla
 *   3. Validação de magic bytes (assinatura do arquivo)
 */

// ── Extensões e MIME types permitidos ──────────────────────────────────────────

const ALLOWED_EXTENSIONS = new Set([
  "pdf", "png", "jpg", "jpeg", "webp", "gif", "heic",
  "doc", "docx", "xls", "xlsx", "ppt", "pptx", "csv", "xml",
  "zip", "txt",
  "mp4", "mov", "webm",
  // Arquivos de design (equipes de criação) — limite ampliado para 1 GB
  "ai", "psd",
]);

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png", "image/jpeg", "image/webp", "image/gif", "image/heic", "image/heif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/csv", "text/plain",
  "application/xml", "text/xml",
  "application/zip", "application/x-zip-compressed",
  "video/mp4", "video/quicktime", "video/webm",
  "application/octet-stream", // alguns browsers usam para .docx/.xlsx/.pptx/.psd
  // Design (Illustrator / Photoshop)
  "application/postscript",
  "application/illustrator",
  "application/vnd.adobe.illustrator",
  "image/vnd.adobe.photoshop",
  "application/x-photoshop",
  "application/photoshop",
  "image/psd",
]);

const DANGEROUS_EXTENSIONS = new Set([
  "exe", "bat", "cmd", "sh", "ps1", "vbs", "js",
  "html", "htm", "msi", "dll", "scr", "com",
  "pif", "reg", "hta", "wsf", "cpl", "msc",
]);

// Limite unificado de upload — fonte única em `@/lib/upload/limits`.
// As constantes específicas são mantidas como aliases para compatibilidade
// com imports/telemetria existentes; todas apontam para o mesmo teto.
import { UPLOAD_MAX_BYTES, UPLOAD_MAX_LABEL } from "@/lib/upload/limits";
const MAX_FILE_SIZE_BYTES = UPLOAD_MAX_BYTES;
const MAX_VIDEO_SIZE_BYTES = UPLOAD_MAX_BYTES;
const MAX_DESIGN_FILE_SIZE_BYTES = UPLOAD_MAX_BYTES;
const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "webm"]);
const DESIGN_EXTENSIONS = new Set(["ai", "psd"]);

// ── Magic bytes (assinaturas de arquivo) ───────────────────────────────────────

interface MagicSignature {
  bytes: number[];
  offset?: number;
}

const MAGIC_SIGNATURES: Record<string, MagicSignature[]> = {
  pdf:  [{ bytes: [0x25, 0x50, 0x44, 0x46] }],              // %PDF
  png:  [{ bytes: [0x89, 0x50, 0x4E, 0x47] }],              // ‰PNG
  jpg:  [{ bytes: [0xFF, 0xD8, 0xFF] }],
  jpeg: [{ bytes: [0xFF, 0xD8, 0xFF] }],
  gif:  [{ bytes: [0x47, 0x49, 0x46, 0x38] }],              // GIF8
  zip:  [{ bytes: [0x50, 0x4B, 0x03, 0x04] }],              // PK..
  docx: [{ bytes: [0x50, 0x4B, 0x03, 0x04] }],              // ZIP-based
  xlsx: [{ bytes: [0x50, 0x4B, 0x03, 0x04] }],
  pptx: [{ bytes: [0x50, 0x4B, 0x03, 0x04] }],              // ZIP-based
  doc:  [{ bytes: [0xD0, 0xCF, 0x11, 0xE0] }],              // OLE2
  xls:  [{ bytes: [0xD0, 0xCF, 0x11, 0xE0] }],
  ppt:  [{ bytes: [0xD0, 0xCF, 0x11, 0xE0] }],              // OLE2
  xml:  [{ bytes: [0x3C, 0x3F, 0x78, 0x6D] }],              // <?xm
  webp: [{ bytes: [0x52, 0x49, 0x46, 0x46] }],              // RIFF
  mp4:  [{ bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 }],   // ftyp at offset 4
  mov:  [{ bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 }],   // ftyp at offset 4 (QuickTime)
  webm: [{ bytes: [0x1A, 0x45, 0xDF, 0xA3] }],              // EBML
  heic: [{ bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 }],   // ftyp at offset 4 (HEIF/HEIC)
  // Photoshop: sempre inicia com "8BPS"
  psd:  [{ bytes: [0x38, 0x42, 0x50, 0x53] }],
  // Illustrator moderno é um PDF (%PDF-...); legado usa PostScript (%!PS-Adobe-...)
  ai:   [
    { bytes: [0x25, 0x50, 0x44, 0x46] },                    // %PDF
    { bytes: [0x25, 0x21, 0x50, 0x53] },                    // %!PS
  ],
};

// ── Tipos de resultado ─────────────────────────────────────────────────────────

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  /** Código do erro para tratamento programático */
  code?: "EXTENSION_BLOCKED" | "EXTENSION_NOT_ALLOWED" | "DOUBLE_EXTENSION" | "MIME_REJECTED" | "SIZE_EXCEEDED" | "MAGIC_BYTES_MISMATCH";
}

// ── Funções auxiliares ─────────────────────────────────────────────────────────

function getExtension(filename: string): string {
  const parts = filename.split(".");
  return (parts.pop() || "").toLowerCase();
}

function hasDoubleExtension(filename: string): boolean {
  const parts = filename.split(".");
  if (parts.length <= 2) return false;
  // Checa se alguma extensão intermediária é perigosa
  for (let i = 1; i < parts.length - 1; i++) {
    const ext = parts[i].toLowerCase();
    if (DANGEROUS_EXTENSIONS.has(ext) || ALLOWED_EXTENSIONS.has(ext)) {
      // Ex: "report.pdf.exe" → a penúltima é "pdf" (legítima) e a última é "exe"
      const lastExt = parts[parts.length - 1].toLowerCase();
      if (DANGEROUS_EXTENSIONS.has(lastExt)) return true;
    }
  }
  return false;
}

async function readMagicBytes(file: File, length = 8): Promise<Uint8Array> {
  const slice = file.slice(0, length);
  const buffer = await slice.arrayBuffer();
  return new Uint8Array(buffer);
}

function matchesMagic(fileBytes: Uint8Array, signatures: MagicSignature[]): boolean {
  return signatures.some(sig => {
    const offset = sig.offset || 0;
    return sig.bytes.every((byte, i) => fileBytes[offset + i] === byte);
  });
}

// ── Função principal de validação ──────────────────────────────────────────────

/**
 * Valida um arquivo antes do upload.
 * Verifica extensão, MIME type, tamanho, extensão dupla e magic bytes.
 */
export async function validateFileForUpload(file: File): Promise<FileValidationResult> {
  const ext = getExtension(file.name);

  // 1. Extensão perigosa
  if (DANGEROUS_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      code: "EXTENSION_BLOCKED",
      error: `Tipo de arquivo ".${ext}" não é permitido por questões de segurança.`,
    };
  }

  // 2. Extensão não permitida
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      code: "EXTENSION_NOT_ALLOWED",
      error: `Extensão ".${ext}" não é suportada. Formatos aceitos: PDF, imagens (PNG, JPG, WEBP, GIF, HEIC), Office (DOC, DOCX, XLS, XLSX, PPT, PPTX), CSV, XML, TXT, ZIP, design (AI, PSD) e vídeos (MP4, MOV, WEBM). Limite unificado de 1 GB por arquivo.`,
    };
  }

  // 3. Extensão dupla suspeita
  if (hasDoubleExtension(file.name)) {
    return {
      valid: false,
      code: "DOUBLE_EXTENSION",
      error: `Arquivo "${file.name}" possui extensão dupla suspeita e foi bloqueado.`,
    };
  }

  // 4. MIME type (tolerante: aceita octet-stream para .docx/.xlsx/.psd/.ai)
  if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
    return {
      valid: false,
      code: "MIME_REJECTED",
      error: `Tipo MIME "${file.type}" não é permitido para ".${ext}". Verifique se o arquivo não foi renomeado a partir de outro formato.`,
    };
  }

  // 5. Tamanho — teto unificado de 1 GB para qualquer extensão suportada
  const maxSize = MAX_FILE_SIZE_BYTES;
  if (file.size > maxSize) {
    const currentMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      code: "SIZE_EXCEEDED",
      error: `Arquivo ".${ext}" tem ${currentMb} MB e excede o limite máximo de ${UPLOAD_MAX_LABEL} (${Math.round(UPLOAD_MAX_BYTES / (1024 * 1024))} MB) por arquivo.`,
    };
  }
  // Sinaliza vídeo/design apenas para consumo externo (mensagens contextualizadas).
  void VIDEO_EXTENSIONS; void DESIGN_EXTENSIONS; void MAX_VIDEO_SIZE_BYTES; void MAX_DESIGN_FILE_SIZE_BYTES;

  // 6. Magic bytes
  const signatures = MAGIC_SIGNATURES[ext];
  if (signatures && file.size > 0) {
    try {
      const bytes = await readMagicBytes(file);
      if (!matchesMagic(bytes, signatures)) {
        return {
          valid: false,
          code: "MAGIC_BYTES_MISMATCH",
          error: `O conteúdo do arquivo "${file.name}" não corresponde à extensão ".${ext}". Arquivo possivelmente corrompido ou falsificado.`,
        };
      }
    } catch {
      // Se não conseguir ler, segue (browser restriction)
    }
  }

  return { valid: true };
}

/**
 * Valida múltiplos arquivos, retorna lista de erros (vazia = tudo OK).
 */
export async function validateFilesForUpload(files: File[]): Promise<{ file: File; error: string }[]> {
  const errors: { file: File; error: string }[] = [];
  for (const file of files) {
    const result = await validateFileForUpload(file);
    if (!result.valid && result.error) {
      errors.push({ file, error: result.error });
    }
  }
  return errors;
}

// ── Toast helper ───────────────────────────────────────────────────────────────

/**
 * Traduz mensagens de erro de upload (validação client-side, trigger do banco
 * ou Storage bucket) em título + descrição amigável para toast.
 */
export function describeUploadError(message: string): { title: string; description: string } {
  const raw = message || "";
  const msg = raw.toLowerCase();

  // "database schema is out of sync" — wrapper do backend devolve esse texto
  // quando o Storage recusa por cap de bucket / MIME não listado (413/415).
  // É enganoso: não há migração ausente; o bucket é que está com teto abaixo
  // do arquivo enviado. Traduzimos para orientação real ao usuário final.
  const isBucketCap =
    msg.includes("database schema is out of sync") ||
    msg.includes("please run migrations") ||
    msg.includes("schema is out of sync");

  // HTTP 413 — Payload Too Large. Pode vir do proxy, do Storage ou do bucket.
  const is413 =
    isBucketCap ||
    msg.includes("413") ||
    msg.includes("payload too large") ||
    msg.includes("request entity too large") ||
    msg.includes("exceeded the maximum") ||
    msg.includes("file_size_limit");
  if (is413) {
    return {
      title: "Arquivo acima do limite aceito pelo servidor",
      description:
        "O envio foi recusado pelo servidor de armazenamento. O limite geral do sistema é de 1 GB por arquivo, " +
        "mas este bucket ainda está configurado com um teto menor (tipicamente 10–50 MB). " +
        "Passos sugeridos: (1) tente compactar em .zip ou dividir em partes menores; " +
        "(2) se precisar enviar arquivos deste tamanho com frequência neste módulo, avise a equipe interna " +
        "para solicitar ao suporte a elevação do limite deste bucket para 1 GB. " +
        "Sua sessão continua ativa; nenhum dado foi perdido.",
    };
  }

  if (
    (msg.includes("mime type") && msg.includes("not supported")) ||
    msg.includes("invalid_mime_type") ||
    msg.includes("415")
  ) {
    return {
      title: "Tipo de arquivo não permitido pelo bucket",
      description:
        "O servidor de armazenamento não aceitou o tipo deste arquivo. Formatos aceitos pelo sistema: " +
        "PDF, imagens, Office, CSV, XML, TXT, ZIP, design (AI/PSD) e vídeos MP4/MOV/WEBM. " +
        "Se o formato acima está correto, avise a equipe interna para liberar este MIME no bucket.",
    };
  }
  if (msg.includes("excede o limite") || msg.includes("1 gb") || msg.includes("1024 mb")) {
    return { title: "Arquivo acima do limite permitido", description: raw };
  }
  if (msg.includes("extensão") || msg.includes("extension")) {
    return { title: "Tipo de arquivo não permitido", description: raw };
  }
  if (msg.includes("aborted") || msg.includes("cancelado")) {
    return { title: "Upload cancelado", description: "O envio foi interrompido antes de concluir." };
  }
  if (msg.includes("network") || msg.includes("rede")) {
    return {
      title: "Falha de conexão durante o upload",
      description: "Verifique sua internet e tente novamente. Arquivos grandes retomam automaticamente do último trecho enviado.",
    };
  }
  return { title: "Falha ao enviar arquivo", description: raw };
}

