/**
 * Normalização padronizada de caminhos para o bucket `fabrica-produto-fotos`.
 *
 * Regras:
 * - Sempre `<produtoId-ou-temp>/<timestamp>-<slug>.<ext>` (sem barra inicial)
 * - Extensão em minúsculas, restrita a jpg/jpeg/png/webp (jpeg → jpg)
 * - Nome de arquivo slugificado (ASCII), sem espaços, sem `..`, sem `/`
 * - `produtoId` validado como UUID; caso inválido cai em `temp`
 * - Tamanho do nome final limitado a 80 caracteres
 */
export const FABRICA_FOTOS_BUCKET = "fabrica-produto-fotos";

const ALLOWED_EXT = new Set(["jpg", "jpeg", "png", "webp"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "foto";
}

export function normalizeExt(ext: string | undefined | null): string {
  const clean = (ext || "").toLowerCase().replace(/^\.+/, "").trim();
  if (clean === "jpeg") return "jpg";
  if (ALLOWED_EXT.has(clean)) return clean;
  return "jpg";
}

export interface BuildPhotoPathInput {
  produtoId?: string | null;
  fileName: string;
  now?: number;
}

export function buildFabricaPhotoPath({ produtoId, fileName, now }: BuildPhotoPathInput): string {
  const safeFolder = produtoId && UUID_RE.test(produtoId) ? produtoId : "temp";
  const dotIdx = fileName.lastIndexOf(".");
  const rawExt = dotIdx >= 0 ? fileName.slice(dotIdx + 1) : "";
  const baseRaw = dotIdx >= 0 ? fileName.slice(0, dotIdx) : fileName;
  const ext = normalizeExt(rawExt);
  const base = slugify(baseRaw);
  const ts = now ?? Date.now();
  const path = `${safeFolder}/${ts}-${base}.${ext}`;
  return path.replace(/^\/+/, "").replace(/\/{2,}/g, "/");
}

/** Extrai o path interno (sem `/`) a partir de URL pública/assinada antiga. */
export function extractPathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/`;
  const idx = url.indexOf(marker);
  if (idx < 0) return null;
  // pula `public/<bucket>/` ou `sign/<bucket>/`
  const after = url.slice(idx + marker.length);
  const parts = after.split("/");
  // formato: ["public"|"sign", bucket, ...path]
  if (parts.length < 3) return null;
  if (parts[1] !== FABRICA_FOTOS_BUCKET) return null;
  const pathPart = parts.slice(2).join("/").split("?")[0];
  return pathPart.replace(/^\/+/, "");
}
