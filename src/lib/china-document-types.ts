import { FileText, Scissors, Box, TestTube, Tag, Image, Video, FileSpreadsheet, Beaker, ShieldCheck, Camera, Palette, Package } from "lucide-react";
import { createElement } from "react";
import type { DocumentSlotConfig } from "@/components/china/ChinaDocumentSlot";

export const CHINA_DOCUMENT_TYPES: DocumentSlotConfig[] = [
  // Rotulagem 标签
  { tipo: "volumetria", labelPt: "Volumetria (Líquido e Bruto)", labelCn: "容量（液体和总重）", icon: createElement(Beaker, { className: "h-5 w-5 text-primary" }) },
  { tipo: "formula", labelPt: "Fórmula (Composição)", labelCn: "配方（成分）", icon: createElement(FileText, { className: "h-5 w-5 text-primary" }) },
  { tipo: "doc_regulatoria", labelPt: "Documentação Regulatória", labelCn: "法规文件", icon: createElement(ShieldCheck, { className: "h-5 w-5 text-success" }) },
  // Embalagem 包装
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
  // Fotos da Planilha (campos com imagem da planilha China) 表格照片
  { tipo: "foto_confirmed_item", labelPt: "Produto Confirmado (已确认产品)", labelCn: "已确认产品照片", icon: createElement(Camera, { className: "h-5 w-5 text-primary" }), accept: "image/*", multiple: true },
  { tipo: "foto_cores_todas", labelPt: "Todas as Cores (颜色照片)", labelCn: "所有颜色照片", icon: createElement(Palette, { className: "h-5 w-5 text-accent" }), accept: "image/*", multiple: true },
  { tipo: "foto_garrafa", labelPt: "Garrafa/Frasco (瓶子)", labelCn: "瓶子照片", icon: createElement(Package, { className: "h-5 w-5 text-warning" }), accept: "image/*", multiple: true },
  { tipo: "foto_garrafa_design", labelPt: "Design da Garrafa (瓶子设计)", labelCn: "瓶子设计照片", icon: createElement(Package, { className: "h-5 w-5 text-success" }), accept: "image/*", multiple: true },
  { tipo: "foto_cores_produto", labelPt: "Cores do Produto (Colors)", labelCn: "产品颜色照片", icon: createElement(Palette, { className: "h-5 w-5 text-primary" }), accept: "image/*", multiple: true },
  { tipo: "foto_embalagem_ref", labelPt: "Embalagem (Referência)", labelCn: "包装参考照片", icon: createElement(Camera, { className: "h-5 w-5 text-accent" }), accept: "image/*", multiple: true },
  { tipo: "foto_produto_individual", labelPt: "Foto Produto Individual", labelCn: "单个产品照片", icon: createElement(Camera, { className: "h-5 w-5 text-success" }), accept: "image/*", multiple: true },
  { tipo: "foto_cores_pesos", labelPt: "Cores (Seção Pesos)", labelCn: "颜色照片（重量部分）", icon: createElement(Palette, { className: "h-5 w-5 text-warning" }), accept: "image/*", multiple: true },
  // Imagens gerais 通用图片
  { tipo: "foto_rotulo", labelPt: "Foto do Rótulo", labelCn: "标签照片", icon: createElement(Palette, { className: "h-5 w-5 text-accent" }), accept: "image/*", multiple: true },
  { tipo: "foto_arte", labelPt: "Foto da Arte/Layout", labelCn: "设计/排版照片", icon: createElement(Palette, { className: "h-5 w-5 text-primary" }), accept: "image/*", multiple: true },
];

export const DOCUMENT_CATEGORIES = [
  {
    key: "dados_oficiais",
    labelPt: "Dados Oficiais",
    labelCn: "官方数据",
    tipos: ["planilha_excel"],
  },
  {
    key: "fotos_planilha",
    labelPt: "Fotos da Planilha (Campos com Imagem)",
    labelCn: "表格照片（图片字段）",
    tipos: ["foto_confirmed_item", "foto_cores_todas", "foto_garrafa", "foto_garrafa_design", "foto_cores_produto", "foto_embalagem_ref", "foto_produto_individual", "foto_cores_pesos"],
  },
  {
    key: "imagens_gerais",
    labelPt: "Imagens Gerais",
    labelCn: "通用图片",
    tipos: ["foto_rotulo", "foto_arte"],
  },
  {
    key: "rotulagem",
    labelPt: "Rotulagem",
    labelCn: "标签",
    tipos: ["volumetria", "formula", "doc_regulatoria"],
  },
  {
    key: "embalagem",
    labelPt: "Embalagem",
    labelCn: "包装",
    tipos: ["faca_primaria", "faca_display", "faca_cartucho", "faca_tester", "faca_etiqueta_fundo", "faca_etiqueta_bula", "faca_etiqueta_tester", "amostra_foto", "amostra_video"],
  },
];

// Document types that are mandatory for approval (photo + video of primary/display)
export const MANDATORY_DOCS = ["amostra_foto", "amostra_video"];

export const STATUS_LABELS: Record<string, { pt: string; cn: string; variant: "default" | "secondary" | "success" | "destructive" | "warning" }> = {
  rascunho: { pt: "Rascunho", cn: "草稿", variant: "secondary" },
  enviado: { pt: "Enviado", cn: "已发送", variant: "warning" },
  em_revisao: { pt: "Em Revisão", cn: "审核中", variant: "default" },
  aprovado: { pt: "Aprovado", cn: "已批准", variant: "success" },
  rejeitado: { pt: "Rejeitado", cn: "已拒绝", variant: "destructive" },
  arte_enviada: { pt: "Arte Enviada", cn: "终稿已发送", variant: "success" },
};
