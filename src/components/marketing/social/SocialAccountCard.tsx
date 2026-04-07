import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Instagram, Youtube, Facebook, Twitter, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

const platformConfig: Record<string, { icon: typeof Instagram; label: string; color: string }> = {
  instagram: { icon: Instagram, label: "Instagram", color: "bg-pink-500/10 text-pink-600" },
  youtube: { icon: Youtube, label: "YouTube", color: "bg-red-500/10 text-red-600" },
  facebook: { icon: Facebook, label: "Facebook", color: "bg-blue-500/10 text-blue-600" },
  twitter: { icon: Twitter, label: "Twitter/X", color: "bg-sky-500/10 text-sky-600" },
  tiktok: { icon: Instagram, label: "TikTok", color: "bg-purple-500/10 text-purple-600" },
};

const statusConfig: Record<string, { icon: typeof CheckCircle2; label: string; variant: "default" | "secondary" | "destructive" }> = {
  active: { icon: CheckCircle2, label: "Ativo", variant: "default" },
  syncing: { icon: Loader2, label: "Sincronizando", variant: "secondary" },
  error: { icon: AlertCircle, label: "Erro", variant: "destructive" },
};

interface Props {
  account: {
    id: string | null;
    username: string | null;
    account_name: string | null;
    platform: string | null;
    status: string | null;
    has_token: boolean | null;
    last_sync_at: string | null;
  };
  onClick: () => void;
}

export function SocialAccountCard({ account, onClick }: Props) {
  const platform = platformConfig[account.platform?.toLowerCase() || ""] || platformConfig.instagram;
  const status = statusConfig[account.status || "active"] || statusConfig.active;
  const PlatformIcon = platform.icon;
  const StatusIcon = status.icon;

  return (
    <Card className="cursor-pointer hover:border-primary/30" onClick={onClick}>
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <Avatar className="h-12 w-12">
            <AvatarFallback className={platform.color}>
              <PlatformIcon className="h-6 w-6" />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground truncate">
                {account.account_name || account.username || "Sem nome"}
              </h3>
            </div>
            <p className="text-sm text-muted-foreground truncate">@{account.username}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className={platform.color}>
                {platform.label}
              </Badge>
              <Badge variant={status.variant} className="text-xs">
                <StatusIcon className={`h-3 w-3 mr-1 ${account.status === "syncing" ? "animate-spin" : ""}`} />
                {status.label}
              </Badge>
            </div>
            {account.last_sync_at && (
              <p className="text-xs text-muted-foreground mt-2">
                Última sincronização: {new Date(account.last_sync_at).toLocaleDateString("pt-BR")}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
