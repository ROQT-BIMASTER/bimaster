import { useEffect, useState, type CSSProperties } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { resolveAvatarUrl } from "@/lib/utils/avatarUrl";
import { cn } from "@/lib/utils";
import { reportAvatarFailure } from "@/lib/telemetry/avatarTelemetry";

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
  /** Título customizado. Se omitido, monta `nome (identifier)` automaticamente. */
  title?: string;
  /**
   * Identificador secundário mostrado no tooltip (ex.: email, cargo, user_id
   * curto). Aparece como `Nome (identifier)`. Útil para desambiguar homônimos
   * ou expor o dono real do avatar quando a imagem falha.
   */
  identifier?: string | null;
  /** Nome fallback quando `nome` estiver vazio. Default: "Membro". */
  fallbackNome?: string;
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

// Paleta determinística (HSL) para fallback de avatar quando o usuário
// não tem `avatar_url`. Deriva o hue de um hash estável (identifier ou
// nome), garantindo que o mesmo usuário sempre veja a mesma cor — o pill
// não pisca entre renders nem depende do fetch pós-save.
const FALLBACK_SATURATION = 62;
const FALLBACK_LIGHTNESS = 46;

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function computeFallbackStyle(seed: string): CSSProperties {
  const hue = hashSeed(seed) % 360;
  return {
    backgroundColor: `hsl(${hue} ${FALLBACK_SATURATION}% ${FALLBACK_LIGHTNESS}%)`,
    color: "hsl(0 0% 100%)",
  };
}

function isUsableUrl(src?: string | null): src is string {
  if (!src) return false;
  const s = src.trim();
  if (!s || s === "null" || s === "undefined") return false;
  return true;
}

/**
 * Resolve o nome de exibição priorizando `fallbackNome` quando `nome`
 * for nulo, indefinido, apenas whitespace, uma das strings-lixo comuns
 * ("null"/"undefined") ou o placeholder genérico "Membro" (case-insensitive)
 * — nesse último caso, se o caller passou um `fallbackNome` custom, ele é
 * considerado autoritativo e vence o placeholder hidratado por RPC/RLS
 * incompleto. Assim o tooltip/aria refletem o nome mais específico
 * disponível para o SR.
 */
function resolveDisplayNome(
  nome: string | null | undefined,
  fallbackNome: string,
): string {
  const clean = (nome ?? "").trim();
  if (!clean) return fallbackNome;
  if (clean === "null" || clean === "undefined") return fallbackNome;
  if (
    fallbackNome !== "Membro" &&
    clean.toLowerCase() === "membro"
  ) {
    return fallbackNome;
  }
  return clean;
}

function buildTitle(
  nome: string | null | undefined,
  identifier: string | null | undefined,
  fallbackNome: string,
  errored: boolean,
): string {
  const displayNome = resolveDisplayNome(nome, fallbackNome);
  const idClean = identifier && String(identifier).trim() ? String(identifier).trim() : null;
  const base = idClean ? `${displayNome} (${idClean})` : displayNome;
  // Quando a imagem falhou explicitamente, sinaliza no tooltip para deixar
  // claro que o fallback textual é o dado autoritativo.
  return errored ? `${base} — foto indisponível` : base;
}

export function SmartAvatar({
  src,
  nome,
  className,
  fallbackClassName,
  title,
  identifier,
  fallbackNome = "Membro",
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

  const displayNome = resolveDisplayNome(nome, fallbackNome);
  const initials = computeInitials(displayNome);
  const showImage = usable && !errored && !!displayUrl;
  const resolvedTitle = title || buildTitle(nome, identifier, fallbackNome, errored);
  // Seed determinística: prioriza identifier (ex.: user_id) para estabilidade
  // entre renders com nomes hidratados de forma incremental.
  const fallbackSeed = String(identifier || displayNome || "?");
  const fallbackStyle = computeFallbackStyle(fallbackSeed);

  return (
    <Avatar className={className} title={resolvedTitle} aria-label={resolvedTitle}>
      {showImage && (
        <AvatarImage
          src={displayUrl}
          alt={resolvedTitle}
          onError={() => {
            setErrored(true);
            reportAvatarFailure({ src: displayUrl ?? src, nome, identifier });
          }}
        />
      )}
      <AvatarFallback
        className={cn("font-medium", fallbackClassName)}
        style={fallbackStyle}
        aria-label={resolvedTitle}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
