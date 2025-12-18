import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  TrendingUp, TrendingDown, DollarSign, MousePointerClick, 
  Eye, Users, Target, BarChart3, RefreshCw, Settings,
  Plus, ArrowUpRight, ArrowDownRight
} from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { AdsAccountsManager } from "./AdsAccountsManager";
import { AdsMetricsCharts } from "./AdsMetricsCharts";
import { AdsCampaignsList } from "./AdsCampaignsList";
import { AdsConsolidatedView } from "./AdsConsolidatedView";

const platformConfig = {
  google_ads: { name: "Google Ads", color: "bg-blue-500", icon: "🔷" },
  meta_ads: { name: "Meta Ads", color: "bg-blue-600", icon: "📘" },
  analytics: { name: "Analytics", color: "bg-orange-500", icon: "📊" },
  tiktok_ads: { name: "TikTok Ads", color: "bg-black", icon: "🎵" },
  linkedin_ads: { name: "LinkedIn Ads", color: "bg-blue-700", icon: "💼" }
};

const dateRangeOptions = [
  { value: "7d", label: "Últimos 7 dias" },
  { value: "14d", label: "Últimos 14 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "month", label: "Este mês" },
  { value: "90d", label: "Últimos 90 dias" }
];

export function AdsDashboard() {
  const [dateRange, setDateRange] = useState("30d");
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);

  // Fetch accounts
  const { data: accounts, isLoading: loadingAccounts, refetch: refetchAccounts } = useQuery({
    queryKey: ['ads-accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ads_accounts')
        .select('*')
        .eq('is_active', true)
        .order('platform');
      if (error) throw error;
      return data;
    }
  });

  // Calculate date range
  const getDateRange = () => {
    const end = new Date();
    let start: Date;
    
    switch (dateRange) {
      case "7d": start = subDays(end, 7); break;
      case "14d": start = subDays(end, 14); break;
      case "30d": start = subDays(end, 30); break;
      case "month": 
        start = startOfMonth(end);
        break;
      case "90d": start = subDays(end, 90); break;
      default: start = subDays(end, 30);
    }
    
    return { start, end };
  };

  const { start, end } = getDateRange();

  // Fetch consolidated metrics
  const { data: metrics, isLoading: loadingMetrics } = useQuery({
    queryKey: ['ads-metrics', dateRange, selectedAccounts],
    queryFn: async () => {
      let query = supabase
        .from('ads_metrics')
        .select(`
          *,
          ads_accounts!inner(id, platform, account_name)
        `)
        .gte('metric_date', format(start, 'yyyy-MM-dd'))
        .lte('metric_date', format(end, 'yyyy-MM-dd'));
      
      if (selectedAccounts.length > 0) {
        query = query.in('account_id', selectedAccounts);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!accounts && accounts.length > 0
  });

  // Calculate totals
  const totals = metrics?.reduce((acc, m) => ({
    impressions: acc.impressions + Number(m.impressions || 0),
    clicks: acc.clicks + Number(m.clicks || 0),
    spend: acc.spend + Number(m.spend || 0),
    conversions: acc.conversions + Number(m.conversions || 0),
    conversionValue: acc.conversionValue + Number(m.conversion_value || 0),
    reach: acc.reach + Number(m.reach || 0),
  }), { impressions: 0, clicks: 0, spend: 0, conversions: 0, conversionValue: 0, reach: 0 });

  const avgCTR = totals && totals.impressions > 0 
    ? ((totals.clicks / totals.impressions) * 100).toFixed(2) 
    : "0.00";
  
  const avgCPC = totals && totals.clicks > 0 
    ? (totals.spend / totals.clicks).toFixed(2) 
    : "0.00";
  
  const roas = totals && totals.spend > 0 
    ? (totals.conversionValue / totals.spend).toFixed(2) 
    : "0.00";

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL',
      minimumFractionDigits: 2 
    }).format(num);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Painel de Ads</h2>
          <p className="text-muted-foreground">
            Visão consolidada de Google Ads, Meta Ads e Analytics
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {dateRangeOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button variant="outline" size="icon" onClick={() => refetchAccounts()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Connected Accounts Summary */}
      <div className="flex flex-wrap gap-2">
        {accounts?.map(account => {
          const config = platformConfig[account.platform as keyof typeof platformConfig];
          return (
            <Badge 
              key={account.id}
              variant={selectedAccounts.includes(account.id) ? "default" : "secondary"}
              className="cursor-pointer py-1.5 px-3"
              onClick={() => {
                if (selectedAccounts.includes(account.id)) {
                  setSelectedAccounts(prev => prev.filter(id => id !== account.id));
                } else {
                  setSelectedAccounts(prev => [...prev, account.id]);
                }
              }}
            >
              <span className="mr-1">{config?.icon}</span>
              {account.account_name}
              {account.sync_status === 'syncing' && (
                <RefreshCw className="h-3 w-3 ml-1 animate-spin" />
              )}
            </Badge>
          );
        })}
        {(!accounts || accounts.length === 0) && (
          <p className="text-sm text-muted-foreground">
            Nenhuma conta conectada. Adicione suas contas na aba "Contas".
          </p>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <Badge variant="secondary" className="text-[10px]">Impressões</Badge>
            </div>
            <p className="text-2xl font-bold mt-2">{formatNumber(totals?.impressions || 0)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <MousePointerClick className="h-4 w-4 text-muted-foreground" />
              <Badge variant="secondary" className="text-[10px]">Cliques</Badge>
            </div>
            <p className="text-2xl font-bold mt-2">{formatNumber(totals?.clicks || 0)}</p>
            <p className="text-xs text-muted-foreground">CTR: {avgCTR}%</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <Badge variant="secondary" className="text-[10px]">Investido</Badge>
            </div>
            <p className="text-2xl font-bold mt-2">{formatCurrency(totals?.spend || 0)}</p>
            <p className="text-xs text-muted-foreground">CPC: R$ {avgCPC}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <Target className="h-4 w-4 text-muted-foreground" />
              <Badge variant="secondary" className="text-[10px]">Conversões</Badge>
            </div>
            <p className="text-2xl font-bold mt-2">{totals?.conversions || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <Badge variant="secondary" className="text-[10px]">Receita</Badge>
            </div>
            <p className="text-2xl font-bold mt-2">{formatCurrency(totals?.conversionValue || 0)}</p>
          </CardContent>
        </Card>

        <Card className={cn(
          Number(roas) >= 2 ? "border-green-500/50 bg-green-500/5" : 
          Number(roas) >= 1 ? "border-yellow-500/50 bg-yellow-500/5" : 
          "border-red-500/50 bg-red-500/5"
        )}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <Badge variant="secondary" className="text-[10px]">ROAS</Badge>
            </div>
            <p className="text-2xl font-bold mt-2">{roas}x</p>
            <p className="text-xs text-muted-foreground">
              {Number(roas) >= 2 ? "Ótimo" : Number(roas) >= 1 ? "Bom" : "Atenção"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="consolidated" className="space-y-4">
        <TabsList>
          <TabsTrigger value="consolidated">Visão Consolidada</TabsTrigger>
          <TabsTrigger value="charts">Gráficos</TabsTrigger>
          <TabsTrigger value="campaigns">Campanhas</TabsTrigger>
          <TabsTrigger value="accounts">Contas</TabsTrigger>
        </TabsList>

        <TabsContent value="consolidated">
          <AdsConsolidatedView 
            metrics={metrics || []} 
            accounts={accounts || []}
            dateRange={{ start, end }}
          />
        </TabsContent>

        <TabsContent value="charts">
          <AdsMetricsCharts 
            metrics={metrics || []} 
            dateRange={{ start, end }}
          />
        </TabsContent>

        <TabsContent value="campaigns">
          <AdsCampaignsList 
            accounts={accounts || []}
            dateRange={{ start, end }}
          />
        </TabsContent>

        <TabsContent value="accounts">
          <AdsAccountsManager onUpdate={refetchAccounts} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
