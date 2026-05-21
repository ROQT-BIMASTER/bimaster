// src/lib/briefings/exportTypes.ts
export type BriefingExportFormato = "pdf" | "xlsx";
export type BriefingExportIdioma = "pt" | "en" | "zh";
export type BriefingExportNivel = "executivo" | "completo" | "tecnico";

export interface BriefingExportConfig {
  titulo: string;
  subtitulo: string;
  corPrimaria: string; // #RRGGBB
  tipografia: "sans" | "serif" | "mono";
  logoDataUrl?: string | null;
  marcaDagua: boolean;
  paginacao: boolean;
  idioma: BriefingExportIdioma;
  nivel: BriefingExportNivel;
  incluir: {
    resumoExecutivo: boolean;
    camposCanvas: boolean;
    mensagemChave: boolean;
    aprovacoes: boolean;
    projeto: boolean;
  };
}

export const DEFAULT_EXPORT_CONFIG: BriefingExportConfig = {
  titulo: "",
  subtitulo: "",
  corPrimaria: "#0F172A",
  tipografia: "sans",
  logoDataUrl: null,
  marcaDagua: false,
  paginacao: true,
  idioma: "pt",
  nivel: "executivo",
  incluir: {
    resumoExecutivo: true,
    camposCanvas: true,
    mensagemChave: true,
    aprovacoes: true,
    projeto: true,
  },
};
