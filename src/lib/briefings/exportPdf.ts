// src/lib/briefings/exportPdf.ts
import jsPDF from "jspdf";
import type { Briefing, TemplateSection } from "@/hooks/useBriefingChat";
import type { BriefingExportConfig } from "./exportTypes";

interface AprovacaoEtapa {
  ordem: number;
  nome: string;
  responsaveis: string[];
  status: string;
  decidido_em?: string | null;
  parecer?: string | null;
}

export interface BriefingPdfData {
  briefing: Briefing;
  sections: TemplateSection[];
  config: BriefingExportConfig;
  projetoNome?: string | null;
  aprovacoes?: AprovacaoEtapa[];
  resumo?: { resumo: string; mensagem_chave: string; riscos: string[] } | null;
  autorNome?: string | null;
}

const TZ_FMT = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  aprovado: "Aprovado",
  reprovado: "Reprovado",
  cancelado: "Cancelado",
};

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(
    h.length === 3
      ? h.split("").map((c) => c + c).join("")
      : h,
    16,
  );
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

export async function exportBriefingPdf(data: BriefingPdfData): Promise<Blob> {
  const { config } = data;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const MARGIN = 48;
  const [pr, pg, pb] = hexToRgb(config.corPrimaria || "#0F172A");

  const fontFamily =
    config.tipografia === "serif"
      ? "times"
      : config.tipografia === "mono"
        ? "courier"
        : "helvetica";

  let y = MARGIN;

  const setColor = (r: number, g: number, b: number) => doc.setTextColor(r, g, b);

  const addPageIfNeeded = (need: number) => {
    if (y + need > H - MARGIN - 24) {
      drawFooter();
      doc.addPage();
      y = MARGIN;
      drawWatermark();
    }
  };

  const drawWatermark = () => {
    if (!config.marcaDagua) return;
    doc.saveGraphicsState();
    // @ts-ignore - GState exists in jspdf
    doc.setGState(new (doc as any).GState({ opacity: 0.06 }));
    doc.setFont(fontFamily, "bold");
    doc.setFontSize(96);
    setColor(pr, pg, pb);
    doc.text("CONFIDENCIAL", W / 2, H / 2, { angle: 30, align: "center" });
    doc.restoreGraphicsState();
    setColor(15, 23, 42);
  };

  let pageNumber = 1;
  const drawFooter = () => {
    if (!config.paginacao && !data.autorNome) return;
    doc.setFont(fontFamily, "normal");
    doc.setFontSize(8);
    setColor(120, 120, 120);
    const left = [data.autorNome, TZ_FMT.format(new Date())].filter(Boolean).join(" · ");
    if (left) doc.text(left, MARGIN, H - 24);
    if (config.paginacao) {
      doc.text(`Página ${pageNumber}`, W - MARGIN, H - 24, { align: "right" });
    }
    pageNumber++;
  };

  // ===== Capa =====
  drawWatermark();
  doc.setFillColor(pr, pg, pb);
  doc.rect(0, 0, W, 6, "F");

  if (config.logoDataUrl) {
    try {
      doc.addImage(config.logoDataUrl, "PNG", MARGIN, y, 110, 40, undefined, "FAST");
    } catch {}
    y += 56;
  } else {
    y += 12;
  }

  setColor(pr, pg, pb);
  doc.setFont(fontFamily, "bold");
  doc.setFontSize(11);
  doc.text("BRIEFING", MARGIN, y);
  y += 18;

  setColor(15, 23, 42);
  doc.setFontSize(26);
  const titulo = config.titulo || data.briefing.titulo;
  const tituloLines = doc.splitTextToSize(titulo, W - MARGIN * 2);
  doc.text(tituloLines, MARGIN, y);
  y += tituloLines.length * 28;

  if (config.subtitulo) {
    setColor(80, 80, 80);
    doc.setFont(fontFamily, "normal");
    doc.setFontSize(12);
    const subLines = doc.splitTextToSize(config.subtitulo, W - MARGIN * 2);
    doc.text(subLines, MARGIN, y);
    y += subLines.length * 16;
  }

  y += 12;
  setColor(120, 120, 120);
  doc.setFont(fontFamily, "normal");
  doc.setFontSize(10);
  const metaLine = [
    `Tipo: ${data.briefing.tipo}`,
    config.incluir.projeto && data.projetoNome ? `Projeto: ${data.projetoNome}` : null,
    `Completude: ${data.briefing.completude}%`,
    `Gerado em: ${TZ_FMT.format(new Date())}`,
  ]
    .filter(Boolean)
    .join("  ·  ");
  doc.text(metaLine, MARGIN, y);
  y += 24;

  // ===== Resumo executivo =====
  if (config.incluir.resumoExecutivo && data.resumo?.resumo) {
    addPageIfNeeded(80);
    setColor(pr, pg, pb);
    doc.setFont(fontFamily, "bold");
    doc.setFontSize(12);
    doc.text("Resumo executivo", MARGIN, y);
    y += 14;
    setColor(40, 40, 40);
    doc.setFont(fontFamily, "normal");
    doc.setFontSize(11);
    const lines = doc.splitTextToSize(data.resumo.resumo, W - MARGIN * 2);
    addPageIfNeeded(lines.length * 14);
    doc.text(lines, MARGIN, y);
    y += lines.length * 14 + 16;
  }

  // ===== Mensagem-chave =====
  if (config.incluir.mensagemChave && data.resumo?.mensagem_chave) {
    addPageIfNeeded(70);
    doc.setFillColor(pr, pg, pb);
    doc.roundedRect(MARGIN, y, W - MARGIN * 2, 56, 6, 6, "F");
    setColor(255, 255, 255);
    doc.setFont(fontFamily, "bold");
    doc.setFontSize(9);
    doc.text("MENSAGEM-CHAVE", MARGIN + 16, y + 20);
    doc.setFontSize(14);
    const mc = doc.splitTextToSize(data.resumo.mensagem_chave, W - MARGIN * 2 - 32);
    doc.text(mc, MARGIN + 16, y + 38);
    y += 76;
  }

  // ===== Riscos =====
  if (config.incluir.resumoExecutivo && data.resumo?.riscos?.length) {
    addPageIfNeeded(40);
    setColor(pr, pg, pb);
    doc.setFont(fontFamily, "bold");
    doc.setFontSize(11);
    doc.text("Riscos e dependências", MARGIN, y);
    y += 14;
    setColor(40, 40, 40);
    doc.setFont(fontFamily, "normal");
    doc.setFontSize(10);
    for (const r of data.resumo.riscos) {
      const lines = doc.splitTextToSize(`• ${r}`, W - MARGIN * 2 - 12);
      addPageIfNeeded(lines.length * 12 + 4);
      doc.text(lines, MARGIN + 8, y);
      y += lines.length * 12 + 4;
    }
    y += 8;
  }

  // ===== Campos do canvas =====
  if (config.incluir.camposCanvas) {
    addPageIfNeeded(40);
    setColor(pr, pg, pb);
    doc.setFont(fontFamily, "bold");
    doc.setFontSize(12);
    doc.text("Conteúdo do briefing", MARGIN, y);
    y += 18;

    for (const sec of data.sections) {
      const val = (data.briefing.payload?.[sec.key] ?? "").trim();
      if (!val && config.nivel === "executivo") continue;
      addPageIfNeeded(40);

      setColor(pr, pg, pb);
      doc.setFont(fontFamily, "bold");
      doc.setFontSize(10);
      doc.text(`${sec.label}${sec.required ? " *" : ""}`, MARGIN, y);
      y += 12;

      setColor(40, 40, 40);
      doc.setFont(fontFamily, "normal");
      doc.setFontSize(10.5);
      const lines = doc.splitTextToSize(val || "—", W - MARGIN * 2);
      addPageIfNeeded(lines.length * 13 + 8);
      doc.text(lines, MARGIN, y);
      y += lines.length * 13 + 14;
    }
  }

  // ===== Aprovações =====
  if (config.incluir.aprovacoes && data.aprovacoes?.length) {
    addPageIfNeeded(60);
    setColor(pr, pg, pb);
    doc.setFont(fontFamily, "bold");
    doc.setFontSize(12);
    doc.text("Fluxo de aprovações", MARGIN, y);
    y += 16;

    for (const et of data.aprovacoes) {
      addPageIfNeeded(56);
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.5);
      doc.line(MARGIN, y, W - MARGIN, y);
      y += 10;

      setColor(15, 23, 42);
      doc.setFont(fontFamily, "bold");
      doc.setFontSize(10.5);
      doc.text(`${et.ordem}. ${et.nome}`, MARGIN, y);

      const statusLabel = STATUS_LABEL[et.status] ?? et.status;
      setColor(pr, pg, pb);
      doc.setFontSize(9);
      doc.text(statusLabel.toUpperCase(), W - MARGIN, y, { align: "right" });

      y += 12;
      setColor(80, 80, 80);
      doc.setFont(fontFamily, "normal");
      doc.setFontSize(9.5);
      const respText = et.responsaveis.length
        ? `Responsáveis: ${et.responsaveis.join(", ")}`
        : "Sem responsáveis definidos";
      const respLines = doc.splitTextToSize(respText, W - MARGIN * 2);
      doc.text(respLines, MARGIN, y);
      y += respLines.length * 11;

      if (et.decidido_em) {
        doc.text(`Decidido em ${TZ_FMT.format(new Date(et.decidido_em))}`, MARGIN, y);
        y += 11;
      }
      if (et.parecer) {
        const par = doc.splitTextToSize(`Parecer: ${et.parecer}`, W - MARGIN * 2);
        addPageIfNeeded(par.length * 11);
        doc.text(par, MARGIN, y);
        y += par.length * 11;
      }
      y += 8;
    }
  }

  drawFooter();
  return doc.output("blob");
}
