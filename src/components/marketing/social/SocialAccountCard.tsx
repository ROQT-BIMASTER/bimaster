import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Instagram, Youtube, Facebook, Twitter, CheckCircle2, Users } from "lucide-react";

const platformConfig: Record<string, { icon: typeof Instagram; label: string; color: string }> = {
  instagram: { icon: Instagram, label: "Instagram", color: "bg-pink-500/10 text-pink-600" },
  youtube: { icon: Youtube, label: "YouTube", color: "bg-red-500/10 text-red-600" },
  facebook: { icon: Facebook, label: "Facebook", color: "bg-blue-500/10 text-blue-600" },
  twitter: { icon: Twitter, label: "Twitter/X", color: "bg-sky-500/10 text-sky-600" },
  tiktok: { icon: Instagram, label: "TikTok", color: "bg-purple-500/10 text-purple-600" },
};

interface Props {
  account: {
    id: string;
    username: string | null;
    platform: string | null;
    avatar_url: string | null;
    follower_count: number | null;
    following_count: number | null;
    status: string | null;
    last_synced_at: string | null;
  };
  onClick: () => void;
}

export function SocialAccountCard({ account, onClick }: Props) {
  const platform = platformConfig[account.platform?.toLowerCase() || ""] || platformConfig.instagram;
  const PlatformIcon = platform.icon;

  return (
    <Card className="cursor-pointer hover:border-primary/30 transition-colors" onClick={onClick}>
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <Avatar className="h-12 w-12">
            {account.avatar_url && <AvatarImage src={account.avatar_url} alt={account.username || ""} />}
            <AvatarFallback className={platform.color}>
              <PlatformIcon className="h-6 w-6" />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">
              @{account.username || "sem-nome"}
            </h3>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {(account.follower_count ?? 0).toLocaleString("pt-BR")} seguidores
              </span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className={platform.color}>
                {platform.label}
              </Badge>
              <Badge variant="default" className="text-xs">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Ativo
              </Badge>
            </div>
            {account.last_synced_at && (
              <p className="text-xs text-muted-foreground mt-2">
                Última sincronização: {new Date(account.last_synced_at).toLocaleDateString("pt-BR")}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
