/**
 * Classifica um arquivo em uma categoria visual usando MIME quando disponível
 * e caindo para a extensão do nome quando o MIME está nulo ou genérico
 * (ex.: uploads antigos, paste de imagem sem MIME, importações do Asana).
 */
export type FileKind = "image" | "pdf" | "video" | "audio" | "other";

const IMG_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp", "avif", "svg", "bmp", "heic", "heif"]);
const PDF_EXT = new Set(["pdf"]);
const VIDEO_EXT = new Set(["mp4", "webm", "mov", "m4v", "mkv", "avi"]);
const AUDIO_EXT = new Set(["mp3", "wav", "ogg", "m4a", "aac", "flac", "opus"]);

export function detectFileKind(nome: string | null | undefined, mime: string | null | undefined): FileKind {
  if (mime) {
    if (mime.startsWith("image/")) return "image";
    if (mime.startsWith("video/")) return "video";
    if (mime.startsWith("audio/")) return "audio";
    if (mime.includes("pdf")) return "pdf";
  }
  const ext = (nome ?? "").split(".").pop()?.toLowerCase() ?? "";
  if (IMG_EXT.has(ext)) return "image";
  if (PDF_EXT.has(ext)) return "pdf";
  if (VIDEO_EXT.has(ext)) return "video";
  if (AUDIO_EXT.has(ext)) return "audio";
  return "other";
}
