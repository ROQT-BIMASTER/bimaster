import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy, TrendingUp, TrendingDown, Minus, Shield, Heart, Eye } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Influencer {
  id: string;
  platform: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  followers_count: number;
  engagement_rate: number;
  avg_likes: number;
  avg_comments: number;
  fraud_score: number | null;
  composite_score?: number;
  rank_position?: number;
  opportunity_score?: number;
}

interface InfluencerRankingPanelProps {
  influencers: Influencer[];
  onSelect?: (id: string) => void;
}

function getMedalEmoji(pos: number) {
  if (pos === 1) return "🥇";
  if (pos === 2) return "🥈";
  if (pos === 3) return "🥉";
  return `#${pos}`;
}

function getScoreColor(score: number) {
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-amber-600";
  if (score >= 40) return "text-orange-600";
  return "text-destructive";
}

function getProgressColor(score: number) {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-amber-500";
  if (score >= 40) return "bg-orange-500";
  return "bg-destructive";
}

function formatFollowers(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function platformIcon(platform: string) {
  const colors: Record<string, string> = {
    instagram: "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300",
    tiktok: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    youtube: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
    twitter: "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300",
  };
  return colors[platform] || "bg-muted text-muted-foreground";
}

export function InfluencerRankingPanel({ influencers, onSelect }: InfluencerRankingPanelProps) {
  const sorted = [...influencers].sort((a, b) => (b.composite_score || 0) - (a.composite_score || 0));

  if (sorted.length === 0) {
    return (
      <p className="text-muted-foreground text-center py-8">
        Nenhum influenciador rankeado. Clique em "Recalcular Ranking" para gerar scores.
      </p>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>Influenciador</TableHead>
            <TableHead className="w-32">Score</TableHead>
            <TableHead className="w-24 text-center"><Heart className="h-3.5 w-3.5 mx-auto" /></TableHead>
            <TableHead className="w-24 text-center"><Shield className="h-3.5 w-3.5 mx-auto" /></TableHead>
            <TableHead className="w-24 text-center"><Eye className="h-3.5 w-3.5 mx-auto" /></TableHead>
            <TableHead className="w-28 text-center">Oportunidade</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((inf, idx) => {
            const pos = inf.rank_position || idx + 1;
            const score = inf.composite_score || 0;
            const opp = inf.opportunity_score || 0;
            return (
              <TableRow
                key={inf.id}
                className="cursor-pointer hover:bg-accent/50"
                onClick={() => onSelect?.(inf.id)}
              >
                <TableCell className="font-bold text-lg">
                  {getMedalEmoji(pos)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={inf.avatar_url || undefined} />
                      <AvatarFallback>{(inf.display_name || inf.username).charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">{inf.display_name || inf.username}</p>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className={`text-[10px] px-1 py-0 capitalize ${platformIcon(inf.platform)}`}>
                          {inf.platform}
                        </Badge>
                        <span className="text-xs text-muted-foreground">@{inf.username}</span>
                        <span className="text-xs text-muted-foreground">· {formatFollowers(inf.followers_count)}</span>
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${getScoreColor(score)}`}>{score.toFixed(0)}</span>
                      <span className="text-xs text-muted-foreground">/100</span>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${getProgressColor(score)}`} style={{ width: `${score}%` }} />
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <span className="text-sm font-medium">{Number(inf.engagement_rate).toFixed(1)}%</span>
                </TableCell>
                <TableCell className="text-center">
                  <span className={`text-sm font-medium ${inf.fraud_score ? getScoreColor(inf.fraud_score) : "text-muted-foreground"}`}>
                    {inf.fraud_score ? `${inf.fraud_score}` : "—"}
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  <span className="text-sm">{formatFollowers(inf.followers_count)}</span>
                </TableCell>
                <TableCell className="text-center">
                  {opp > 0 ? (
                    <Badge variant={opp >= 70 ? "default" : "secondary"} className="text-xs">
                      {opp >= 70 ? <TrendingUp className="h-3 w-3 mr-1" /> : <Minus className="h-3 w-3 mr-1" />}
                      {opp.toFixed(0)}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
