import { useState, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface InfluencerAvatarProps {
  platform: string;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  className?: string;
}

function getInitials(name: string): string {
  return name
    .replace(/^@/, "")
    .substring(0, 2)
    .toUpperCase();
}

function buildFallbackChain(platform: string, username: string, avatarUrl?: string | null): string[] {
  const chain: string[] = [];
  const clean = username.replace(/^@/, "");

  // 1. Stored avatar_url from DB
  if (avatarUrl && !avatarUrl.includes("unavatar.io")) {
    chain.push(avatarUrl);
  }

  // 2. unavatar.io
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

  // 3. ui-avatars.com (always works)
  const displayForAvatar = clean.replace(/[._-]/g, "+");
  chain.push(`https://ui-avatars.com/api/?name=${displayForAvatar}&background=random&color=fff&size=128&bold=true`);

  return chain;
}

export function InfluencerAvatar({ platform, username, displayName, avatarUrl, className }: InfluencerAvatarProps) {
  const chain = buildFallbackChain(platform, username, avatarUrl);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [allFailed, setAllFailed] = useState(false);

  const initials = getInitials(displayName || username);

  const handleError = useCallback(() => {
    setCurrentIndex((prev) => {
      const next = prev + 1;
      if (next >= chain.length) {
        setAllFailed(true);
        return prev;
      }
      return next;
    });
  }, [chain.length]);

  return (
    <Avatar className={cn("h-12 w-12", className)}>
      {!allFailed && (
        <AvatarImage
          src={chain[currentIndex]}
          alt={displayName || username}
          onError={handleError}
        />
      )}
      <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
