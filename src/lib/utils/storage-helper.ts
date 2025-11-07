import { supabase } from "@/integrations/supabase/client";

/**
 * Comprime uma imagem mantendo qualidade aceitável para mobile
 */
export async function compressImage(file: File, maxWidth = 1200, quality = 0.8): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Redimensionar se necessário
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'));
              return;
            }
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => reject(new Error('Failed to load image'));
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
  });
}

/**
 * Faz upload de arquivo e retorna o caminho (não URL pública)
 */
export async function uploadFile(
  bucket: string,
  filePath: string,
  file: File
): Promise<{ path: string; error: Error | null }> {
  try {
    const { error } = await supabase.storage.from(bucket).upload(filePath, file, {
      upsert: false,
    });

    if (error) throw error;

    return { path: filePath, error: null };
  } catch (error) {
    return { path: '', error: error as Error };
  }
}

/**
 * Gera URL assinada com expiração (signed URL)
 * @param bucket Nome do bucket
 * @param path Caminho do arquivo
 * @param expiresIn Tempo de expiração em segundos (padrão: 1 hora)
 */
export async function getSignedUrl(
  bucket: string,
  path: string,
  expiresIn = 3600
): Promise<{ signedUrl: string | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);

    if (error) throw error;

    return { signedUrl: data.signedUrl, error: null };
  } catch (error) {
    return { signedUrl: null, error: error as Error };
  }
}

/**
 * Gera múltiplas URLs assinadas de forma eficiente
 */
export async function getSignedUrls(
  bucket: string,
  paths: string[],
  expiresIn = 3600
): Promise<{ signedUrls: Record<string, string>; errors: Record<string, Error> }> {
  const signedUrls: Record<string, string> = {};
  const errors: Record<string, Error> = {};

  await Promise.all(
    paths.map(async (path) => {
      const { signedUrl, error } = await getSignedUrl(bucket, path, expiresIn);
      if (signedUrl) {
        signedUrls[path] = signedUrl;
      }
      if (error) {
        errors[path] = error;
      }
    })
  );

  return { signedUrls, errors };
}

/**
 * Extrai o caminho do arquivo de uma URL pública ou assinada
 */
export function extractPathFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/(public|sign)\/([^/]+)\/(.+)/);
    if (pathMatch) {
      return pathMatch[3]; // Retorna o caminho após o bucket
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Converte URL pública para signed URL (para migração gradual)
 */
export async function migratePublicUrlToSigned(
  publicUrl: string,
  bucket: string,
  expiresIn = 3600
): Promise<string | null> {
  const path = extractPathFromUrl(publicUrl);
  if (!path) return publicUrl; // Se não conseguir extrair, retorna a original

  const { signedUrl } = await getSignedUrl(bucket, path, expiresIn);
  return signedUrl || publicUrl;
}
