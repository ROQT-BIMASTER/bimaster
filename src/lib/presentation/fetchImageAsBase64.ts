import { logger } from "@/lib/logger";
/**
 * Baixa uma URL pública (Supabase Storage) e converte em base64 dataURL.
 * Retorna null em caso de falha (CORS, 404, etc.) para não quebrar a apresentação.
 */
export async function fetchImageAsBase64(
  url: string,
): Promise<{ dataUrl: string; mime: string } | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const mime = blob.type || "image/jpeg";
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    return { dataUrl, mime };
  } catch (err) {
    logger.warn("[presentation] Falha ao baixar imagem:", url, err);
    return null;
  }
}

/** Extrai apenas o payload base64 (sem o prefixo data:...;base64,) */
export function stripDataUrl(dataUrl: string): string {
  const idx = dataUrl.indexOf(",");
  return idx === -1 ? dataUrl : dataUrl.slice(idx + 1);
}
