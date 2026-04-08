import { supabase } from "@/integrations/supabase/client";
import { resolveStorageUrl, parseBucketAndPath } from "@/lib/utils/storage-url";

/**
 * Resolves a storage URL (signed, public, or plain path) into bucket + path,
 * then downloads the file as a Blob via Supabase SDK (bypasses ad blockers).
 */
async function resolveToStoragePath(urlOrPath: string): Promise<{ bucket: string; path: string } | null> {
  if (!urlOrPath) return null;

  // Plain path (no protocol) — assume fabrica-custo-evidencias bucket
  if (!urlOrPath.startsWith("http")) {
    return { bucket: "fabrica-custo-evidencias", path: urlOrPath };
  }

  // Full URL — extract bucket and path
  const parsed = parseBucketAndPath(urlOrPath);
  return parsed;
}

/**
 * Downloads a file from storage as a Blob URL.
 * Uses Supabase SDK download() which bypasses browser ad blockers.
 */
export async function downloadStorageBlob(
  urlOrPath: string
): Promise<{ blobUrl: string; error: string | null }> {
  try {
    const resolved = await resolveToStoragePath(urlOrPath);

    if (!resolved) {
      return { blobUrl: "", error: "Não foi possível resolver o caminho do arquivo" };
    }

    const { data, error } = await supabase.storage
      .from(resolved.bucket)
      .download(resolved.path);

    if (error || !data) {
      return { blobUrl: "", error: error?.message || "Erro ao baixar arquivo" };
    }

    const blobUrl = URL.createObjectURL(data);
    return { blobUrl, error: null };
  } catch (err: any) {
    return { blobUrl: "", error: err.message || "Erro inesperado ao baixar arquivo" };
  }
}
