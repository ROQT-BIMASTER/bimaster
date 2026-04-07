import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Instagram, 
  Facebook, 
  Twitter, 
  Youtube, 
  Linkedin,
  MoreVertical,
  RefreshCw,
  Pencil,
  Trash2,
  CheckCircle,
  AlertCircle,
  Loader2,
  Eye
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AccountCardProps {
  account: {
    id: string;
    platform: string;
    username: string;
    account_name?: string;
    status: 'active' | 'error' | 'syncing' | 'inactive';
    last_sync_at?: string;
    error_message?: string;
    region?: string;
    account_group?: string;
  };
  metrics?: {
    followers: number;
    engagement: number;
    posts: number;
    reach: number;
  };
  onSync: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onViewDetails?: () => void;
}

const platformIcons: Record<string, any> = {
  instagram: Instagram,
  facebook: Facebook,
  twitter: Twitter,
  youtube: Youtube,
  linkedin: Linkedin,
};

const platformColors: Record<string, string> = {
  instagram: "text-pink-500",
  facebook: "text-blue-600",
  twitter: "text-sky-500",
  youtube: "text-red-600",
  linkedin: "text-blue-700",
};

const statusConfig = {
  active: { label: "Ativo", variant: "default" as const, icon: CheckCircle, color: "text-green-600" },
  error: { label: "Erro", variant: "destructive" as const, icon: AlertCircle, color: "text-red-600" },
  syncing: { label: "Sincronizando", variant: "secondary" as const, icon: Loader2, color: "text-blue-600" },
  inactive: { label: "Inativo", variant: "outline" as const, icon: AlertCircle, color: "text-muted-foreground" },
};

export const AccountCard = ({ account, metrics, onSync, onEdit, onDelete, onViewDetails }: AccountCardProps) => {
  const Icon = platformIcons[account.platform] || Instagram;
  const colorClass = platformColors[account.platform] || "text-gray-500";
  const status = statusConfig[account.status];
  const StatusIcon = status.icon;

  return (
    <Card className="p-4 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg bg-muted ${colorClass}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">
              {account.account_name || account.username}
            </h3>
            <p className="text-sm text-muted-foreground">@{account.username}</p>
            {account.region && (
              <Badge variant="outline" className="mt-1 text-xs">
                {account.region}
              </Badge>
            )}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onSync}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Sincronizar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="w-4 h-4 mr-2" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 className="w-4 h-4 mr-2" />
              Remover
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <Badge variant={status.variant} className="flex items-center gap-1">
          <StatusIcon className={`w-3 h-3 ${account.status === 'syncing' ? 'animate-spin' : ''}`} />
          {status.label}
        </Badge>
        {account.account_group && (
          <Badge variant="secondary" className="text-xs">
            {account.account_group}
          </Badge>
        )}
      </div>

      {account.error_message && (
        <div className="text-xs text-destructive mb-3 p-2 bg-destructive/10 rounded">
          {account.error_message}
        </div>
      )}

      {metrics && (
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Seguidores</p>
            <p className="font-semibold text-foreground">
              {metrics.followers.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Engajamento</p>
            <p className="font-semibold text-foreground">{metrics.engagement.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Posts</p>
            <p className="font-semibold text-foreground">{metrics.posts}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Alcance</p>
            <p className="font-semibold text-foreground">
              {metrics.reach.toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {account.last_sync_at && (
        <p className="text-xs text-muted-foreground mt-3">
          Última sincronização:{" "}
          {formatDistanceToNow(new Date(account.last_sync_at), {
            addSuffix: true,
            locale: ptBR,
          })}
        </p>
      )}

      {onViewDetails && account.platform === "instagram" && (
        <Button
          variant="outline"
          size="sm"
          className="w-full mt-3 gap-2"
          onClick={onViewDetails}
        >
          <Eye className="w-4 h-4" />
          Ver Detalhes
        </Button>
      )}
    </Card>
  );
};
