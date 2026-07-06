// Utilitário para aplicar watermark visual em imagens e PDFs.
// Uso: apenas para não-admins, como camada dissuasiva (não criptográfica).

export interface WatermarkPayload {
  usuario: string;
  email?: string | null;
  ticketId: string;
  hashCurto: string;
  quandoISO?: string;
}

function watermarkText(p: WatermarkPayload): string {
  const dt = new Date(p.quandoISO ?? new Date().toISOString());
  const dtStr = dt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const email = p.email ? ` · ${p.email}` : "";
  return `${p.usuario}${email} · ticket #${p.ticketId.slice(0, 8)} · ${dtStr} · SHA ${p.hashCurto}`;
}

function drawWatermarkOnCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  text: string,
) {
  const step = Math.max(180, Math.min(width, height) / 4);
  const fontSize = Math.max(14, Math.round(Math.min(width, height) / 40));
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "#111111";
  ctx.font = `600 ${fontSize}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.translate(width / 2, height / 2);
  ctx.rotate(-Math.PI / 6);
  ctx.translate(-width / 2, -height / 2);
  for (let y = -height; y < height * 2; y += step) {
    for (let x = -width; x < width * 2; x += step * 2) {
      ctx.fillText(text, x, y);
    }
  }
  // barra inferior mais legível
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  const barH = Math.max(24, fontSize + 10);
  ctx.fillRect(0, height - barH, width, barH);
  ctx.fillStyle = "#ffffff";
  ctx.font = `500 ${Math.max(11, fontSize - 2)}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(`  CÓPIA CONTROLADA · ${text}`, 6, height - barH / 2);
  ctx.restore();
}

export async function watermarkImageBlob(
  blob: Blob,
  payload: WatermarkPayload,
): Promise<Blob> {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.crossOrigin = "anonymous";
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    drawWatermarkOnCanvas(ctx, canvas.width, canvas.height, watermarkText(payload));
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Falha ao gerar imagem"))),
        blob.type || "image/png",
        0.92,
      ),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function renderPdfPagesAsWatermarkedImages(
  blob: Blob,
  payload: WatermarkPayload,
  opts: { scale?: number; maxPages?: number } = {},
): Promise<{ dataUrl: string; width: number; height: number }[]> {
  const pdfjs: any = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  const buf = await blob.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const scale = opts.scale ?? 1.4;
  const max = Math.min(doc.numPages, opts.maxPages ?? 20);
  const out: { dataUrl: string; width: number; height: number }[] = [];
  const text = watermarkText(payload);
  for (let n = 1; n <= max; n++) {
    const page = await doc.getPage(n);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvasContext: ctx, viewport }).promise;
    drawWatermarkOnCanvas(ctx, canvas.width, canvas.height, text);
    out.push({
      dataUrl: canvas.toDataURL("image/jpeg", 0.85),
      width: canvas.width,
      height: canvas.height,
    });
  }
  return out;
}

export function isImage(mime?: string | null) {
  return !!mime && mime.startsWith("image/");
}
export function isPdf(mime?: string | null) {
  return mime === "application/pdf";
}
