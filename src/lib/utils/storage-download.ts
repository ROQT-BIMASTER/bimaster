import { supabase } from "@/integrations/supabase/client";
import { parseBucketAndPath } from "@/lib/utils/storage-url";

/**
 * Resolves a storage URL (signed, public, or plain path) into bucket + path,
 * then downloads the file as a Blob via Supabase SDK (bypasses ad blockers).
 */
function resolveToStoragePath(urlOrPath: string): { bucket: string; path: string } | null {
  if (!urlOrPath) return null;

  // Plain path (no protocol) — assume fabrica-custo-evidencias bucket
  if (!urlOrPath.startsWith("http")) {
    return { bucket: "fabrica-custo-evidencias", path: urlOrPath };
  }

  // Full URL — extract bucket and path
  return parseBucketAndPath(urlOrPath);
}

function getFilenameFromPath(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1] || 'arquivo';
}

function getMimeFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    bmp: 'image/bmp',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    txt: 'text/plain',
    csv: 'text/csv',
  };
  return map[ext || ''] || 'application/octet-stream';
}

export interface StorageBlobResult {
  blob: Blob | null;
  blobUrl: string;
  contentType: string;
  filename: string;
  error: string | null;
}

/**
 * Downloads a file from storage as a Blob with metadata.
 * Uses Supabase SDK download() which bypasses browser ad blockers.
 */
export async function downloadStorageBlob(
  urlOrPath: string,
  originalFilename?: string
): Promise<StorageBlobResult> {
  const empty: StorageBlobResult = { blob: null, blobUrl: "", contentType: "", filename: "", error: null };

  try {
    const resolved = resolveToStoragePath(urlOrPath);

    if (!resolved) {
      return { ...empty, error: "Não foi possível resolver o caminho do arquivo" };
    }

    const { data, error } = await supabase.storage
      .from(resolved.bucket)
      .download(resolved.path);

    if (error || !data) {
      return { ...empty, error: error?.message || "Erro ao baixar arquivo" };
    }

    const filename = originalFilename || getFilenameFromPath(resolved.path);
    const contentType = data.type && data.type !== 'application/octet-stream'
      ? data.type
      : getMimeFromFilename(filename);

    const typedBlob = new Blob([data], { type: contentType });
    const blobUrl = URL.createObjectURL(typedBlob);

    return { blob: typedBlob, blobUrl, contentType, filename, error: null };
  } catch (err: any) {
    return { ...empty, error: err.message || "Erro inesperado ao baixar arquivo" };
  }
}

/**
 * Triggers a secure download of a file without window.open.
 */
export function triggerBlobDownload(blobUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
}
