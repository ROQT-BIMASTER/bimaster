import { FileText, Scissors, Box, TestTube, Tag, Image, Video, FileSpreadsheet } from "lucide-react";
import { createElement } from "react";
import type { DocumentSlotConfig } from "@/components/china/ChinaDocumentSlot";

export const CHINA_DOCUMENT_TYPES: DocumentSlotConfig[] = [
  { tipo: "formula", labelPt: "Fórmula (Composição)", labelCn: "配方（成分）", icon: createElement(FileText, { className: "h-5 w-5 text-primary" }) },
  { tipo: "faca_primaria", labelPt: "Faca Primária", labelCn: "初级刀模", icon: createElement(Scissors, { className: "h-5 w-5 text-accent" }) },
  { tipo: "faca_display", labelPt: "Faca Display", labelCn: "展示刀模", icon: createElement(Scissors, { className: "h-5 w-5 text-warning" }) },
  { tipo: "faca_cartucho", labelPt: "Faca Cartucho", labelCn: "盒子刀模", icon: createElement(Scissors, { className: "h-5 w-5 text-success" }) },
  { tipo: "faca_tester", labelPt: "Faca Tester", labelCn: "试用装刀模", icon: createElement(TestTube, { className: "h-5 w-5 text-destructive" }) },
  { tipo: "faca_etiqueta_fundo", labelPt: "Faca Etiqueta de Fundo", labelCn: "底部标签刀模", icon: createElement(Tag, { className: "h-5 w-5 text-muted-foreground" }) },
  { tipo: "faca_etiqueta_bula", labelPt: "Faca Etiqueta Bula", labelCn: "说明标签刀模", icon: createElement(Tag, { className: "h-5 w-5 text-primary" }) },
  { tipo: "faca_etiqueta_tester", labelPt: "Faca Etiqueta Tester", labelCn: "试用标签刀模", icon: createElement(Tag, { className: "h-5 w-5 text-accent" }) },
  { tipo: "amostra_foto", labelPt: "Amostra Embalagem (Fotos)", labelCn: "包装样品（照片）", icon: createElement(Image, { className: "h-5 w-5 text-success" }), accept: "image/*", multiple: true },
  { tipo: "amostra_video", labelPt: "Amostra Embalagem (Vídeos)", labelCn: "包装样品（视频）", icon: createElement(Video, { className: "h-5 w-5 text-warning" }), accept: "video/*" },
  { tipo: "planilha_excel", labelPt: "Planilha Excel", labelCn: "Excel表格", icon: createElement(FileSpreadsheet, { className: "h-5 w-5 text-success" }), accept: ".xlsx,.xls" },
];

export const STATUS_LABELS: Record<string, { pt: string; cn: string; variant: "default" | "secondary" | "success" | "destructive" | "warning" }> = {
  rascunho: { pt: "Rascunho", cn: "草稿", variant: "secondary" },
  enviado: { pt: "Enviado", cn: "已发送", variant: "warning" },
  em_revisao: { pt: "Em Revisão", cn: "审核中", variant: "default" },
  aprovado: { pt: "Aprovado", cn: "已批准", variant: "success" },
  rejeitado: { pt: "Rejeitado", cn: "已拒绝", variant: "destructive" },
};
