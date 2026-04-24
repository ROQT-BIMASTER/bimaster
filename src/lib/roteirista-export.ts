import jsPDF from "jspdf";
import type { RoteiroEstruturado } from "@/hooks/useRoteiristaIA";

interface ExportMeta {
  formato?: "9:16" | "16:9" | "1:1";
  briefing?: {
    tema?: string;
    objetivo?: string;
    publico_alvo?: string;
    tom?: string;
    duracao_total?: number;
    paleta_cores?: string[];
  };
}

const slugify = (s: string) =>
  (s || "roteiro")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);

export function exportarRoteiroJSON(roteiro: RoteiroEstruturado, meta?: ExportMeta) {
  const payload = {
    versao: "1.0",
    exportado_em: new Date().toISOString(),
    formato: meta?.formato,
    briefing: meta?.briefing,
    roteiro,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `roteiro-${slugify(roteiro.titulo)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportarRoteiroPDF(roteiro: RoteiroEstruturado, meta?: ExportMeta) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const maxW = pageW - margin * 2;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const writeWrapped = (text: string, opts: { size?: number; bold?: boolean; color?: [number, number, number]; gap?: number } = {}) => {
    const { size = 10, bold = false, color = [40, 40, 40], gap = 4 } = opts;
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text || "—", maxW);
    const lineH = size * 1.25;
    for (const line of lines) {
      ensureSpace(lineH);
      doc.text(line, margin, y);
      y += lineH;
    }
    y += gap;
  };

  const hr = () => {
    ensureSpace(12);
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, y, pageW - margin, y);
    y += 10;
  };

  // Cabeçalho
  doc.setFillColor(20, 20, 30);
  doc.rect(0, 0, pageW, 70, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("ROTEIRO CINEMATOGRÁFICO", margin, 28);
  doc.setFontSize(16);
  const tituloLines = doc.splitTextToSize(roteiro.titulo || "Sem título", maxW);
  doc.text(tituloLines[0], margin, 52);
  y = 95;

  // Metadados
  doc.setTextColor(100, 100, 100);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const metaParts: string[] = [];
  if (meta?.formato) metaParts.push(`Formato ${meta.formato}`);
  if (meta?.briefing?.duracao_total) metaParts.push(`${meta.briefing.duracao_total}s`);
  if (meta?.briefing?.tom) metaParts.push(`Tom: ${meta.briefing.tom}`);
  metaParts.push(`${roteiro.cenas.length} cenas`);
  metaParts.push(new Date().toLocaleDateString("pt-BR"));
  doc.text(metaParts.join("  •  "), margin, y);
  y += 18;
  hr();

  // Sinopse
  writeWrapped("SINOPSE", { size: 10, bold: true, color: [80, 80, 80], gap: 6 });
  writeWrapped(roteiro.sinopse, { size: 11, gap: 10 });

  // Conceito visual
  writeWrapped("CONCEITO VISUAL", { size: 10, bold: true, color: [80, 80, 80], gap: 6 });
  writeWrapped(roteiro.conceito_visual, { size: 11, gap: 10 });

  // Briefing (opcional)
  if (meta?.briefing?.publico_alvo || meta?.briefing?.objetivo) {
    writeWrapped("BRIEFING", { size: 10, bold: true, color: [80, 80, 80], gap: 6 });
    if (meta.briefing.objetivo) writeWrapped(`Objetivo: ${meta.briefing.objetivo}`, { size: 10 });
    if (meta.briefing.publico_alvo) writeWrapped(`Público-alvo: ${meta.briefing.publico_alvo}`, { size: 10 });
    if (meta.briefing.paleta_cores?.length) writeWrapped(`Paleta: ${meta.briefing.paleta_cores.join(", ")}`, { size: 10 });
    y += 4;
  }

  hr();

  // Cenas
  writeWrapped("STORYBOARD", { size: 12, bold: true, color: [20, 20, 30], gap: 8 });

  roteiro.cenas.forEach((cena, idx) => {
    ensureSpace(80);
    // Header da cena
    doc.setFillColor(245, 245, 250);
    const blockStart = y - 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(20, 20, 30);
    doc.text(`Cena ${cena.numero ?? idx + 1} — ${cena.titulo || "Sem título"}`, margin, y + 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    const tag = `${cena.duracao_segundos}s  •  ${cena.tipo_plano}  •  ${cena.movimento_camera}`;
    doc.text(tag, margin, y + 26);
    y += 38;

    writeWrapped("DESCRIÇÃO VISUAL (CÂMERA)", { size: 8, bold: true, color: [120, 120, 120], gap: 2 });
    writeWrapped(cena.descricao_visual, { size: 10, gap: 8 });

    if (cena.narracao) {
      writeWrapped("NARRAÇÃO", { size: 8, bold: true, color: [120, 120, 120], gap: 2 });
      writeWrapped(cena.narracao, { size: 10, gap: 8 });
    }

    if (cena.audio_ambiente) {
      writeWrapped("ÁUDIO AMBIENTE", { size: 8, bold: true, color: [120, 120, 120], gap: 2 });
      writeWrapped(cena.audio_ambiente, { size: 10, gap: 10 });
    }

    if (idx < roteiro.cenas.length - 1) hr();
    void blockStart;
  });

  // CTA
  if (roteiro.cta) {
    ensureSpace(60);
    hr();
    writeWrapped("CALL-TO-ACTION", { size: 10, bold: true, color: [80, 80, 80], gap: 6 });
    writeWrapped(roteiro.cta, { size: 11, gap: 8 });
  }

  // Hashtags
  if (roteiro.hashtags?.length) {
    writeWrapped("HASHTAGS", { size: 8, bold: true, color: [120, 120, 120], gap: 2 });
    writeWrapped(roteiro.hashtags.map(h => `#${h.replace(/^#/, "")}`).join("  "), { size: 10, gap: 6 });
  }

  // Rodapé com paginação
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 160);
    doc.text(`Página ${i} de ${totalPages}`, pageW - margin, pageH - 20, { align: "right" });
    doc.text("Roteirista IA", margin, pageH - 20);
  }

  doc.save(`roteiro-${slugify(roteiro.titulo)}.pdf`);
}
