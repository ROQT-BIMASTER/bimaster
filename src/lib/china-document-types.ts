import { FileText, Scissors, Box, TestTube, Tag, Image, Video, FileSpreadsheet, Beaker, ShieldCheck, Camera, Palette, Package, Barcode, Sticker, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { createElement } from "react";
import type { DocumentSlotConfig } from "@/components/china/ChinaDocumentSlot";

export type DocumentFlow = "china_envia" | "brasil_envia";

export const CHINA_DOCUMENT_TYPES: DocumentSlotConfig[] = [
  // === CHINA ENVIA ===
  // Rotulagem 标签
  { tipo: "volumetria", labelPt: "Volumetria (Líquido e Bruto)", labelCn: "容量（液体和总重）", icon: createElement(Beaker, { className: "h-5 w-5 text-primary" }) },
  { tipo: "formula", labelPt: "Fórmula (Composição)", labelCn: "配方（成分）", icon: createElement(FileText, { className: "h-5 w-5 text-primary" }) },
  { tipo: "doc_regulatoria", labelPt: "Documentação Regulatória", labelCn: "法规文件", icon: createElement(ShieldCheck, { className: "h-5 w-5 text-success" }) },
  // Embalagem 包装
  { tipo: "faca_primaria", labelPt: "Faca Primária", labelCn: "初级刀模", icon: createElement(Scissors, { className: "h-5 w-5 text-accent" }) },
  { tipo: "faca_display", labelPt: "Faca Display", labelCn: "展示刀模", icon: createElement(Scissors, { className: "h-5 w-5 text-warning" }) },
  { tipo: "faca_cartucho", labelPt: "Faca Cartucho", labelCn: "盒子刀模", icon: createElement(Scissors, { className: "h-5 w-5 text-success" }) },
  { tipo: "faca_tester", labelPt: "Faca Tester", labelCn: "试用装刀模", icon: createElement(TestTube, { className: "h-5 w-5 text-destructive" }) },
  { tipo: "amostra_foto", labelPt: "Amostra Embalagem (Fotos)", labelCn: "包装样品（照片）", icon: createElement(Image, { className: "h-5 w-5 text-success" }), accept: "image/*", multiple: true },
  { tipo: "amostra_video", labelPt: "Amostra Embalagem (Vídeos)", labelCn: "包装样品（视频）", icon: createElement(Video, { className: "h-5 w-5 text-warning" }), accept: "video/*" },
  { tipo: "planilha_excel", labelPt: "Planilha Excel", labelCn: "Excel表格", icon: createElement(FileSpreadsheet, { className: "h-5 w-5 text-success" }), accept: ".xlsx,.xls" },
  // Fotos da Planilha
  { tipo: "foto_confirmed_item", labelPt: "Produto Confirmado (已确认产品)", labelCn: "已确认产品照片", icon: createElement(Camera, { className: "h-5 w-5 text-primary" }), accept: "image/*", multiple: true },
  { tipo: "foto_cores_todas", labelPt: "Todas as Cores (颜色照片)", labelCn: "所有颜色照片", icon: createElement(Palette, { className: "h-5 w-5 text-accent" }), accept: "image/*", multiple: true },
  { tipo: "foto_garrafa", labelPt: "Garrafa/Frasco (瓶子)", labelCn: "瓶子照片", icon: createElement(Package, { className: "h-5 w-5 text-warning" }), accept: "image/*", multiple: true },
  { tipo: "foto_garrafa_design", labelPt: "Design da Garrafa (瓶子设计)", labelCn: "瓶子设计照片", icon: createElement(Package, { className: "h-5 w-5 text-success" }), accept: "image/*", multiple: true },
  { tipo: "foto_cores_produto", labelPt: "Cores do Produto (Colors)", labelCn: "产品颜色照片", icon: createElement(Palette, { className: "h-5 w-5 text-primary" }), accept: "image/*", multiple: true },
  { tipo: "foto_embalagem_ref", labelPt: "Embalagem (Referência)", labelCn: "包装参考照片", icon: createElement(Camera, { className: "h-5 w-5 text-accent" }), accept: "image/*", multiple: true },
  { tipo: "foto_produto_individual", labelPt: "Foto Produto Individual", labelCn: "单个产品照片", icon: createElement(Camera, { className: "h-5 w-5 text-success" }), accept: "image/*", multiple: true },
  { tipo: "foto_cores_pesos", labelPt: "Cores (Seção Pesos)", labelCn: "颜色照片（重量部分）", icon: createElement(Palette, { className: "h-5 w-5 text-warning" }), accept: "image/*", multiple: true },
  // Imagens gerais
  { tipo: "foto_rotulo", labelPt: "Foto do Rótulo", labelCn: "标签照片", icon: createElement(Palette, { className: "h-5 w-5 text-accent" }), accept: "image/*", multiple: true },
  { tipo: "foto_arte", labelPt: "Foto da Arte/Layout", labelCn: "设计/排版照片", icon: createElement(Palette, { className: "h-5 w-5 text-primary" }), accept: "image/*", multiple: true },

  // === BRASIL ENVIA ===
  { tipo: "etiqueta_fundo", labelPt: "Etiqueta de Fundo", labelCn: "底部标签", icon: createElement(Sticker, { className: "h-5 w-5 text-success" }), accept: "image/*,.pdf", multiple: true },
  { tipo: "etiqueta_tester", labelPt: "Etiqueta Tester", labelCn: "试用标签", icon: createElement(Sticker, { className: "h-5 w-5 text-accent" }), accept: "image/*,.pdf", multiple: true },
  { tipo: "etiqueta_bula", labelPt: "Etiqueta Bula", labelCn: "说明标签", icon: createElement(Sticker, { className: "h-5 w-5 text-primary" }), accept: "image/*,.pdf", multiple: true },
  { tipo: "arte_display", labelPt: "Arte Display", labelCn: "展示设计稿", icon: createElement(Palette, { className: "h-5 w-5 text-warning" }), accept: "image/*,.pdf,.ai,.psd", multiple: true },
  { tipo: "ean_unitario", labelPt: "EAN Unitário", labelCn: "单位EAN码", icon: createElement(Barcode, { className: "h-5 w-5 text-primary" }) },
  { tipo: "ean_display", labelPt: "EAN Display", labelCn: "展示EAN码", icon: createElement(Barcode, { className: "h-5 w-5 text-accent" }) },
  { tipo: "ean_caixa", labelPt: "EAN Caixa Master", labelCn: "主箱EAN码", icon: createElement(Barcode, { className: "h-5 w-5 text-success" }) },
  { tipo: "solicitacao_amostra_fotos", labelPt: "Solicitação Amostra (Fotos)", labelCn: "样品请求（照片）", icon: createElement(Camera, { className: "h-5 w-5 text-success" }), accept: "image/*", multiple: true },
  { tipo: "solicitacao_amostra_videos", labelPt: "Solicitação Amostra (Vídeos)", labelCn: "样品请求（视频）", icon: createElement(Video, { className: "h-5 w-5 text-accent" }), accept: "video/*", multiple: true },
];

export const DOCUMENT_CATEGORIES: {
  key: string;
  labelPt: string;
  labelCn: string;
  tipos: string[];
  fluxo: DocumentFlow;
}[] = [
  // ── CHINA ENVIA ──
  {
    key: "dados_oficiais",
    labelPt: "Dados Oficiais",
    labelCn: "官方数据",
    tipos: ["planilha_excel"],
    fluxo: "china_envia",
  },
  {
    key: "fotos_planilha",
    labelPt: "Fotos da Planilha (Campos com Imagem)",
    labelCn: "表格照片（图片字段）",
    tipos: ["foto_confirmed_item", "foto_cores_todas", "foto_garrafa", "foto_garrafa_design", "foto_cores_produto", "foto_embalagem_ref", "foto_produto_individual", "foto_cores_pesos"],
    fluxo: "china_envia",
  },
  {
    key: "imagens_gerais",
    labelPt: "Imagens Gerais",
    labelCn: "通用图片",
    tipos: ["foto_rotulo", "foto_arte"],
    fluxo: "china_envia",
  },
  {
    key: "rotulagem",
    labelPt: "Rotulagem",
    labelCn: "标签",
    tipos: ["volumetria", "formula", "doc_regulatoria"],
    fluxo: "china_envia",
  },
  {
    key: "embalagem",
    labelPt: "Embalagem",
    labelCn: "包装",
    tipos: ["faca_primaria", "faca_display", "faca_cartucho", "faca_tester", "amostra_foto", "amostra_video"],
    fluxo: "china_envia",
  },
  // ── BRASIL ENVIA ──
  {
    key: "etiquetas",
    labelPt: "Etiquetas",
    labelCn: "标签贴纸",
    tipos: ["etiqueta_fundo", "etiqueta_tester", "etiqueta_bula"],
    fluxo: "brasil_envia",
  },
  {
    key: "artes_brasil",
    labelPt: "Artes e Design",
    labelCn: "设计稿",
    tipos: ["arte_display"],
    fluxo: "brasil_envia",
  },
  {
    key: "codigos_ean",
    labelPt: "Códigos EAN",
    labelCn: "EAN条码",
    tipos: ["ean_unitario", "ean_display", "ean_caixa"],
    fluxo: "brasil_envia",
  },
  {
    key: "solicitacao_amostras",
    labelPt: "Solicitação de Amostras",
    labelCn: "样品请求",
    tipos: ["solicitacao_amostra_fotos", "solicitacao_amostra_videos"],
    fluxo: "brasil_envia",
  },
];

// Document types that are mandatory for approval (photo + video of primary/display)
export const MANDATORY_DOCS = ["amostra_foto", "amostra_video"];

export const CATEGORIES_CHINA_ENVIA = DOCUMENT_CATEGORIES.filter(c => c.fluxo === "china_envia");
export const CATEGORIES_BRASIL_ENVIA = DOCUMENT_CATEGORIES.filter(c => c.fluxo === "brasil_envia");

export const STATUS_LABELS: Record<string, { pt: string; cn: string; variant: "default" | "secondary" | "success" | "destructive" | "warning" }> = {
  rascunho: { pt: "Rascunho", cn: "草稿", variant: "secondary" },
  pendente: { pt: "Pendente", cn: "待审核", variant: "warning" },
  enviado: { pt: "Enviado", cn: "已发送", variant: "warning" },
  em_revisao: { pt: "Em Revisão", cn: "审核中", variant: "default" },
  aprovado: { pt: "Aprovado", cn: "已批准", variant: "success" },
  rejeitado: { pt: "Rejeitado", cn: "已拒绝", variant: "destructive" },
  contestado: { pt: "Contestado", cn: "异议", variant: "warning" },
  ciencia: { pt: "Ciência", cn: "已确认", variant: "success" },
  arte_enviada: { pt: "Arte Enviada", cn: "终稿已发送", variant: "success" },
};
