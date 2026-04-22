import JSZip from "jszip";
import { fetchImageAsBase64, stripDataUrl } from "./fetchImageAsBase64";
import type { PresentationGroup, PresentationPlan } from "./types";

function sanitizeFolder(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 _-]/g, "")
    .trim()
    .slice(0, 60) || "loja";
}

function extFromMime(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  return "jpg";
}

export async function buildTradePresentationImageZip(
  plan: PresentationPlan,
  groups: PresentationGroup[],
): Promise<Blob> {
  const zip = new JSZip();
  const root = zip.folder("apresentacao") || zip;

  const manifestLines: string[] = [];
  manifestLines.push(`Apresentação: ${plan.title}`);
  if (plan.client) manifestLines.push(`Cliente: ${plan.client}`);
  if (plan.objective) manifestLines.push(`Objetivo: ${plan.objective}`);
  manifestLines.push(`Total de PDVs: ${groups.length}`);
  manifestLines.push(`Gerado em: ${new Date().toLocaleString("pt-BR")}`);
  manifestLines.push("");
  manifestLines.push("===== PDVs =====");

  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    const folderName = `${String(i + 1).padStart(2, "0")} - ${sanitizeFolder(g.storeName)}`;
    const folder = root.folder(folderName);
    if (!folder) continue;

    manifestLines.push("");
    manifestLines.push(`${folderName}/`);
    manifestLines.push(`  Loja: ${g.storeName}`);
    if (g.storeAddress) manifestLines.push(`  Endereço: ${g.storeAddress}`);
    manifestLines.push(`  Data: ${new Date(g.date).toLocaleDateString("pt-BR")}`);

    if (g.beforeUrl) {
      const img = await fetchImageAsBase64(g.beforeUrl);
      if (img) {
        folder.file(`antes.${extFromMime(img.mime)}`, stripDataUrl(img.dataUrl), {
          base64: true,
        });
      }
    }
    if (g.afterUrl) {
      const img = await fetchImageAsBase64(g.afterUrl);
      if (img) {
        folder.file(`depois.${extFromMime(img.mime)}`, stripDataUrl(img.dataUrl), {
          base64: true,
        });
      }
    }

    const note = plan.notesByKey[g.key]?.trim();
    if (note) {
      folder.file("observacao.txt", note);
      manifestLines.push(`  Observação: ${note}`);
    }
  }

  root.file("manifest.txt", manifestLines.join("\n"));

  return zip.generateAsync({ type: "blob" });
}
