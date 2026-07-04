// PDF executivo do Suporte. Padrão do copilotPdf.ts: jspdf + autotable,
// capa com faixa BRAND_BASE, KPI grid, gráficos como imagem, tabela,
// rodapé "Página N de M" em pt-BR / America/Sao_Paulo.
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BRAND_BASE } from "@/lib/charts/corporateTheme";
import { formatValor } from "@/lib/suporte/analyticsFormat";
import type { SuporteKpisData } from "@/hooks/suporte/useSuporteAnalytics";

export interface RelatorioSuporteInput {
  titulo: string;
  periodo: string;
  filaNome: string;
  kpis: SuporteKpisData;
  anterior: SuporteKpisData | null;
  incluir: {
    kpis: boolean;
    evolucao: boolean;
    categorias: boolean;
    sla: boolean;
    csat: boolean;
    transferencias: boolean;
    tabela: boolean;
  };
  imagens: {
    gauge?: string;
    evolucao?: string;
    categorias?: string;
    sankey?: string;
    csat?: string;
  };
  tabelaCategorias?: { label: string; valor: number }[];
}

function hexToRgb(hex: string): [number, number, number] {
  const s = hex.replace("#", "");
  return [
    parseInt(s.substring(0, 2), 16),
    parseInt(s.substring(2, 4), 16),
    parseInt(s.substring(4, 6), 16),
  ];
}

function deltaPct(a: number | null | undefined, b: number | null | undefined): string {
  const av = Number(a ?? 0), bv = Number(b ?? 0);
  if (!isFinite(av) || !isFinite(bv) || bv === 0) return "—";
  const p = ((av - bv) / Math.abs(bv)) * 100;
  return `${p > 0 ? "+" : ""}${p.toFixed(1)}%`;
}

export async function exportRelatorioSuporte(input: RelatorioSuporteInput) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;
  const [br, bg, bb] = hexToRgb(BRAND_BASE);

  // ---------- Capa ----------
  doc.setFillColor(br, bg, bb);
  doc.rect(0, 0, pageW, 36, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(input.titulo, margin, 20);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Período: ${input.periodo}   ·   Departamento: ${input.filaNome}`, margin, 28);

  let y = 46;
  doc.setTextColor(31, 41, 55);

  // ---------- KPI cards ----------
  if (input.incluir.kpis) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Indicadores executivos", margin, y);
    y += 6;

    const cards = [
      { label: "Backlog atual", value: formatValor(input.kpis.backlog_atual, "chamados"), delta: "—" },
      { label: "Novos", value: formatValor(input.kpis.novos, "chamados"), delta: deltaPct(input.kpis.novos, input.anterior?.novos) },
      { label: "Resolvidos", value: formatValor(input.kpis.resolvidos, "resolvidos"), delta: deltaPct(input.kpis.resolvidos, input.anterior?.resolvidos) },
      { label: "% SLA resolução", value: formatValor(input.kpis.pct_sla_resolucao, "pct_sla_resolucao"), delta: deltaPct(input.kpis.pct_sla_resolucao, input.anterior?.pct_sla_resolucao) },
      { label: "1ª resposta média", value: formatValor(input.kpis.frt_media_h, "frt_horas"), delta: deltaPct(input.kpis.frt_media_h, input.anterior?.frt_media_h) },
      { label: "Resolução média", value: formatValor(input.kpis.resolucao_media_h, "resolucao_horas"), delta: deltaPct(input.kpis.resolucao_media_h, input.anterior?.resolucao_media_h) },
      { label: "CSAT", value: formatValor(input.kpis.csat_media, "csat"), delta: `${input.kpis.csat_respostas} resp.` },
      { label: "Transferências", value: formatValor(input.kpis.transferencias, "transferencias"), delta: deltaPct(input.kpis.transferencias, input.anterior?.transferencias) },
    ];

    const cols = 4;
    const cardW = (pageW - margin * 2 - 4 * (cols - 1)) / cols;
    const cardH = 22;
    cards.forEach((c, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const cx = margin + col * (cardW + 4);
      const cy = y + row * (cardH + 4);
      doc.setDrawColor(220, 220, 220);
      doc.setFillColor(250, 250, 250);
      doc.roundedRect(cx, cy, cardW, cardH, 2, 2, "FD");
      doc.setFontSize(8);
      doc.setTextColor(107, 114, 128);
      doc.text(c.label, cx + 3, cy + 5);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 22, 35);
      doc.text(c.value, cx + 3, cy + 13);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(107, 114, 128);
      doc.text(c.delta, cx + 3, cy + 19);
    });
    y += Math.ceil(cards.length / cols) * (cardH + 4) + 6;
  }

  const addImage = (title: string, dataUrl?: string, height = 70) => {
    if (!dataUrl) return;
    if (y + height + 12 > pageH - 20) {
      doc.addPage();
      y = margin;
    }
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 22, 35);
    doc.text(title, margin, y);
    y += 3;
    try {
      doc.addImage(dataUrl, "PNG", margin, y, pageW - margin * 2, height);
      y += height + 6;
    } catch {
      y += 4;
    }
  };

  if (input.incluir.sla) addImage("Gauge — % SLA resolução", input.imagens.gauge, 60);
  if (input.incluir.evolucao) addImage("Evolução: novos × resolvidos", input.imagens.evolucao, 65);
  if (input.incluir.categorias) addImage("Chamados por categoria", input.imagens.categorias, 65);
  if (input.incluir.transferencias) addImage("Fluxo de transferências", input.imagens.sankey, 70);
  if (input.incluir.csat) addImage("CSAT — distribuição", input.imagens.csat, 55);

  // Tabela
  if (input.incluir.tabela && input.tabelaCategorias && input.tabelaCategorias.length > 0) {
    if (y + 30 > pageH - 20) { doc.addPage(); y = margin; }
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Tabela: chamados por categoria", margin, y);
    y += 3;
    autoTable(doc, {
      startY: y,
      head: [["Categoria", "Chamados"]],
      body: input.tabelaCategorias.map((r) => [r.label, formatValor(r.valor, "chamados")]),
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [br, bg, bb], textColor: 255 },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ---------- Rodapé em todas as páginas ----------
  const total = doc.getNumberOfPages();
  const geradoEm = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text(`Gerado em ${geradoEm} (America/Sao_Paulo)`, margin, pageH - 8);
    doc.text(`Página ${p} de ${total}`, pageW - margin, pageH - 8, { align: "right" });
  }

  const nome = `relatorio-suporte-${input.filaNome.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${format(new Date(), "yyyy-MM-dd")}.pdf`;
  doc.save(nome);
}
