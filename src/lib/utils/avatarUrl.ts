import { supabase } from "@/integrations/supabase/client";

/**
 * Bucket `avatars` é privado (workspace bloqueia buckets públicos).
 * O upload correto salva uma signed URL de 1 ano. Porém existem registros
 * legados com `getPublicUrl(...)` (que retorna algo como
 * `/storage/v1/object/public/avatars/<uid>/avatar-...png`) — essas URLs
 * respondem 400 e a foto "some" quando o cache do navegador expira.
 * Também precisamos re-assinar signed URLs próximas do vencimento.
 *
 * Esta função extrai o path do arquivo dentro do bucket e devolve uma
 * URL assinada nova quando detecta que a URL é inválida ou está expirada.
 * Se não conseguir extrair o path, retorna a URL original inalterada.
 */
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 365; // 1 ano
const REFRESH_IF_EXPIRES_WITHIN_SECONDS = 60 * 60 * 24 * 30; // 30 dias

function extractAvatarPath(url: string): string | null {
  try {
    const u = new URL(url);
    // Padrões possíveis:
    //   /storage/v1/object/public/avatars/<path>
    //   /storage/v1/object/sign/avatars/<path>?token=...
    //   /storage/v1/object/authenticated/avatars/<path>
    const match = u.pathname.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/avatars\/(.+)$/);
    if (match?.[1]) return decodeURIComponent(match[1]);
    return null;
  } catch {
    return null;
  }
}

function signedUrlNeedsRefresh(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.pathname.includes("/object/public/")) return true; // bucket privado — publicUrl não funciona
    if (!u.pathname.includes("/object/sign/")) return false;
    const token = u.searchParams.get("token");
    if (!token) return true;
    // JWT: header.payload.signature
    const payload = token.split(".")[1];
    if (!payload) return true;
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    if (typeof decoded?.exp !== "number") return false;
    const now = Math.floor(Date.now() / 1000);
    return decoded.exp - now < REFRESH_IF_EXPIRES_WITHIN_SECONDS;
  } catch {
    return false;
  }
}

/**
 * Devolve uma URL exibível para o avatar. Se necessário, gera e persiste
 * uma nova signed URL de longa duração no `profiles.avatar_url`.
 */
export async function resolveAvatarUrl(
  storedUrl: string | null | undefined,
  opts?: { profileId?: string; persist?: boolean },
): Promise<string | null> {
  if (!storedUrl) return null;
  if (!signedUrlNeedsRefresh(storedUrl)) return storedUrl;

  const path = extractAvatarPath(storedUrl);
  if (!path) return storedUrl; // não é URL do nosso bucket — devolve como está

  try {
    const { data, error } = await supabase.storage
      .from("avatars")
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (error || !data?.signedUrl) return storedUrl;
    const fresh = data.signedUrl;
    if (opts?.persist && opts.profileId) {
      // best-effort — não bloqueia o retorno
      supabase
        .from("profiles")
        .update({ avatar_url: fresh })
        .eq("id", opts.profileId)
        .then(() => undefined);
    }
    return fresh;
  } catch {
    return storedUrl;
  }
}
