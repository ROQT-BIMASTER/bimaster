import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ExternalLink, TrendingUp, Users, Heart, MessageCircle, Trash2, Sparkles,
  Shield, MapPin, BadgeCheck, Globe, Lock, RefreshCw, Loader2, Database,
} from "lucide-react";
import { InfluencerProfile360 } from "./InfluencerProfile360";
import { InfluencerAvatar } from "./InfluencerAvatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Influencer {
  id: string;
  platform: string;
  username: string;
  display_name: string | null;
  profile_url: string | null;
  avatar_url: string | null;
  followers_count: number;
  engagement_rate: number;
  avg_likes: number;
  avg_comments: number;
  fraud_score: number | null;
  status: string;
  notes: string | null;
  regiao?: string | null;
  uf?: string | null;
  bio?: string | null;
  is_verified?: boolean | null;
  is_private?: boolean | null;
  business_category?: string | null;
  external_url?: string | null;
  data_source?: string | null;
  last_synced_at?: string | null;
}

interface Props {
  influencer: Influencer;
  onDelete: (id: string) => void;
  onSynced?: () => void;
}

const platformColors: Record<string, string> = {
  instagram: "bg-pink-500/10 text-pink-600 border-pink-200",
  tiktok: "bg-slate-900/10 text-slate-700 border-slate-300",
  youtube: "bg-red-500/10 text-red-600 border-red-200",
  twitter: "bg-blue-400/10 text-blue-500 border-blue-200",
  facebook: "bg-blue-600/10 text-blue-700 border-blue-300",
  linkedin: "bg-blue-700/10 text-blue-800 border-blue-300",
};

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "há minutos";
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `há ${d}d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function InfluencerProfileCard({ influencer, onDelete, onSynced }: Props) {
  const [show360, setShow360] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const handleSync = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("apify-sync-influencer", {
        body: { influencer_id: influencer.id },
      });
      if (error) throw error;
      const r = data?.data?.results?.[0];
      if (r?.ok) {
        toast.success(`@${influencer.username} atualizado · ${r.posts_upserted || 0} posts`);
        onSynced?.();
      } else {
        toast.error(r?.error || "Falha na atualização");
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao sincronizar");
    } finally {
      setSyncing(false);
    }
  };

  const isApify = influencer.data_source === "apify";

  return (
    <TooltipProvider delayDuration={200}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setShow360(true)}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <InfluencerAvatar
                platform={influencer.platform}
                username={influencer.username}
                displayName={influencer.display_name}
                avatarUrl={influencer.avatar_url}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <h3 className="font-semibold text-sm truncate">
                    {influencer.display_name || influencer.username}
                  </h3>
                  {influencer.is_verified && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <BadgeCheck className="h-4 w-4 text-blue-500 flex-shrink-0" />
                      </TooltipTrigger>
                      <TooltipContent>Conta verificada</TooltipContent>
                    </Tooltip>
                  )}
                  {influencer.is_private && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Lock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      </TooltipTrigger>
                      <TooltipContent>Conta privada</TooltipContent>
                    </Tooltip>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">@{influencer.username}</p>
              </div>
            </div>
            <Badge variant="outline" className={`${platformColors[influencer.platform] || ""} flex-shrink-0`}>
              {influencer.platform}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {influencer.bio && (
            <p className="text-xs text-muted-foreground line-clamp-1 italic">
              {influencer.bio}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{formatNumber(influencer.followers_count)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{influencer.engagement_rate}%</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Heart className="h-4 w-4 text-muted-foreground" />
              <span>{formatNumber(influencer.avg_likes)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
              <span>{formatNumber(influencer.avg_comments)}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {influencer.business_category && (
              <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                {influencer.business_category}
              </Badge>
            )}
            {(influencer.uf || influencer.regiao) && (
              <Badge variant="outline" className="text-[10px] py-0 px-1.5 gap-1">
                <MapPin className="h-2.5 w-2.5" />
                {influencer.uf}{influencer.regiao ? ` · ${influencer.regiao}` : ""}
              </Badge>
            )}
            {influencer.external_url && (
              <Tooltip>
                <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <a
                    href={influencer.external_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center"
                  >
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 gap-1 hover:bg-accent">
                      <Globe className="h-2.5 w-2.5" />
                      site
                    </Badge>
                  </a>
                </TooltipTrigger>
                <TooltipContent>{influencer.external_url}</TooltipContent>
              </Tooltip>
            )}
          </div>

          {influencer.fraud_score !== null && influencer.fraud_score !== undefined && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1">
                <Shield className="h-3 w-3" /> Autenticidade
              </span>
              <Badge
                variant={influencer.fraud_score >= 70 ? "default" : "destructive"}
                className="text-xs"
              >
                {influencer.fraud_score}%
              </Badge>
            </div>
          )}

          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1">
                  <Database className="h-2.5 w-2.5" />
                  {isApify ? "Verificado" : (influencer.data_source || "manual")}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {isApify
                  ? "Dados sincronizados via fonte oficial"
                  : "Dados não verificados — clique em atualizar"}
              </TooltipContent>
            </Tooltip>
            {influencer.last_synced_at && (
              <span>{relativeTime(influencer.last_synced_at)}</span>
            )}
          </div>

          <div className="flex gap-1.5 pt-1">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1 h-8"
              onClick={(e) => { e.stopPropagation(); setShow360(true); }}
            >
              <Sparkles className="h-3 w-3" /> 360°
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2"
                  onClick={handleSync}
                  disabled={syncing}
                >
                  {syncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Atualizar via fonte oficial</TooltipContent>
            </Tooltip>
            {influencer.profile_url && (
              <Button variant="outline" size="sm" className="h-8 px-2" asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                <a href={influencer.profile_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-destructive hover:text-destructive"
              onClick={(e) => { e.stopPropagation(); onDelete(influencer.id); }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <InfluencerProfile360
        influencer={influencer}
        open={show360}
        onOpenChange={setShow360}
      />
    </TooltipProvider>
  );
}
