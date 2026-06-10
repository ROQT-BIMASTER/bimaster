/**
 * Classifica um arquivo em uma categoria visual usando MIME quando disponível
 * e caindo para a extensão do nome quando o MIME está nulo ou genérico
 * (ex.: uploads antigos, paste de imagem sem MIME, importações do Asana,
 * downloads do storage sem Content-Type).
 */
export type FileKind = "image" | "pdf" | "video" | "audio" | "other";

// Imagens (raster + vetor + formatos modernos / câmera)
const IMG_EXT = new Set([
  "png", "jpg", "jpeg", "jfif", "pjpeg", "pjp",
  "gif", "webp", "avif", "apng",
  "svg", "svgz",
  "bmp", "dib", "ico", "cur",
  "tif", "tiff",
  "heic", "heif", "heics", "heifs",
  "jp2", "jpx", "jxl",
]);

const PDF_EXT = new Set(["pdf"]);

// Vídeos (web + containers comuns + câmera/celular)
const VIDEO_EXT = new Set([
  "mp4", "m4v", "mpv",
  "webm",
  "mov", "qt",
  "mkv",
  "avi",
  "wmv", "asf",
  "flv", "f4v",
  "ogv", "ogm",
  "3gp", "3g2",
  "mpg", "mpeg", "mpe", "m2v", "ts", "mts", "m2ts",
]);

// Áudios (web + voz + alta fidelidade)
const AUDIO_EXT = new Set([
  "mp3",
  "wav", "wave",
  "ogg", "oga",
  "m4a", "m4b",
  "aac",
  "flac",
  "opus",
  "wma",
  "amr", "awb",
  "aiff", "aif", "aifc",
  "mid", "midi",
  "weba",
  "caf",
]);

/** Retorna a extensão minúscula (sem ponto) ou string vazia. */
export function getFileExtension(nome: string | null | undefined): string {
  if (!nome) return "";
  const clean = nome.split("?")[0].split("#")[0];
  const dot = clean.lastIndexOf(".");
  if (dot < 0 || dot === clean.length - 1) return "";
  return clean.slice(dot + 1).toLowerCase();
}

/**
 * Rótulo curto da extensão para mostrar no fallback quando o tipo é
 * desconhecido (ex.: "ZIP", "DOCX", "Arquivo").
 */
export function getFileExtensionLabel(nome: string | null | undefined): string {
  const ext = getFileExtension(nome);
  return ext ? ext.toUpperCase() : "Arquivo";
}

export function detectFileKind(nome: string | null | undefined, mime: string | null | undefined): FileKind {
  if (mime) {
    const m = mime.toLowerCase();
    if (m.startsWith("image/")) return "image";
    if (m.startsWith("video/")) return "video";
    if (m.startsWith("audio/")) return "audio";
    if (m.includes("pdf")) return "pdf";
  }
  const ext = getFileExtension(nome);
  if (!ext) return "other";
  if (IMG_EXT.has(ext)) return "image";
  if (PDF_EXT.has(ext)) return "pdf";
  if (VIDEO_EXT.has(ext)) return "video";
  if (AUDIO_EXT.has(ext)) return "audio";
  return "other";
}
