import { useState, useEffect } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface InfluencerAvatarProps {
  platform: string;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  className?: string;
}

function getInitials(name: string): string {
  return name.replace(/^@/, "").substring(0, 2).toUpperCase();
}

function buildFallbackChain(platform: string, username: string, avatarUrl?: string | null): string[] {
  const chain: string[] = [];
  const clean = username.replace(/^@/, "");

  if (avatarUrl && !avatarUrl.includes("unavatar.io")) {
    chain.push(avatarUrl);
  }

  const platformMap: Record<string, string> = {
    instagram: "instagram",
    tiktok: "tiktok",
    youtube: "youtube",
    twitter: "twitter",
    facebook: "facebook",
    linkedin: "linkedin",
  };
  const source = platformMap[platform.toLowerCase()];
  chain.push(source ? `https://unavatar.io/${source}/${clean}` : `https://unavatar.io/${clean}`);

  const displayForAvatar = (clean || "U").replace(/[._-]/g, "+");
  chain.push(`https://ui-avatars.com/api/?name=${displayForAvatar}&background=random&color=fff&size=128&bold=true`);

  return chain;
}

function useImageWithFallback(chain: string[]): string | null {
  const [validSrc, setValidSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function tryLoad() {
      for (const url of chain) {
        if (cancelled) return;
        const ok = await testImage(url);
        if (cancelled) return;
        if (ok) {
          setValidSrc(url);
          return;
        }
      }
      setValidSrc(null);
    }

    setValidSrc(null);
    tryLoad();

    return () => { cancelled = true; };
  }, [chain.join("|")]);

  return validSrc;
}

function testImage(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    const timeout = setTimeout(() => { resolve(false); }, 4000);
    img.onload = () => { clearTimeout(timeout); resolve(img.naturalWidth > 1); };
    img.onerror = () => { clearTimeout(timeout); resolve(false); };
    img.src = src;
  });
}

export function InfluencerAvatar({ platform, username, displayName, avatarUrl, className }: InfluencerAvatarProps) {
  const chain = buildFallbackChain(platform, username, avatarUrl);
  const validSrc = useImageWithFallback(chain);
  const initials = getInitials(displayName || username);

  return (
    <Avatar className={cn("h-12 w-12", className)}>
      {validSrc && (
        <img
          src={validSrc}
          alt={displayName || username}
          className="aspect-square h-full w-full object-cover"
        />
      )}
      {!validSrc && (
        <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
          {initials}
        </AvatarFallback>
      )}
    </Avatar>
  );
}
