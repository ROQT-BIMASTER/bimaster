// exportResumoProjetoPdf.ts — Gera PDF executivo do Resumo Inteligente do Projeto.
// Capa colorida, cartões de KPI, conteúdo markdown formatado e rodapé com numeração.
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface ResumoProjetoStats {
  total: number;
  concluidas: number;
  atrasadas: number;
  semResponsavel: number;
  altaPrioridade?: number;
}

export interface BuildResumoProjetoPdfInput {
  projetoNome: string;
  projetoCor?: string | null;
  summary: string;
  stats?: ResumoProjetoStats | null;
}

type Block =
  | { kind: "h1" | "h2" | "h3"; text: string }
  | { kind: "p"; text: string }
  | { kind: "li"; text: string }
  | { kind: "table"; head: string[]; body: string[][] };

function parseMarkdown(md: string): Block[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const ln = lines[i];
    if (/^\s*\|.+\|\s*$/.test(ln) && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1])) {
      const head = ln.split("|").map((c) => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      const body: string[][] = [];
      i += 2;
      while (i < lines.length && /^\s*\|.+\|\s*$/.test(lines[i])) {
        const row = lines[i].split("|").map((c) => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
        body.push(row);
        i++;
      }
      blocks.push({ kind: "table", head, body });
      continue;
    }
    if (/^###\s+/.test(ln)) { blocks.push({ kind: "h3", text: ln.replace(/^###\s+/, "").trim() }); i++; continue; }
    if (/^##\s+/.test(ln)) { blocks.push({ kind: "h2", text: ln.replace(/^##\s+/, "").trim() }); i++; continue; }
    if (/^#\s+/.test(ln)) { blocks.push({ kind: "h1", text: ln.replace(/^#\s+/, "").trim() }); i++; continue; }
    if (/^\s*[-*]\s+/.test(ln)) { blocks.push({ kind: "li", text: ln.replace(/^\s*[-*]\s+/, "").trim() }); i++; continue; }
    if (/^\s*\d+\.\s+/.test(ln)) { blocks.push({ kind: "li", text: ln.replace(/^\s*\d+\.\s+/, "").trim() }); i++; continue; }
    if (ln.trim() === "") { i++; continue; }
    let buf = ln;
    i++;
    while (i < lines.length && lines[i].trim() !== "" && !/^[#\-*\d|]/.test(lines[i].trim())) {
      buf += " " + lines[i].trim();
      i++;
    }
    blocks.push({ kind: "p", text: buf.replace(/\*\*/g, "").replace(/\*/g, "").trim() });
  }
  return blocks;
}

function hexToRgb(hex?: string | null): [number, number, number] {
  const fallback: [number, number, number] = [35, 90, 200];
  if (!hex) return fallback;
  const m = hex.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(m)) return fallback;
  return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
}

function slugify(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "projeto";
}

function fmtNow(): string {
  return new Date().toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fileDate(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  // yyyymmdd em América/Sao_Paulo
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}${get("month")}${get("day")}`;
}

export function buildResumoProjetoPdf(input: BuildResumoProjetoPdfInput): { blob: Blob; filename: string } {
  const { projetoNome, projetoCor, summary, stats } = input;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  let y = margin;

  const brand = hexToRgb(projetoCor ?? undefined);

  const ensure = (h: number) => {
    if (y + h > pageH - 50) {
      doc.addPage();
      y = margin;
    }
  };

  // ===== Capa =====
  doc.setFillColor(brand[0], brand[1], brand[2]);
  doc.rect(0, 0, pageW, 110, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Resumo Inteligente do Projeto", margin, 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.text(projetoNome, margin, 76);
  doc.setFontSize(9);
  doc.text(`Gerado em ${fmtNow()}`, margin, 96);

  y = 134;
  doc.setTextColor(25, 35, 55);

  // ===== KPI Cards =====
  if (stats) {
    const pct = stats.total > 0 ? Math.round((stats.concluidas / stats.total) * 100) : 0;
    const tiles = [
      { label: "CONCLUÍDO", value: `${pct}%` },
      { label: "ATRASADAS", value: String(stats.atrasadas) },
      { label: "SEM RESPONSÁVEL", value: String(stats.semResponsavel) },
      { label: "TAREFAS", value: `${stats.concluidas}/${stats.total}` },
    ];
    const tileW = (pageW - margin * 2 - 18) / 4;
    const tileH = 56;
    tiles.forEach((tile, idx) => {
      const x = margin + idx * (tileW + 6);
      doc.setDrawColor(225);
      doc.setFillColor(252, 253, 255);
      doc.roundedRect(x, y, tileW, tileH, 5, 5, "FD");
      doc.setFontSize(7.5);
      doc.setTextColor(120, 130, 150);
      doc.text(tile.label, x + 10, y + 16);
      doc.setFontSize(17);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(25, 35, 55);
      doc.text(tile.value, x + 10, y + 42);
      doc.setFont("helvetica", "normal");
    });
    y += tileH + 22;
  }

  // ===== Conteúdo (markdown) =====
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(25, 35, 55);
  doc.text("Análise", margin, y);
  y += 14;

  const contentW = pageW - margin * 2;
  const blocks = parseMarkdown(summary);

  for (const b of blocks) {
    if (b.kind === "table") {
      ensure(40);
      autoTable(doc, {
        startY: y,
        head: [b.head],
        body: b.body,
        styles: { fontSize: 9, cellPadding: 4, overflow: "linebreak" },
        headStyles: { fillColor: brand, textColor: 255 },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
      continue;
    }
    if (b.kind === "h1") {
      doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(25, 35, 55);
      const lines = doc.splitTextToSize(b.text, contentW);
      ensure(lines.length * 16 + 8);
      doc.text(lines, margin, y); y += lines.length * 16 + 6;
      continue;
    }
    if (b.kind === "h2") {
      doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(25, 35, 55);
      const lines = doc.splitTextToSize(b.text, contentW);
      ensure(lines.length * 14 + 6);
      doc.text(lines, margin, y); y += lines.length * 14 + 4;
      continue;
    }
    if (b.kind === "h3") {
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(40, 50, 70);
      const lines = doc.splitTextToSize(b.text, contentW);
      ensure(lines.length * 13 + 5);
      doc.text(lines, margin, y); y += lines.length * 13 + 3;
      continue;
    }
    if (b.kind === "li") {
      doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(40, 50, 70);
      const lines = doc.splitTextToSize("• " + b.text, contentW - 8);
      ensure(lines.length * 12 + 4);
      doc.text(lines, margin + 4, y);
      y += lines.length * 12 + 2;
      continue;
    }
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(40, 50, 70);
    const lines = doc.splitTextToSize(b.text, contentW);
    ensure(lines.length * 12 + 6);
    doc.text(lines, margin, y);
    y += lines.length * 12 + 6;
  }

  // ===== Footer =====
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(140, 150, 170);
    doc.text(projetoNome, margin, pageH - 20);
    doc.text(`Página ${p} de ${totalPages}`, pageW - margin, pageH - 20, { align: "right" });
  }

  const blob = doc.output("blob");
  const filename = `resumo-${slugify(projetoNome)}-${fileDate()}.pdf`;
  return { blob, filename };
}
