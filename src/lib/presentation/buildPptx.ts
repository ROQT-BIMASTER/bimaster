import PptxGenJS from "pptxgenjs";
import { fetchImageAsBase64 } from "./fetchImageAsBase64";
import type { PresentationGroup, PresentationPlan } from "./types";

const TRADE_PINK = "E91E78";
const DARK = "1F2937";
const MUTED = "6B7280";
const LIGHT = "F3F4F6";

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

function periodCovered(groups: PresentationGroup[]): string {
  if (groups.length === 0) return "";
  const dates = groups
    .map((g) => new Date(g.date).getTime())
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => a - b);
  if (dates.length === 0) return "";
  const start = formatDateBR(new Date(dates[0]).toISOString());
  const end = formatDateBR(new Date(dates[dates.length - 1]).toISOString());
  return start === end ? start : `${start} a ${end}`;
}

export async function buildTradePresentationPptx(
  plan: PresentationPlan,
  groups: PresentationGroup[],
): Promise<Blob> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 inches
  pptx.title = plan.title;
  pptx.author = "Trade Marketing";

  const slideW = 13.33;
  const slideH = 7.5;

  // ============ SLIDE 1 — CAPA ============
  const cover = pptx.addSlide();
  cover.background = { color: DARK };

  // Faixa rosa lateral
  cover.addShape("rect", {
    x: 0,
    y: 0,
    w: 0.4,
    h: slideH,
    fill: { color: TRADE_PINK },
    line: { color: TRADE_PINK },
  });

  cover.addText("TRADE MARKETING", {
    x: 0.9,
    y: 1.2,
    w: 11,
    h: 0.5,
    fontSize: 14,
    color: TRADE_PINK,
    bold: true,
    fontFace: "Calibri",
    charSpacing: 6,
  });

  cover.addText(plan.title, {
    x: 0.9,
    y: 1.8,
    w: 11.5,
    h: 1.8,
    fontSize: 44,
    color: "FFFFFF",
    bold: true,
    fontFace: "Calibri",
    valign: "top",
  });

  if (plan.client) {
    cover.addText(plan.client, {
      x: 0.9,
      y: 4.0,
      w: 11.5,
      h: 0.6,
      fontSize: 24,
      color: "FFFFFF",
      fontFace: "Calibri",
    });
  }

  cover.addText(
    [
      { text: `${groups.length} `, options: { color: TRADE_PINK, bold: true, fontSize: 28 } },
      { text: groups.length === 1 ? "PDV apresentado" : "PDVs apresentados", options: { color: "FFFFFF", fontSize: 20 } },
    ],
    { x: 0.9, y: 5.4, w: 11, h: 0.6, fontFace: "Calibri" },
  );

  cover.addText(periodCovered(groups) || formatDateBR(new Date().toISOString()), {
    x: 0.9,
    y: 6.2,
    w: 11,
    h: 0.4,
    fontSize: 14,
    color: "9CA3AF",
    fontFace: "Calibri",
  });

  // ============ SLIDE 2 — OBJETIVO & SUMÁRIO ============
  if (plan.objective || groups.length > 0) {
    const summary = pptx.addSlide();
    summary.background = { color: "FFFFFF" };

    summary.addShape("rect", {
      x: 0,
      y: 0,
      w: slideW,
      h: 0.6,
      fill: { color: TRADE_PINK },
      line: { color: TRADE_PINK },
    });

    summary.addText("OBJETIVO & SUMÁRIO", {
      x: 0.5,
      y: 0.1,
      w: 12,
      h: 0.4,
      fontSize: 16,
      color: "FFFFFF",
      bold: true,
      fontFace: "Calibri",
      charSpacing: 4,
    });

    if (plan.objective) {
      summary.addText("Objetivo", {
        x: 0.5,
        y: 1.0,
        w: 12,
        h: 0.4,
        fontSize: 14,
        color: MUTED,
        bold: true,
        fontFace: "Calibri",
      });
      summary.addText(plan.objective, {
        x: 0.5,
        y: 1.4,
        w: 12,
        h: 1.6,
        fontSize: 18,
        color: DARK,
        fontFace: "Calibri",
        valign: "top",
      });
    }

    summary.addText("PDVs nesta apresentação", {
      x: 0.5,
      y: plan.objective ? 3.2 : 1.0,
      w: 12,
      h: 0.4,
      fontSize: 14,
      color: MUTED,
      bold: true,
      fontFace: "Calibri",
    });

    const listItems = groups.slice(0, 14).map((g, i) => ({
      text: `${String(i + 1).padStart(2, "0")}. ${g.storeName}${g.storeAddress ? `  —  ${g.storeAddress}` : ""}`,
      options: { fontSize: 14, color: DARK, bullet: false },
    }));

    summary.addText(listItems, {
      x: 0.5,
      y: plan.objective ? 3.6 : 1.4,
      w: 12,
      h: 3.6,
      fontFace: "Calibri",
      valign: "top",
      lineSpacingMultiple: 1.3,
    });

    if (groups.length > 14) {
      summary.addText(`+ ${groups.length - 14} PDVs nos slides seguintes`, {
        x: 0.5,
        y: 7.1,
        w: 12,
        h: 0.3,
        fontSize: 12,
        color: MUTED,
        italic: true,
        fontFace: "Calibri",
      });
    }
  }

  // ============ SLIDES 3..N — UM POR PDV ============
  // Pré-baixa todas imagens em paralelo
  const imagePairs = await Promise.all(
    groups.map(async (g) => ({
      key: g.key,
      before: g.beforeUrl ? await fetchImageAsBase64(g.beforeUrl) : null,
      after: g.afterUrl ? await fetchImageAsBase64(g.afterUrl) : null,
    })),
  );
  const imageMap = new Map(imagePairs.map((p) => [p.key, p]));

  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    const slide = pptx.addSlide();
    slide.background = { color: "FFFFFF" };

    // Cabeçalho
    slide.addText(g.storeName, {
      x: 0.5,
      y: 0.3,
      w: 12.3,
      h: 0.7,
      fontSize: 28,
      color: DARK,
      bold: true,
      fontFace: "Calibri",
    });

    if (g.storeAddress) {
      slide.addText(g.storeAddress, {
        x: 0.5,
        y: 1.0,
        w: 12.3,
        h: 0.4,
        fontSize: 14,
        color: MUTED,
        fontFace: "Calibri",
      });
    }

    slide.addText(`Data: ${formatDateBR(g.date)}`, {
      x: 0.5,
      y: 1.4,
      w: 12.3,
      h: 0.3,
      fontSize: 11,
      color: MUTED,
      fontFace: "Calibri",
      charSpacing: 3,
    });

    // Linha divisória
    slide.addShape("rect", {
      x: 0.5,
      y: 1.85,
      w: 12.3,
      h: 0.03,
      fill: { color: TRADE_PINK },
      line: { color: TRADE_PINK },
    });

    // Labels ANTES / DEPOIS
    slide.addText("ANTES", {
      x: 0.5,
      y: 2.0,
      w: 6.0,
      h: 0.4,
      fontSize: 14,
      color: TRADE_PINK,
      bold: true,
      align: "center",
      fontFace: "Calibri",
      charSpacing: 8,
    });

    slide.addText("DEPOIS", {
      x: 6.85,
      y: 2.0,
      w: 6.0,
      h: 0.4,
      fontSize: 14,
      color: TRADE_PINK,
      bold: true,
      align: "center",
      fontFace: "Calibri",
      charSpacing: 8,
    });

    const imgPair = imageMap.get(g.key);
    const imgY = 2.5;
    const imgH = 4.2;
    const imgW = 6.0;

    // ANTES image
    if (imgPair?.before) {
      slide.addImage({
        data: imgPair.before.dataUrl,
        x: 0.5,
        y: imgY,
        w: imgW,
        h: imgH,
        sizing: { type: "contain", w: imgW, h: imgH },
      });
    } else {
      slide.addShape("rect", {
        x: 0.5,
        y: imgY,
        w: imgW,
        h: imgH,
        fill: { color: LIGHT },
        line: { color: "E5E7EB", width: 1 },
      });
      slide.addText("Sem foto Antes", {
        x: 0.5,
        y: imgY + imgH / 2 - 0.2,
        w: imgW,
        h: 0.4,
        fontSize: 14,
        color: MUTED,
        align: "center",
        fontFace: "Calibri",
      });
    }

    // DEPOIS image
    if (imgPair?.after) {
      slide.addImage({
        data: imgPair.after.dataUrl,
        x: 6.85,
        y: imgY,
        w: imgW,
        h: imgH,
        sizing: { type: "contain", w: imgW, h: imgH },
      });
    } else {
      slide.addShape("rect", {
        x: 6.85,
        y: imgY,
        w: imgW,
        h: imgH,
        fill: { color: LIGHT },
        line: { color: "E5E7EB", width: 1 },
      });
      slide.addText("Sem foto Depois", {
        x: 6.85,
        y: imgY + imgH / 2 - 0.2,
        w: imgW,
        h: 0.4,
        fontSize: 14,
        color: MUTED,
        align: "center",
        fontFace: "Calibri",
      });
    }

    // Rodapé: observação + IA
    const note = plan.notesByKey[g.key]?.trim();
    const aiBadges: string[] = [];
    if (g.beforeAi) aiBadges.push("Antes • IA");
    if (g.afterAi) aiBadges.push("Depois • IA");

    if (note) {
      slide.addText(note, {
        x: 0.5,
        y: 6.85,
        w: aiBadges.length ? 9.5 : 12.3,
        h: 0.45,
        fontSize: 12,
        color: DARK,
        italic: true,
        fontFace: "Calibri",
      });
    }

    if (aiBadges.length) {
      slide.addText(aiBadges.join("   ·   "), {
        x: 10.2,
        y: 6.85,
        w: 2.6,
        h: 0.4,
        fontSize: 10,
        color: TRADE_PINK,
        bold: true,
        align: "right",
        fontFace: "Calibri",
      });
    }

    slide.addText(`${i + 1} / ${groups.length}`, {
      x: 12.3,
      y: 7.2,
      w: 0.7,
      h: 0.25,
      fontSize: 9,
      color: MUTED,
      align: "right",
      fontFace: "Calibri",
    });
  }

  // ============ SLIDE FINAL — ENCERRAMENTO ============
  const closing = pptx.addSlide();
  closing.background = { color: DARK };

  closing.addShape("rect", {
    x: 0,
    y: 0,
    w: slideW,
    h: 0.4,
    fill: { color: TRADE_PINK },
    line: { color: TRADE_PINK },
  });

  closing.addText("Resumo da Apresentação", {
    x: 0.9,
    y: 1.6,
    w: 11.5,
    h: 0.6,
    fontSize: 18,
    color: TRADE_PINK,
    bold: true,
    fontFace: "Calibri",
    charSpacing: 4,
  });

  closing.addText(`${groups.length}`, {
    x: 0.9,
    y: 2.3,
    w: 11.5,
    h: 1.6,
    fontSize: 96,
    color: "FFFFFF",
    bold: true,
    fontFace: "Calibri",
  });

  closing.addText(groups.length === 1 ? "PDV apresentado" : "PDVs apresentados", {
    x: 0.9,
    y: 4.0,
    w: 11.5,
    h: 0.5,
    fontSize: 22,
    color: "FFFFFF",
    fontFace: "Calibri",
  });

  const period = periodCovered(groups);
  if (period) {
    closing.addText(`Período coberto: ${period}`, {
      x: 0.9,
      y: 4.7,
      w: 11.5,
      h: 0.4,
      fontSize: 16,
      color: "9CA3AF",
      fontFace: "Calibri",
    });
  }

  closing.addText("Trade Marketing", {
    x: 0.9,
    y: 6.6,
    w: 11.5,
    h: 0.4,
    fontSize: 12,
    color: TRADE_PINK,
    bold: true,
    fontFace: "Calibri",
    charSpacing: 4,
  });

  // Gera Blob
  const data = (await pptx.write({ outputType: "blob" })) as Blob;
  return data;
}
