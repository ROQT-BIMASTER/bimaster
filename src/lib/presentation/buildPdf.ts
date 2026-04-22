import { jsPDF } from "jspdf";
import { fetchImageAsBase64 } from "./fetchImageAsBase64";
import type { PresentationGroup, PresentationPlan } from "./types";

const TRADE_PINK: [number, number, number] = [233, 30, 120];
const DARK: [number, number, number] = [31, 41, 55];
const MUTED: [number, number, number] = [107, 114, 128];

function formatDateBR(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export async function buildTradePresentationPdf(
  plan: PresentationPlan,
  groups: PresentationGroup[],
): Promise<Blob> {
  // Landscape A4 — 297 x 210 mm
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = 297;
  const H = 210;

  // ===== Capa =====
  pdf.setFillColor(...DARK);
  pdf.rect(0, 0, W, H, "F");
  pdf.setFillColor(...TRADE_PINK);
  pdf.rect(0, 0, 8, H, "F");

  pdf.setTextColor(...TRADE_PINK);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text("TRADE MARKETING", 18, 30);

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(32);
  const titleLines = pdf.splitTextToSize(plan.title, W - 30);
  pdf.text(titleLines, 18, 50);

  if (plan.client) {
    pdf.setFontSize(18);
    pdf.setFont("helvetica", "normal");
    pdf.text(plan.client, 18, 100);
  }

  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...TRADE_PINK);
  pdf.text(`${groups.length}`, 18, 140);
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(14);
  pdf.text(groups.length === 1 ? "PDV apresentado" : "PDVs apresentados", 30, 140);

  pdf.setFontSize(11);
  pdf.setTextColor(180, 180, 180);
  pdf.text(formatDateBR(new Date().toISOString()), 18, 175);

  // Pré-baixa imagens
  const imagePairs = await Promise.all(
    groups.map(async (g) => ({
      key: g.key,
      before: g.beforeUrl ? await fetchImageAsBase64(g.beforeUrl) : null,
      after: g.afterUrl ? await fetchImageAsBase64(g.afterUrl) : null,
    })),
  );
  const imageMap = new Map(imagePairs.map((p) => [p.key, p]));

  // ===== Páginas por PDV =====
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    pdf.addPage();

    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, W, H, "F");

    // Cabeçalho
    pdf.setTextColor(...DARK);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(20);
    pdf.text(g.storeName, 12, 16);

    if (g.storeAddress) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(...MUTED);
      pdf.text(g.storeAddress, 12, 22);
    }

    pdf.setFontSize(9);
    pdf.setTextColor(...MUTED);
    pdf.text(`Data: ${formatDateBR(g.date)}`, 12, 28);

    // Linha rosa
    pdf.setFillColor(...TRADE_PINK);
    pdf.rect(12, 32, W - 24, 0.6, "F");

    // Labels
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(...TRADE_PINK);
    const colW = (W - 30) / 2;
    pdf.text("ANTES", 12 + colW / 2, 40, { align: "center" });
    pdf.text("DEPOIS", 12 + colW + 6 + colW / 2, 40, { align: "center" });

    // Imagens
    const imgY = 44;
    const imgH = 130;
    const imgPair = imageMap.get(g.key);

    const drawSlot = (x: number, w: number, label: string, dataUrl: string | null) => {
      if (dataUrl) {
        try {
          const fmt = dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
          pdf.addImage(dataUrl, fmt, x, imgY, w, imgH, undefined, "FAST");
        } catch (err) {
          console.warn("[pdf] addImage falhou", err);
          drawPlaceholder(x, w, label);
        }
      } else {
        drawPlaceholder(x, w, label);
      }
    };

    const drawPlaceholder = (x: number, w: number, label: string) => {
      pdf.setFillColor(243, 244, 246);
      pdf.rect(x, imgY, w, imgH, "F");
      pdf.setTextColor(...MUTED);
      pdf.setFont("helvetica", "italic");
      pdf.setFontSize(11);
      pdf.text(label, x + w / 2, imgY + imgH / 2, { align: "center" });
    };

    drawSlot(12, colW, "Sem foto Antes", imgPair?.before?.dataUrl ?? null);
    drawSlot(12 + colW + 6, colW, "Sem foto Depois", imgPair?.after?.dataUrl ?? null);

    // Observação rodapé
    const note = plan.notesByKey[g.key]?.trim();
    if (note) {
      pdf.setFont("helvetica", "italic");
      pdf.setFontSize(10);
      pdf.setTextColor(...DARK);
      const noteLines = pdf.splitTextToSize(note, W - 30);
      pdf.text(noteLines.slice(0, 2), 12, H - 10);
    }

    // Numeração
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(...MUTED);
    pdf.text(`${i + 1} / ${groups.length}`, W - 12, H - 6, { align: "right" });
  }

  return pdf.output("blob");
}
