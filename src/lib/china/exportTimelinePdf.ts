/**
 * exportTimelinePdf
 * --------------------------------------------------
 * Gera um PDF profissional contendo:
 *   1. Cabeçalho com identificação da submissão
 *   2. Resumo da jornada (etapas 1–10) com status
 *   3. Histórico de eventos cronológico (filtrado)
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { kindConfig } from "@/lib/china/timeline/kinds";
import type { ChinaTimelineEvent } from "@/lib/china/timeline/types";

export interface JourneyStageRow {
  numero: number;
  titulo: string;
  status: "done" | "pending" | "atrasado" | "neutral";
  detalhe: string;
}

const STATUS_LABEL: Record<JourneyStageRow["status"], string> = {
  done: "Concluído",
  pending: "Em andamento",
  atrasado: "Atrasado",
  neutral: "Aguardando",
};

const STATUS_COLOR: Record<JourneyStageRow["status"], [number, number, number]> = {
  done: [16, 185, 129],
  pending: [245, 158, 11],
  atrasado: [225, 29, 72],
  neutral: [148, 163, 184],
};

interface ExportInput {
  produtoCodigo: string;
  produtoNome: string;
  numeroOrdem?: string | null;
  submissaoStatus?: string | null;
  criadaEm?: string | null;
  stages: JourneyStageRow[];
  eventos: ChinaTimelineEvent[];
  filtroDescricao?: string;
}

export function exportTimelinePdf(input: ExportInput) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;

  // Header
  doc.setFillColor(231, 30, 120);
  doc.rect(0, 0, pageWidth, 60, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.text("Linha do tempo — Submissão China", margin, 26);
  doc.setFontSize(8);
  doc.text(
    `Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`,
    pageWidth - margin,
    44,
    { align: "right" },
  );

  // Identificação
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  let y = 88;
  doc.setFont("helvetica", "bold");
  doc.text(`${input.produtoCodigo} — ${input.produtoNome}`, margin, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  if (input.numeroOrdem) {
    doc.text(`OC: ${input.numeroOrdem}`, margin, y);
    y += 11;
  }
  if (input.submissaoStatus) {
    doc.text(`Status atual: ${input.submissaoStatus}`, margin, y);
    y += 11;
  }
  if (input.criadaEm) {
    doc.text(
      `Criada em: ${format(new Date(input.criadaEm), "dd/MM/yyyy HH:mm", { locale: ptBR })}`,
      margin,
      y,
    );
    y += 11;
  }

  // Bloco Jornada
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Jornada da submissão", margin, y);
  y += 4;

  autoTable(doc, {
    startY: y + 6,
    head: [["#", "Etapa", "Status", "Detalhe"]],
    body: input.stages.map((s) => [
      String(s.numero),
      s.titulo,
      STATUS_LABEL[s.status],
      s.detalhe,
    ]),
    styles: { fontSize: 8.5, cellPadding: 4 },
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42] },
    columnStyles: {
      0: { cellWidth: 22, halign: "center" },
      1: { cellWidth: 150 },
      2: { cellWidth: 70 },
      3: { cellWidth: "auto" as any },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 2) {
        const s = input.stages[data.row.index];
        if (s) {
          const c = STATUS_COLOR[s.status];
          data.cell.styles.textColor = c;
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
    margin: { left: margin, right: margin },
  });

  // Bloco Histórico
  let afterY = (doc as any).lastAutoTable?.finalY || y + 100;
  afterY += 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Histórico de eventos", margin, afterY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(110, 110, 110);
  doc.text(
    input.filtroDescricao || `${input.eventos.length} evento(s)`,
    margin,
    afterY + 12,
  );
  doc.setTextColor(0, 0, 0);

  if (input.eventos.length === 0) {
    doc.setFontSize(9);
    doc.text("Nenhum evento no período/filtro selecionado.", margin, afterY + 30);
  } else {
    autoTable(doc, {
      startY: afterY + 20,
      head: [["Data/Hora", "Tipo", "Título", "Descrição"]],
      body: input.eventos.map((e) => {
        const cfg = kindConfig(e.kind);
        return [
          format(new Date(e.timestamp), "dd/MM/yy HH:mm", { locale: ptBR }),
          cfg.label,
          e.title,
          e.descricao || "—",
        ];
      }),
      styles: { fontSize: 8, cellPadding: 3.5, valign: "top" },
      headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42] },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: 90 },
        2: { cellWidth: 130 },
        3: { cellWidth: "auto" as any },
      },
      margin: { left: margin, right: margin },
    });
  }

  // Footer com numeração
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(140, 140, 140);
    doc.text(
      `Página ${i} de ${pageCount}`,
      pageWidth - margin,
      doc.internal.pageSize.getHeight() - 16,
      { align: "right" },
    );
  }

  const safeName = `${input.produtoCodigo}-linha-do-tempo`.replace(/[^a-z0-9-]+/gi, "_");
  doc.save(`${safeName}.pdf`);
}
