/**
 * Utilitário centralizado de validação de segurança para uploads de arquivos.
 * Protege contra arquivos maliciosos com 3 camadas:
 *   1. Whitelist de extensões e MIME types
 *   2. Detecção de extensão dupla
 *   3. Validação de magic bytes (assinatura do arquivo)
 */

// ── Extensões e MIME types permitidos ──────────────────────────────────────────

const ALLOWED_EXTENSIONS = new Set([
  "pdf", "png", "jpg", "jpeg", "webp", "gif",
  "doc", "docx", "xls", "xlsx", "csv", "xml",
  "zip", "txt",
]);

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png", "image/jpeg", "image/webp", "image/gif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv", "text/plain",
  "application/xml", "text/xml",
  "application/zip", "application/x-zip-compressed",
  "application/octet-stream", // alguns browsers usam para .docx/.xlsx
]);

const DANGEROUS_EXTENSIONS = new Set([
  "exe", "bat", "cmd", "sh", "ps1", "vbs", "js",
  "html", "htm", "msi", "dll", "scr", "com",
  "pif", "reg", "hta", "wsf", "cpl", "msc",
]);

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

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
  doc:  [{ bytes: [0xD0, 0xCF, 0x11, 0xE0] }],              // OLE2
  xls:  [{ bytes: [0xD0, 0xCF, 0x11, 0xE0] }],
  xml:  [{ bytes: [0x3C, 0x3F, 0x78, 0x6D] }],              // <?xm
  webp: [{ bytes: [0x52, 0x49, 0x46, 0x46] }],              // RIFF
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
      error: `Extensão ".${ext}" não é suportada. Use: PDF, imagens, documentos Office, CSV, XML, ZIP ou TXT.`,
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

  // 4. MIME type (tolerante: aceita octet-stream para .docx/.xlsx)
  if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
    return {
      valid: false,
      code: "MIME_REJECTED",
      error: `Tipo MIME "${file.type}" não é permitido.`,
    };
  }

  // 5. Tamanho
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      code: "SIZE_EXCEEDED",
      error: `Arquivo excede o limite de 20 MB (${(file.size / (1024 * 1024)).toFixed(1)} MB).`,
    };
  }

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
