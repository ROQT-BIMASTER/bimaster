/**
 * Ícone visual por extensão de arquivo.
 *
 * Usado nos previews de anexos onde o sistema não consegue renderizar
 * o conteúdo (ex.: .ai, .psd, .zip). Mantém a listagem visual consistente
 * exibindo apenas ícone + metadata (nome, tamanho, data, usuário).
 */
import { FileIcon, FileText, FileImage, FileArchive, FileVideo, FileSpreadsheet, Presentation } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

export interface FileIconMeta {
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Cor em token semântico HSL (via className) ou hexadecimal para logotipos de marca (AI/PSD). */
  className: string;
  label: string;
}

const MAP: Record<string, FileIconMeta> = {
  pdf:  { Icon: FileText,        className: "text-destructive",         label: "PDF" },
  doc:  { Icon: FileText,        className: "text-blue-600",            label: "Word" },
  docx: { Icon: FileText,        className: "text-blue-600",            label: "Word" },
  xls:  { Icon: FileSpreadsheet, className: "text-emerald-600",         label: "Excel" },
  xlsx: { Icon: FileSpreadsheet, className: "text-emerald-600",         label: "Excel" },
  csv:  { Icon: FileSpreadsheet, className: "text-emerald-600",         label: "CSV" },
  ppt:  { Icon: Presentation,    className: "text-orange-600",          label: "PowerPoint" },
  pptx: { Icon: Presentation,    className: "text-orange-600",          label: "PowerPoint" },
  txt:  { Icon: FileText,        className: "text-muted-foreground",    label: "Texto" },
  xml:  { Icon: FileText,        className: "text-muted-foreground",    label: "XML" },
  zip:  { Icon: FileArchive,     className: "text-amber-600",           label: "ZIP" },
  png:  { Icon: FileImage,       className: "text-indigo-500",          label: "Imagem" },
  jpg:  { Icon: FileImage,       className: "text-indigo-500",          label: "Imagem" },
  jpeg: { Icon: FileImage,       className: "text-indigo-500",          label: "Imagem" },
  webp: { Icon: FileImage,       className: "text-indigo-500",          label: "Imagem" },
  gif:  { Icon: FileImage,       className: "text-indigo-500",          label: "Imagem" },
  heic: { Icon: FileImage,       className: "text-indigo-500",          label: "Imagem" },
  mp4:  { Icon: FileVideo,       className: "text-purple-600",          label: "Vídeo" },
  mov:  { Icon: FileVideo,       className: "text-purple-600",          label: "Vídeo" },
  webm: { Icon: FileVideo,       className: "text-purple-600",          label: "Vídeo" },
  // Design — arquivos que não têm preview renderizável no navegador
  ai:   { Icon: FileText,        className: "text-orange-500",          label: "Illustrator" },
  psd:  { Icon: FileImage,       className: "text-sky-500",             label: "Photoshop" },
};

export function getFileIcon(filename: string): FileIconMeta {
  const ext = (filename.split(".").pop() || "").toLowerCase();
  return MAP[ext] || { Icon: FileIcon, className: "text-muted-foreground", label: "Arquivo" };
}

export function isPreviewableInBrowser(filename: string): boolean {
  const ext = (filename.split(".").pop() || "").toLowerCase();
  return ["png", "jpg", "jpeg", "webp", "gif", "pdf", "mp4", "mov", "webm", "txt", "csv"].includes(ext);
}
