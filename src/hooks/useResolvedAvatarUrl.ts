import { useState, useEffect } from "react";
import { resolveStorageUrl } from "@/lib/utils/storage-url";

/**
 * Resolves an avatar URL, converting legacy public URLs to signed URLs.
 * Returns the resolved URL or undefined while loading.
 */
export function useResolvedAvatarUrl(avatarUrl: string | null | undefined): string | undefined {
  const [resolved, setResolved] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!avatarUrl) {
      setResolved(undefined);
      return;
    }

    // If it's already a signed URL or external URL, use as-is
    if (avatarUrl.includes("/sign/") || !avatarUrl.includes("/storage/v1/object/public/avatars/")) {
      setResolved(avatarUrl);
      return;
    }

    let cancelled = false;
    resolveStorageUrl(avatarUrl).then(({ signedUrl }) => {
      if (!cancelled) setResolved(signedUrl || undefined);
    });

    return () => { cancelled = true; };
  }, [avatarUrl]);

  return resolved;
}
