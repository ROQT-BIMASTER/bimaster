/**
 * Returns an avatar URL for an influencer.
 * Falls back to unavatar.io which fetches real profile pictures from social platforms.
 */
export function getInfluencerAvatarUrl(
  platform: string,
  username: string,
  existingUrl?: string | null
): string {
  if (existingUrl) return existingUrl;

  // unavatar.io supports: instagram, twitter, youtube, github, etc.
  const platformMap: Record<string, string> = {
    instagram: "instagram",
    tiktok: "tiktok",
    youtube: "youtube",
    twitter: "twitter",
    facebook: "facebook",
    linkedin: "linkedin",
  };

  const source = platformMap[platform.toLowerCase()];
  if (source) {
    return `https://unavatar.io/${source}/${username}`;
  }

  // Generic fallback
  return `https://unavatar.io/${username}`;
}
