import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingUp, TrendingDown, DollarSign, Target,
  ArrowUpRight, ArrowDownRight, Minus
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AdsConsolidatedViewProps {
  metrics: any[];
  accounts: any[];
  dateRange: { start: Date; end: Date };
}

const platformConfig = {
  google_ads: { name: "Google Ads", color: "bg-blue-500", icon: "🔷" },
  meta_ads: { name: "Meta Ads", color: "bg-blue-600", icon: "📘" },
  analytics: { name: "Analytics", color: "bg-orange-500", icon: "📊" },
  tiktok_ads: { name: "TikTok Ads", color: "bg-black", icon: "🎵" },
  linkedin_ads: { name: "LinkedIn Ads", color: "bg-blue-700", icon: "💼" }
};

export function AdsConsolidatedView({ metrics, accounts, dateRange }: AdsConsolidatedViewProps) {
  // Group metrics by platform
  const byPlatform = metrics.reduce((acc, m) => {
    const platform = m.ads_accounts?.platform || 'unknown';
    if (!acc[platform]) {
      acc[platform] = {
        impressions: 0,
        clicks: 0,
        spend: 0,
        conversions: 0,
        conversionValue: 0,
        reach: 0,
        accounts: new Set()
      };
    }
    acc[platform].impressions += Number(m.impressions || 0);
    acc[platform].clicks += Number(m.clicks || 0);
    acc[platform].spend += Number(m.spend || 0);
    acc[platform].conversions += Number(m.conversions || 0);
    acc[platform].conversionValue += Number(m.conversion_value || 0);
    acc[platform].reach += Number(m.reach || 0);
    acc[platform].accounts.add(m.ads_accounts?.account_name);
    return acc;
  }, {} as Record<string, any>);

  // Total spend for percentage calculation
  const totalSpend = (Object.values(byPlatform) as any[]).reduce((sum: number, p: any) => sum + Number(p.spend || 0), 0);

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL',
      minimumFractionDigits: 2 
    }).format(num);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  // Calculate performance indicator
  const getPerformanceIndicator = (roas: number) => {
    if (roas >= 3) return { icon: TrendingUp, color: "text-green-500", label: "Excelente" };
    if (roas >= 2) return { icon: ArrowUpRight, color: "text-green-400", label: "Bom" };
    if (roas >= 1) return { icon: Minus, color: "text-yellow-500", label: "Regular" };
    return { icon: TrendingDown, color: "text-red-500", label: "Atenção" };
  };

  if (Object.keys(byPlatform).length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">
            Nenhum dado disponível para o período selecionado.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Adicione contas e importe dados para visualizar as métricas consolidadas.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Platform Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Object.entries(byPlatform).map(([platform, data]: [string, any]) => {
          const config = platformConfig[platform as keyof typeof platformConfig] || { 
            name: platform, color: "bg-gray-500", icon: "📊" 
          };
          const ctr = (data as any).impressions > 0 ? ((data as any).clicks / (data as any).impressions * 100).toFixed(2) : "0.00";
          const cpc = (data as any).clicks > 0 ? ((data as any).spend / (data as any).clicks).toFixed(2) : "0.00";
          const roas = (data as any).spend > 0 ? ((data as any).conversionValue / (data as any).spend) : 0;
          const spendPercentage = totalSpend > 0 ? ((data as any).spend / totalSpend * 100) : 0;
          const perf = getPerformanceIndicator(roas);

          return (
            <Card key={platform} className="relative overflow-hidden">
              <div className={cn("absolute top-0 left-0 w-1 h-full", config.color)} />
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{config.icon}</span>
                    <div>
                      <CardTitle className="text-base">{config.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {data.accounts.size} conta{data.accounts.size > 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className={cn("text-xs", perf.color)}>
                    <perf.icon className="h-3 w-3 mr-1" />
                    {perf.label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Main Metrics */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Investimento</p>
                    <p className="text-lg font-bold">{formatCurrency(data.spend)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Receita</p>
                    <p className="text-lg font-bold text-green-600">{formatCurrency(data.conversionValue)}</p>
                  </div>
                </div>

                {/* ROAS Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">ROAS</span>
                    <span className="font-medium">{roas.toFixed(2)}x</span>
                  </div>
                  <Progress 
                    value={Math.min(roas * 20, 100)} 
                    className={cn(
                      "h-2",
                      roas >= 2 ? "[&>div]:bg-green-500" : 
                      roas >= 1 ? "[&>div]:bg-yellow-500" : 
                      "[&>div]:bg-red-500"
                    )}
                  />
                </div>

                {/* Secondary Metrics */}
                <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t">
                  <div>
                    <p className="text-lg font-semibold">{formatNumber(data.impressions)}</p>
                    <p className="text-[10px] text-muted-foreground">Impressões</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold">{formatNumber(data.clicks)}</p>
                    <p className="text-[10px] text-muted-foreground">Cliques</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold">{data.conversions}</p>
                    <p className="text-[10px] text-muted-foreground">Conversões</p>
                  </div>
                </div>

                {/* CTR and CPC */}
                <div className="flex justify-between text-xs pt-2 border-t">
                  <div>
                    <span className="text-muted-foreground">CTR: </span>
                    <span className="font-medium">{ctr}%</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">CPC: </span>
                    <span className="font-medium">R$ {cpc}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">% Budget: </span>
                    <span className="font-medium">{spendPercentage.toFixed(1)}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Budget Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Distribuição do Investimento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(byPlatform)
              .sort((a, b) => (b[1] as any).spend - (a[1] as any).spend)
              .map(([platform, data]: [string, any]) => {
                const config = platformConfig[platform as keyof typeof platformConfig] || { 
                  name: platform, color: "bg-gray-500", icon: "📊" 
                };
                const percentage = totalSpend > 0 ? (Number((data as any).spend) / totalSpend * 100) : 0;
                
                return (
                  <div key={platform} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span>{config.icon}</span>
                        <span>{config.name}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-muted-foreground">{formatCurrency(data.spend)}</span>
                        <span className="font-medium w-16 text-right">{percentage.toFixed(1)}%</span>
                      </div>
                    </div>
                    <Progress value={percentage} className="h-2" />
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>

      {/* Performance Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resumo de Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-medium">Plataforma</th>
                  <th className="text-right py-2 font-medium">Impressões</th>
                  <th className="text-right py-2 font-medium">Cliques</th>
                  <th className="text-right py-2 font-medium">CTR</th>
                  <th className="text-right py-2 font-medium">Investimento</th>
                  <th className="text-right py-2 font-medium">CPC</th>
                  <th className="text-right py-2 font-medium">Conversões</th>
                  <th className="text-right py-2 font-medium">Receita</th>
                  <th className="text-right py-2 font-medium">ROAS</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(byPlatform).map(([platform, data]: [string, any]) => {
                  const config = platformConfig[platform as keyof typeof platformConfig] || { 
                    name: platform, icon: "📊" 
                  };
                  const ctr = data.impressions > 0 ? (data.clicks / data.impressions * 100) : 0;
                  const cpc = data.clicks > 0 ? (data.spend / data.clicks) : 0;
                  const roas = data.spend > 0 ? (data.conversionValue / data.spend) : 0;
                  
                  return (
                    <tr key={platform} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-2">
                        <span className="flex items-center gap-2">
                          <span>{config.icon}</span>
                          {config.name}
                        </span>
                      </td>
                      <td className="text-right py-2">{formatNumber(data.impressions)}</td>
                      <td className="text-right py-2">{formatNumber(data.clicks)}</td>
                      <td className="text-right py-2">{ctr.toFixed(2)}%</td>
                      <td className="text-right py-2">{formatCurrency(data.spend)}</td>
                      <td className="text-right py-2">R$ {cpc.toFixed(2)}</td>
                      <td className="text-right py-2">{data.conversions}</td>
                      <td className="text-right py-2 text-green-600">{formatCurrency(data.conversionValue)}</td>
                      <td className={cn(
                        "text-right py-2 font-medium",
                        roas >= 2 ? "text-green-600" : roas >= 1 ? "text-yellow-600" : "text-red-600"
                      )}>
                        {roas.toFixed(2)}x
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
