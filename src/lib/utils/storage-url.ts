import { supabase } from "@/integrations/supabase/client";

/**
 * Known storage buckets used in the financial system
 */
const KNOWN_BUCKETS = [
  'event-expense-docs',
  'department-expense-docs',
  'trade-docs',
  'photos',
  'avatars',
];

/**
 * Extracts the bucket name and file path from a Supabase storage URL.
 * Supports both public and signed URLs.
 */
export function parseBucketAndPath(url: string): { bucket: string; path: string } | null {
  try {
    const urlObj = new URL(url);
    // Pattern: /storage/v1/object/(public|sign)/<bucket>/<path>
    const match = urlObj.pathname.match(
      /\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)/
    );
    if (match) {
      return { bucket: match[1], path: decodeURIComponent(match[2].split('?')[0]) };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Extracts just the filename from a file path.
 */
function extractFilename(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1];
}

/**
 * Attempts to find a file by its name across all directories in the bucket.
 * This is used as a fallback when the exact path fails (e.g., due to temp→real ID mismatch).
 */
async function findFileInBucket(
  bucket: string,
  filename: string,
  expiresIn: number
): Promise<string | null> {
  try {
    // List top-level directories in the bucket
    const { data: folders, error: listError } = await supabase.storage
      .from(bucket)
      .list('', { limit: 200 });

    if (listError || !folders) return null;

    // Search in each folder for the matching file
    for (const folder of folders) {
      if (!folder.id && folder.name) {
        // It's a directory - look inside
        const { data: files } = await supabase.storage
          .from(bucket)
          .list(folder.name, { limit: 100 });

        if (files) {
          const match = files.find(f => f.name === filename);
          if (match) {
            const correctPath = `${folder.name}/${match.name}`;
            const { data: signedData } = await supabase.storage
              .from(bucket)
              .createSignedUrl(correctPath, expiresIn);

            if (signedData?.signedUrl) {
              return signedData.signedUrl;
            }
          }
        }
      }
    }

    return null;
  } catch (err) {
    console.warn('[storage-url] Error searching bucket:', err);
    return null;
  }
}

/**
 * Attempts to generate a signed URL for a stored file.
 * If the file is not found at the original path, tries to find it by filename
 * across all directories in the bucket (fallback for broken paths).
 * 
 * @param publicUrl - The public URL stored in the database
 * @param expiresIn - Signed URL expiration in seconds (default: 1 hour)
 * @returns Object with signedUrl on success, or error message on failure
 */
export async function resolveStorageUrl(
  publicUrl: string,
  expiresIn = 3600
): Promise<{ signedUrl: string | null; error: string | null }> {
  const parsed = parseBucketAndPath(publicUrl);

  if (!parsed) {
    // Not a storage URL — return as-is (could be an external link)
    return { signedUrl: publicUrl, error: null };
  }

  const { bucket, path } = parsed;

  try {
    // Try the direct path first
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);

    if (!error && data?.signedUrl) {
      return { signedUrl: data.signedUrl, error: null };
    }

    // Direct path failed — try fallback: search for the file by name
    console.warn(`[storage-url] Direct path failed for ${bucket}/${path}, trying fallback...`);
    const filename = extractFilename(path);

    if (filename) {
      const fallbackUrl = await findFileInBucket(bucket, filename, expiresIn);
      if (fallbackUrl) {
        console.log(`[storage-url] Found file via fallback: ${filename}`);
        return { signedUrl: fallbackUrl, error: null };
      }
    }

    // Both methods failed
    return {
      signedUrl: null,
      error: 'Arquivo não encontrado no armazenamento. O arquivo pode ter sido movido ou excluído.',
    };
  } catch (err) {
    console.error('[storage-url] Unexpected error:', err);
    return {
      signedUrl: null,
      error: 'Erro ao acessar o armazenamento de arquivos.',
    };
  }
}
