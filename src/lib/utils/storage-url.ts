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
      /\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)/
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
 * Attempts to generate a signed URL for a stored file.
 * If the file is not found at the original path, returns an error.
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
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);

    if (error) {
      console.warn(`[storage-url] Signed URL failed for ${bucket}/${path}:`, error.message);
      return {
        signedUrl: null,
        error: 'Arquivo não encontrado no armazenamento. O arquivo pode ter sido movido ou excluído.',
      };
    }

    return { signedUrl: data.signedUrl, error: null };
  } catch (err) {
    console.error('[storage-url] Unexpected error:', err);
    return {
      signedUrl: null,
      error: 'Erro ao acessar o armazenamento de arquivos.',
    };
  }
}
