import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ExternalLink, TrendingUp, Users, Heart, MessageCircle, Trash2 } from "lucide-react";

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
}

interface Props {
  influencer: Influencer;
  onDelete: (id: string) => void;
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

export function InfluencerProfileCard({ influencer, onDelete }: Props) {
  const initials = (influencer.display_name || influencer.username)
    .substring(0, 2)
    .toUpperCase();

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={influencer.avatar_url || undefined} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold text-sm">
                {influencer.display_name || influencer.username}
              </h3>
              <p className="text-xs text-muted-foreground">@{influencer.username}</p>
            </div>
          </div>
          <Badge variant="outline" className={platformColors[influencer.platform] || ""}>
            {influencer.platform}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
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

        {influencer.fraud_score !== null && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Autenticidade</span>
            <Badge
              variant={influencer.fraud_score >= 70 ? "default" : "destructive"}
              className="text-xs"
            >
              {influencer.fraud_score}%
            </Badge>
          </div>
        )}

        {influencer.notes && (
          <p className="text-xs text-muted-foreground line-clamp-2">{influencer.notes}</p>
        )}

        <div className="flex gap-2 pt-1">
          {influencer.profile_url && (
            <Button variant="outline" size="sm" className="flex-1" asChild>
              <a href={influencer.profile_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3 mr-1" /> Perfil
              </a>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => onDelete(influencer.id)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
