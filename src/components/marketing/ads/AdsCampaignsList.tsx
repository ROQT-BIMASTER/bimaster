import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Table, TableBody, TableCell, TableHead, 
  TableHeader, TableRow 
} from "@/components/ui/table";
import { 
  Search, Filter, ArrowUpDown, Play, Pause, 
  TrendingUp, TrendingDown, Loader2
} from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface AdsCampaignsListProps {
  accounts: any[];
  dateRange: { start: Date; end: Date };
}

const platformConfig = {
  google_ads: { name: "Google Ads", icon: "🔷" },
  meta_ads: { name: "Meta Ads", icon: "📘" },
  analytics: { name: "Analytics", icon: "📊" },
  tiktok_ads: { name: "TikTok Ads", icon: "🎵" },
  linkedin_ads: { name: "LinkedIn Ads", icon: "💼" }
};

export function AdsCampaignsList({ accounts, dateRange }: AdsCampaignsListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<string>("spend");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['ads-campaigns', accounts.map(a => a.id)],
    queryFn: async () => {
      if (accounts.length === 0) return [];
      
      const { data, error } = await supabase
        .from('ads_campaigns')
        .select(`
          *,
          ads_accounts!inner(id, platform, account_name),
          ads_campaign_metrics(
            impressions, clicks, spend, conversions, 
            conversion_value, ctr, cpc, reach, metric_date
          )
        `)
        .in('account_id', accounts.map(a => a.id))
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: accounts.length > 0
  });

  // Aggregate campaign metrics
  const processedCampaigns = campaigns?.map(campaign => {
    const metrics = campaign.ads_campaign_metrics || [];
    const filteredMetrics = metrics.filter((m: any) => {
      const date = new Date(m.metric_date);
      return date >= dateRange.start && date <= dateRange.end;
    });
    
    const totals = filteredMetrics.reduce((acc: any, m: any) => ({
      impressions: acc.impressions + Number(m.impressions || 0),
      clicks: acc.clicks + Number(m.clicks || 0),
      spend: acc.spend + Number(m.spend || 0),
      conversions: acc.conversions + Number(m.conversions || 0),
      conversionValue: acc.conversionValue + Number(m.conversion_value || 0),
    }), { impressions: 0, clicks: 0, spend: 0, conversions: 0, conversionValue: 0 });

    return {
      ...campaign,
      totals,
      ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions * 100) : 0,
      cpc: totals.clicks > 0 ? (totals.spend / totals.clicks) : 0,
      roas: totals.spend > 0 ? (totals.conversionValue / totals.spend) : 0
    };
  }) || [];

  // Filter and sort
  const filteredCampaigns = processedCampaigns
    .filter(c => 
      c.campaign_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.ads_accounts?.account_name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      let aVal, bVal;
      switch (sortField) {
        case 'spend': aVal = a.totals.spend; bVal = b.totals.spend; break;
        case 'impressions': aVal = a.totals.impressions; bVal = b.totals.impressions; break;
        case 'clicks': aVal = a.totals.clicks; bVal = b.totals.clicks; break;
        case 'conversions': aVal = a.totals.conversions; bVal = b.totals.conversions; break;
        case 'roas': aVal = a.roas; bVal = b.roas; break;
        default: aVal = a.totals.spend; bVal = b.totals.spend;
      }
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

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

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500 text-white">Ativo</Badge>;
      case 'paused':
        return <Badge variant="secondary">Pausado</Badge>;
      case 'ended':
        return <Badge variant="outline">Finalizado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (accounts.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">
            Adicione contas de ads para visualizar suas campanhas.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Carregando campanhas...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar campanhas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm">
          <Filter className="h-4 w-4 mr-2" />
          Filtros
        </Button>
      </div>

      {/* Campaigns Table */}
      {filteredCampaigns.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {searchTerm 
                ? "Nenhuma campanha encontrada para esta busca." 
                : "Nenhuma campanha cadastrada. Importe dados das suas plataformas de ads."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[250px]">Campanha</TableHead>
                    <TableHead>Plataforma</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead 
                      className="text-right cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('impressions')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Impressões
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="text-right cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('clicks')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Cliques
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </TableHead>
                    <TableHead className="text-right">CTR</TableHead>
                    <TableHead 
                      className="text-right cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('spend')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Investimento
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </TableHead>
                    <TableHead className="text-right">CPC</TableHead>
                    <TableHead 
                      className="text-right cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('conversions')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Conversões
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="text-right cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('roas')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        ROAS
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCampaigns.map((campaign) => {
                    const platform = platformConfig[campaign.ads_accounts?.platform as keyof typeof platformConfig];
                    return (
                      <TableRow key={campaign.id} className="hover:bg-muted/50">
                        <TableCell>
                          <div>
                            <p className="font-medium truncate max-w-[250px]">
                              {campaign.campaign_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {campaign.ads_accounts?.account_name}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1">
                            <span>{platform?.icon}</span>
                            <span className="text-xs">{platform?.name}</span>
                          </span>
                        </TableCell>
                        <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                        <TableCell className="text-right">
                          {formatNumber(campaign.totals.impressions)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(campaign.totals.clicks)}
                        </TableCell>
                        <TableCell className="text-right">
                          {campaign.ctr.toFixed(2)}%
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(campaign.totals.spend)}
                        </TableCell>
                        <TableCell className="text-right">
                          R$ {campaign.cpc.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          {campaign.totals.conversions}
                        </TableCell>
                        <TableCell className={cn(
                          "text-right font-medium",
                          campaign.roas >= 2 ? "text-green-600" : 
                          campaign.roas >= 1 ? "text-yellow-600" : 
                          "text-red-600"
                        )}>
                          <span className="flex items-center justify-end gap-1">
                            {campaign.roas >= 2 ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : campaign.roas < 1 ? (
                              <TrendingDown className="h-3 w-3" />
                            ) : null}
                            {campaign.roas.toFixed(2)}x
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-muted/50">
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground">
            <strong>💡 Dica:</strong> Os dados das campanhas podem ser importados via CSV ou através de 
            integrações com n8n/Zapier que chamam as APIs do Google Ads e Meta Ads.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
