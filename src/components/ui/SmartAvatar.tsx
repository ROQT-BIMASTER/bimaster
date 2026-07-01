import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { resolveAvatarUrl } from "@/lib/utils/avatarUrl";
import { cn } from "@/lib/utils";

// Cache de URLs já resolvidas nesta sessão — evita chamar createSignedUrl
// múltiplas vezes para o mesmo path enquanto rolamos listas grandes de
// membros/colaboradores.
const resolvedCache = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();

async function resolveOnce(url: string): Promise<string> {
  if (resolvedCache.has(url)) return resolvedCache.get(url)!;
  let promise = inflight.get(url);
  if (!promise) {
    promise = resolveAvatarUrl(url).catch(() => null);
    inflight.set(url, promise);
  }
  const fresh = (await promise) || url;
  resolvedCache.set(url, fresh);
  inflight.delete(url);
  return fresh;
}

interface SmartAvatarProps {
  src?: string | null;
  nome?: string | null;
  className?: string;
  fallbackClassName?: string;
  title?: string;
}

/**
 * Avatar que auto-resolve signed URLs quebradas/expiradas para o bucket
 * privado `avatars`. Substitui o padrão `<Avatar><AvatarImage src=...>`
 * onde a URL pode ter sido persistida como `getPublicUrl` legada.
 */
function computeInitials(nome?: string | null): string {
  const clean = (nome || "").trim();
  if (!clean) return "?";
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function isUsableUrl(src?: string | null): src is string {
  if (!src) return false;
  const s = src.trim();
  if (!s || s === "null" || s === "undefined") return false;
  return true;
}

export function SmartAvatar({
  src,
  nome,
  className,
  fallbackClassName,
  title,
}: SmartAvatarProps) {
  const usable = isUsableUrl(src);
  const [displayUrl, setDisplayUrl] = useState<string | undefined>(() =>
    usable && resolvedCache.has(src!) ? resolvedCache.get(src!) : usable ? src! : undefined,
  );
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    let alive = true;
    setErrored(false);
    if (!usable) {
      setDisplayUrl(undefined);
      return;
    }
    if (resolvedCache.has(src!)) {
      setDisplayUrl(resolvedCache.get(src!));
      return;
    }
    setDisplayUrl(src!);
    void resolveOnce(src!).then((fresh) => {
      if (alive) setDisplayUrl(fresh);
    });
    return () => {
      alive = false;
    };
  }, [src, usable]);

  const initials = computeInitials(nome);
  const showImage = usable && !errored && !!displayUrl;

  return (
    <Avatar className={className} title={title || nome || undefined}>
      {showImage && (
        <AvatarImage
          src={displayUrl}
          alt={nome || ""}
          onError={() => setErrored(true)}
        />
      )}
      <AvatarFallback className={cn("bg-primary/15 text-primary font-medium", fallbackClassName)}>
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
