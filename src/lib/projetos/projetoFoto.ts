export const PROJETO_FOTO_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

const ALLOWED_EXTS = new Set(["jpg", "jpeg", "png", "webp"]);
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

const MAGIC: Record<string, number[][]> = {
  jpg: [[0xff, 0xd8, 0xff]],
  jpeg: [[0xff, 0xd8, 0xff]],
  png: [[0x89, 0x50, 0x4e, 0x47]],
  webp: [[0x52, 0x49, 0x46, 0x46]],
};

export interface ProjetoFotoValidation {
  valid: boolean;
  error?: string;
  ext?: string;
}

export function projetoFotoExtension(fileName: string): string {
  return (fileName.split(".").pop() || "").toLowerCase();
}

/**
 * Valida a foto do projeto: extensão, MIME, tamanho e magic bytes.
 */
export async function validateProjetoFoto(file: File): Promise<ProjetoFotoValidation> {
  const ext = projetoFotoExtension(file.name);

  if (!ALLOWED_EXTS.has(ext)) {
    return { valid: false, error: "Formato não suportado. Use JPG, PNG ou WEBP." };
  }
  if (file.type && !ALLOWED_MIME.has(file.type)) {
    return { valid: false, error: "Formato não suportado. Use JPG, PNG ou WEBP." };
  }
  if (file.size > PROJETO_FOTO_MAX_BYTES) {
    return { valid: false, error: "A imagem excede o limite de 5 MB." };
  }

  const signatures = MAGIC[ext];
  if (signatures && file.size > 0) {
    try {
      const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
      const ok = signatures.some((sig) => sig.every((b, i) => bytes[i] === b));
      if (!ok) {
        return { valid: false, error: "O conteúdo do arquivo não corresponde a uma imagem válida." };
      }
    } catch {
      /* ambiente sem suporte a leitura: segue */
    }
  }

  return { valid: true, ext: ext === "jpeg" ? "jpg" : ext };
}
