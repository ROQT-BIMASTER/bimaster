import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/formatters';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Search, 
  Download, 
  TrendingUp, 
  TrendingDown, 
  Target,
  DollarSign,
  Percent,
  BarChart3
} from 'lucide-react';

export default function TradeReportCampaigns() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['trade-report-campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trade_campaigns')
        .select(`
          *,
          budget:trade_budgets(name, code)
        `)
        .order('start_date', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const filteredCampaigns = useMemo(() => {
    if (!campaigns) return [];
    
    return campaigns.filter(c => {
      const matchesSearch = !searchTerm || 
        c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.code?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      const matchesType = typeFilter === 'all' || c.campaign_type === typeFilter;
      
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [campaigns, searchTerm, statusFilter, typeFilter]);

  const metrics = useMemo(() => {
    if (!filteredCampaigns.length) return {
      total: 0,
      investido: 0,
      receita: 0,
      roiMedio: 0,
    };

    const investido = filteredCampaigns.reduce((acc, c) => acc + (c.actual_cost || 0), 0);
    const receita = filteredCampaigns.reduce((acc, c) => acc + (c.actual_revenue || 0), 0);
    const rois = filteredCampaigns.filter(c => c.roi_percentual != null);
    const roiMedio = rois.length > 0 
      ? rois.reduce((acc, c) => acc + (c.roi_percentual || 0), 0) / rois.length 
      : investido > 0 ? ((receita - investido) / investido) * 100 : 0;

    return {
      total: filteredCampaigns.length,
      investido,
      receita,
      roiMedio,
    };
  }, [filteredCampaigns]);

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      draft: { variant: "outline", label: "Rascunho" },
      pending_approval: { variant: "secondary", label: "Aguardando" },
      approved: { variant: "default", label: "Aprovada" },
      in_progress: { variant: "default", label: "Em Andamento" },
      completed: { variant: "secondary", label: "Concluída" },
      cancelled: { variant: "destructive", label: "Cancelada" },
    };
    const { variant, label } = config[status] || config.draft;
    return <Badge variant={variant}>{label}</Badge>;
  };

  const getCampaignTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      sell_in: "Sell-In",
      sell_out: "Sell-Out",
      institucional: "Institucional",
      cooperada: "Cooperada",
      mdf: "MDF",
      midia: "Mídia",
      incentivo: "Incentivo",
      degustacao: "Degustação",
      bonificacao: "Bonificação",
    };
    return labels[type] || type;
  };

  const handleExport = () => {
    if (!filteredCampaigns.length) return;
    
    const headers = ['Código', 'Nome', 'Tipo', 'Status', 'Início', 'Fim', 'Custo Estimado', 'Custo Real', 'Receita', 'ROI'];
    const rows = filteredCampaigns.map(c => [
      c.code,
      c.name,
      getCampaignTypeLabel(c.campaign_type),
      c.status,
      c.start_date,
      c.end_date,
      c.estimated_cost || 0,
      c.actual_cost || 0,
      c.actual_revenue || 0,
      c.roi_percentual || 0,
    ]);
    
    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio-campanhas-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-[500px]" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Relatório de Campanhas</h1>
            <p className="text-muted-foreground mt-1">Análise detalhada de performance por campanha</p>
          </div>
          <Button onClick={handleExport} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <span className="text-2xl font-bold">{metrics.total}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Campanhas</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-2xl font-bold">{formatCurrency(metrics.investido)}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Total Investido</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <span className="text-2xl font-bold">{formatCurrency(metrics.receita)}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Receita Gerada</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Percent className="h-4 w-4 text-muted-foreground" />
                <span className={`text-2xl font-bold ${metrics.roiMedio >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {metrics.roiMedio >= 0 ? '+' : ''}{metrics.roiMedio.toFixed(1)}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">ROI Médio</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar campanha..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  <SelectItem value="draft">Rascunho</SelectItem>
                  <SelectItem value="pending_approval">Aguardando</SelectItem>
                  <SelectItem value="approved">Aprovada</SelectItem>
                  <SelectItem value="in_progress">Em Andamento</SelectItem>
                  <SelectItem value="completed">Concluída</SelectItem>
                  <SelectItem value="cancelled">Cancelada</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Tipos</SelectItem>
                  <SelectItem value="sell_in">Sell-In</SelectItem>
                  <SelectItem value="sell_out">Sell-Out</SelectItem>
                  <SelectItem value="institucional">Institucional</SelectItem>
                  <SelectItem value="cooperada">Cooperada</SelectItem>
                  <SelectItem value="mdf">MDF</SelectItem>
                  <SelectItem value="bonificacao">Bonificação</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Campanha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead className="text-right">Custo Est.</TableHead>
                    <TableHead className="text-right">Custo Real</TableHead>
                    <TableHead className="text-right">Receita</TableHead>
                    <TableHead className="text-center">ROI</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCampaigns.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                        Nenhuma campanha encontrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCampaigns.map((campaign) => {
                      const roi = campaign.roi_percentual || 
                        (campaign.actual_cost > 0 
                          ? ((campaign.actual_revenue - campaign.actual_cost) / campaign.actual_cost) * 100 
                          : 0);
                      
                      return (
                        <TableRow key={campaign.id}>
                          <TableCell className="font-mono text-xs">{campaign.code}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{campaign.name}</p>
                              {campaign.budget && (
                                <p className="text-xs text-muted-foreground">Verba: {campaign.budget.code}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{getCampaignTypeLabel(campaign.campaign_type)}</Badge>
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {format(new Date(campaign.start_date), 'dd/MM/yy', { locale: ptBR })} - {format(new Date(campaign.end_date), 'dd/MM/yy', { locale: ptBR })}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(campaign.estimated_cost || 0)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(campaign.actual_cost || 0)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(campaign.actual_revenue || 0)}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className={`flex items-center justify-center gap-1 ${roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {roi >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              <span className="font-mono text-sm">{roi >= 0 ? '+' : ''}{roi.toFixed(1)}%</span>
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
