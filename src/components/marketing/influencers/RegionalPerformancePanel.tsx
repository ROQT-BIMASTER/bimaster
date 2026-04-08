import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, ChevronRight } from "lucide-react";
import { REGIOES_UFS } from "@/lib/constants/regioes";

interface Influencer {
  id: string;
  platform: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  followers_count: number;
  engagement_rate: number;
  composite_score?: number;
  regiao?: string | null;
  uf?: string | null;
}

interface RegionalPerformancePanelProps {
  influencers: Influencer[];
}

interface RegionStats {
  regiao: string;
  count: number;
  totalReach: number;
  avgEngagement: number;
  avgScore: number;
  topInfluencer: string;
  ufStats: UFStats[];
}

interface UFStats {
  uf: string;
  count: number;
  totalReach: number;
  avgEngagement: number;
  avgScore: number;
  topInfluencer: string;
}

function formatNumber(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function getScoreColor(score: number) {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 60) return "text-amber-600 dark:text-amber-400";
  if (score >= 40) return "text-orange-600 dark:text-orange-400";
  return "text-destructive";
}

function getBarColor(score: number) {
  if (score >= 80) return "bg-emerald-500/80";
  if (score >= 60) return "bg-amber-500/80";
  if (score >= 40) return "bg-orange-500/80";
  return "bg-destructive/80";
}

function buildRegionStats(influencers: Influencer[]): RegionStats[] {
  const allRegioes = Object.keys(REGIOES_UFS);
  const grouped: Record<string, Influencer[]> = {};

  for (const r of allRegioes) grouped[r] = [];
  grouped["Não definido"] = [];

  for (const inf of influencers) {
    const key = inf.regiao && allRegioes.includes(inf.regiao) ? inf.regiao : "Não definido";
    grouped[key].push(inf);
  }

  const stats: RegionStats[] = [];

  for (const regiao of [...allRegioes, "Não definido"]) {
    const items = grouped[regiao];
    if (items.length === 0) continue;

    const totalReach = items.reduce((s, i) => s + i.followers_count, 0);
    const avgEngagement = items.reduce((s, i) => s + Number(i.engagement_rate), 0) / items.length;
    const avgScore = items.reduce((s, i) => s + (i.composite_score || 0), 0) / items.length;
    const top = items.reduce((best, i) => (i.composite_score || 0) > (best.composite_score || 0) ? i : best, items[0]);

    // Build UF breakdown
    const ufGrouped: Record<string, Influencer[]> = {};
    for (const inf of items) {
      const uf = inf.uf || "N/D";
      if (!ufGrouped[uf]) ufGrouped[uf] = [];
      ufGrouped[uf].push(inf);
    }

    const ufStats: UFStats[] = Object.entries(ufGrouped)
      .map(([uf, ufItems]) => {
        const ufTop = ufItems.reduce((best, i) => (i.composite_score || 0) > (best.composite_score || 0) ? i : best, ufItems[0]);
        return {
          uf,
          count: ufItems.length,
          totalReach: ufItems.reduce((s, i) => s + i.followers_count, 0),
          avgEngagement: ufItems.reduce((s, i) => s + Number(i.engagement_rate), 0) / ufItems.length,
          avgScore: ufItems.reduce((s, i) => s + (i.composite_score || 0), 0) / ufItems.length,
          topInfluencer: ufTop.display_name || ufTop.username,
        };
      })
      .sort((a, b) => b.avgScore - a.avgScore);

    stats.push({
      regiao,
      count: items.length,
      totalReach,
      avgEngagement,
      avgScore,
      topInfluencer: top.display_name || top.username,
      ufStats,
    });
  }

  return stats.sort((a, b) => b.avgScore - a.avgScore);
}

export function RegionalPerformancePanel({ influencers }: RegionalPerformancePanelProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const stats = buildRegionStats(influencers);

  const maxReach = Math.max(...stats.map((s) => s.totalReach), 1);

  const toggle = (regiao: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(regiao)) next.delete(regiao);
      else next.add(regiao);
      return next;
    });
  };

  if (influencers.length === 0) {
    return (
      <p className="text-muted-foreground text-center py-8">
        Nenhum influenciador cadastrado para análise regional.
      </p>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10"></TableHead>
            <TableHead>Região / UF</TableHead>
            <TableHead className="w-28 text-right">Influenciadores</TableHead>
            <TableHead className="w-36 text-right">Alcance Total</TableHead>
            <TableHead className="w-36">Alcance (relativo)</TableHead>
            <TableHead className="w-32 text-right">Engajamento</TableHead>
            <TableHead className="w-28 text-right">Score</TableHead>
            <TableHead className="w-44">Top Influenciador</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stats.map((region) => {
            const isExpanded = expanded.has(region.regiao);
            const reachPct = (region.totalReach / maxReach) * 100;
            return (
              <>
                <TableRow
                  key={region.regiao}
                  className="cursor-pointer hover:bg-accent/50 font-medium"
                  onClick={() => toggle(region.regiao)}
                >
                  <TableCell className="pr-0">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </TableCell>
                  <TableCell className="font-semibold text-sm">{region.regiao}</TableCell>
                  <TableCell className="text-right text-sm">{region.count}</TableCell>
                  <TableCell className="text-right text-sm">{formatNumber(region.totalReach)}</TableCell>
                  <TableCell>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${getBarColor(region.avgScore)}`}
                        style={{ width: `${reachPct}%` }}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-sm">{region.avgEngagement.toFixed(1)}%</TableCell>
                  <TableCell className="text-right">
                    <span className={`text-sm font-semibold ${getScoreColor(region.avgScore)}`}>
                      {region.avgScore.toFixed(0)}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{region.topInfluencer}</TableCell>
                </TableRow>
                {isExpanded &&
                  region.ufStats.map((uf) => {
                    const ufReachPct = (uf.totalReach / maxReach) * 100;
                    return (
                      <TableRow key={`${region.regiao}-${uf.uf}`} className="bg-muted/20">
                        <TableCell></TableCell>
                        <TableCell className="text-sm pl-8 text-muted-foreground">{uf.uf}</TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">{uf.count}</TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">{formatNumber(uf.totalReach)}</TableCell>
                        <TableCell>
                          <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${getBarColor(uf.avgScore)}`}
                              style={{ width: `${ufReachPct}%` }}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">{uf.avgEngagement.toFixed(1)}%</TableCell>
                        <TableCell className="text-right">
                          <span className={`text-sm ${getScoreColor(uf.avgScore)}`}>{uf.avgScore.toFixed(0)}</span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{uf.topInfluencer}</TableCell>
                      </TableRow>
                    );
                  })}
              </>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
