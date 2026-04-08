const VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov", ".m4v", ".ogg", ".m3u8"];
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".svg"];

function getUrlPath(url: string) {
  try {
    return new URL(url).pathname.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function hasKnownExtension(url: string, extensions: string[]) {
  const path = getUrlPath(url);
  return extensions.some((extension) => path.endsWith(extension));
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function isLikelyVideoUrl(url?: string | null) {
  if (!url) return false;
  const normalized = url.toLowerCase();
  return (
    normalized.startsWith("data:video/") ||
    hasKnownExtension(normalized, VIDEO_EXTENSIONS) ||
    normalized.includes("video/") ||
    normalized.includes("mime=video") ||
    normalized.includes("content_type=video")
  );
}

export function isLikelyImageUrl(url?: string | null) {
  if (!url) return false;
  const normalized = url.toLowerCase();
  return (
    normalized.startsWith("data:image/") ||
    hasKnownExtension(normalized, IMAGE_EXTENSIONS) ||
    normalized.includes("picsum.photos") ||
    normalized.includes("unsplash.com") ||
    normalized.includes("placehold.co") ||
    normalized.includes("image/")
  );
}

export function buildPostPlaceholderDataUrl({
  caption,
  postType,
}: {
  caption?: string | null;
  postType?: string | null;
}) {
  const label = (postType || "post").toUpperCase();
  // Strip any characters that could break URI encoding (surrogates, control chars)
  const rawText = (caption || "Prévia indisponível").trim().slice(0, 72) || "Prévia indisponível";
  const text = rawText.replace(/[\uD800-\uDFFF]/g, "").replace(/[^\x20-\x7E\u00A0-\uFFFF]/g, "");
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675" role="img" aria-label="Prévia do post">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="hsl(222 47% 11%)" />
          <stop offset="100%" stop-color="hsl(221 39% 18%)" />
        </linearGradient>
      </defs>
      <rect width="1200" height="675" fill="url(#bg)" rx="36" />
      <circle cx="1020" cy="130" r="140" fill="hsl(217 91% 60% / 0.18)" />
      <circle cx="180" cy="560" r="180" fill="hsl(199 89% 48% / 0.12)" />
      <rect x="72" y="72" width="180" height="52" rx="26" fill="hsl(210 40% 96% / 0.12)" />
      <text x="162" y="106" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="white" font-weight="700">${escapeXml(label)}</text>
      <text x="72" y="240" font-family="Arial, sans-serif" font-size="58" fill="white" font-weight="700">Prévia do post</text>
      <foreignObject x="72" y="285" width="1056" height="220">
        <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Arial, sans-serif; color: rgba(255,255,255,0.82); font-size: 34px; line-height: 1.35;">
          ${escapeXml(text)}
        </div>
      </foreignObject>
      <text x="72" y="596" font-family="Arial, sans-serif" font-size="24" fill="rgba(255,255,255,0.62)">Abrir post original para ver a mídia completa</text>
    </svg>`;

  try {
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  } catch {
    // Fallback to base64 if encodeURIComponent fails
    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg.replace(/[^\x00-\x7F]/g, ""))))}`;
  }
}

/**
 * Check if a URL is a Supabase Storage path (not a full URL).
 * Storage paths look like: "uuid/uuid.jpg" (no http prefix).
 */
export function isStoragePath(url?: string | null): boolean {
  if (!url) return false;
  return !url.startsWith("http") && !url.startsWith("data:") && url.includes("/");
}

/**
 * Build a signed URL for a storage path using the Supabase client.
 * Must be called from React context where supabase client is available.
 */
export function buildStorageUrl(storagePath: string): string {
  // Build public URL using the known Supabase URL pattern
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) return storagePath;
  return `${supabaseUrl}/storage/v1/object/authenticated/post-media/${storagePath}`;
}

export function getPostMediaSource(post: {
  thumbnail_url?: string | null;
  post_url?: string | null;
  post_type?: string | null;
  caption?: string | null;
}) {
  const thumbnailUrl = post.thumbnail_url?.trim() || "";
  const postUrl = post.post_url?.trim() || "";
  const fallback = buildPostPlaceholderDataUrl({
    caption: post.caption,
    postType: post.post_type,
  });

  if (thumbnailUrl) {
    // If it's a storage path, we need to resolve it via signed URL
    if (isStoragePath(thumbnailUrl)) {
      return { kind: "storage" as const, src: thumbnailUrl, fallback, storagePath: thumbnailUrl };
    }

    if (isLikelyVideoUrl(thumbnailUrl)) {
      return { kind: "video" as const, src: thumbnailUrl, fallback };
    }

    return { kind: "image" as const, src: thumbnailUrl, fallback };
  }

  if (postUrl && isLikelyVideoUrl(postUrl)) {
    return { kind: "video" as const, src: postUrl, fallback };
  }

  if (postUrl && isLikelyImageUrl(postUrl)) {
    return { kind: "image" as const, src: postUrl, fallback };
  }

  return { kind: "placeholder" as const, src: fallback, fallback };
}