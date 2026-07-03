/**
 * Helpers para o "esquema" `sb-storage://<bucket>/<path>` usado dentro do
 * texto da descrição de tarefas quando o usuário cola uma imagem.
 *
 * Guardamos apenas a referência estável (bucket + path) — nunca a signed URL,
 * que expira em 1 h. A resolução para URL assinada é feita no render.
 */
import { supabase } from "@/integrations/supabase/client";

const SCHEME = "sb-storage://";

export function toStorageRef(bucket: string, path: string): string {
  return `${SCHEME}${bucket}/${path}`;
}

export function parseStorageRef(url: string): { bucket: string; path: string } | null {
  if (!url || !url.startsWith(SCHEME)) return null;
  const rest = url.slice(SCHEME.length);
  const slash = rest.indexOf("/");
  if (slash <= 0) return null;
  return { bucket: rest.slice(0, slash), path: rest.slice(slash + 1) };
}

// Cache simples em memória (sessão) para não regerar signed URL a cada render.
// Chave = `${bucket}::${path}`, valor = { url, expiresAt (ms) }.
const cache = new Map<string, { url: string; expiresAt: number }>();
const TTL_MS = 55 * 60 * 1000; // renova antes de 1 h

export async function resolveStorageRef(url: string): Promise<string | null> {
  const ref = parseStorageRef(url);
  if (!ref) return null;
  const key = `${ref.bucket}::${ref.path}`;
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) return cached.url;
  const { data } = await supabase.storage.from(ref.bucket).createSignedUrl(ref.path, 3600);
  if (!data?.signedUrl) return null;
  cache.set(key, { url: data.signedUrl, expiresAt: now + TTL_MS });
  return data.signedUrl;
}

export function isStorageRef(url: string): boolean {
  return !!url && url.startsWith(SCHEME);
}
