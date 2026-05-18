import { downloadStorageBlob, triggerBlobDownload } from "@/lib/utils/storage-download";
import { toast } from "sonner";

/**
 * Securely downloads a file: tries storage SDK first (bypasses ad blockers,
 * applies RLS, no signed URL leaks), falls back to safe window.open with
 * noopener,noreferrer for true external links.
 */
export async function secureDownload(
  urlOrPath: string,
  filename?: string,
  bucketHint?: string,
): Promise<void> {
  if (!urlOrPath) {
    toast.error("Arquivo indisponível.");
    return;
  }

  const result = await downloadStorageBlob(urlOrPath, filename, bucketHint);
  if (result.blobUrl) {
    triggerBlobDownload(result.blobUrl, result.filename);
    return;
  }

  // True external (not in any storage bucket) — open safely
  if (urlOrPath.startsWith("http")) {
    window.open(urlOrPath, "_blank", "noopener,noreferrer");
    return;
  }

  toast.error(result.error || "Não foi possível baixar o arquivo.");
}
