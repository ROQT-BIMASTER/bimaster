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
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/formatters';
import { format } from 'date-fns';
import { 
  Search, 
  Download, 
  TrendingUp, 
  TrendingDown, 
  Users,
  DollarSign,
  Percent,
  Target,
  Minus
} from 'lucide-react';

interface ClientReport {
  customer_id: string;
  cliente_nome: string;
  total_campanhas: number;
  total_investido: number;
  total_receita: number;
  roi_medio: number;
  sell_out_anterior: number;
  sell_out_atual: number;
  crescimento: number;
}

export default function TradeReportClients() {
  const [searchTerm, setSearchTerm] = useState('');

  const { data: clientReports, isLoading } = useQuery({
    queryKey: ['trade-report-clients'],
    queryFn: async () => {
      // Fetch campaigns with customer data
      const { data: campaigns, error: campaignsError } = await supabase
        .from('trade_campaigns')
        .select(`
          id,
          customer_id,
          actual_cost,
          actual_revenue,
          roi_percentual,
          sell_out_anterior,
          sell_out_atual
        `)
        .not('customer_id', 'is', null);

      if (campaignsError) throw campaignsError;

      // Fetch prospects for client names
      const { data: prospects } = await supabase
        .from('prospects')
        .select('id, nome_empresa');

      const prospectsMap = new Map(
        prospects?.map(p => [p.id, p.nome_empresa]) || []
      );

      // Aggregate by client
      const clientMap = new Map<string, ClientReport>();

      campaigns?.forEach(campaign => {
        const customerId = campaign.customer_id;
        if (!customerId) return;

        const existing = clientMap.get(customerId) || {
          customer_id: customerId,
          cliente_nome: prospectsMap.get(customerId) || 'Cliente não encontrado',
          total_campanhas: 0,
          total_investido: 0,
          total_receita: 0,
          roi_medio: 0,
          sell_out_anterior: 0,
          sell_out_atual: 0,
          crescimento: 0,
        };

        existing.total_campanhas += 1;
        existing.total_investido += campaign.actual_cost || 0;
        existing.total_receita += campaign.actual_revenue || 0;
        existing.sell_out_anterior += campaign.sell_out_anterior || 0;
        existing.sell_out_atual += campaign.sell_out_atual || 0;

        clientMap.set(customerId, existing);
      });

      // Calculate ROI and growth
      const results = Array.from(clientMap.values()).map(client => {
        client.roi_medio = client.total_investido > 0
          ? ((client.total_receita - client.total_investido) / client.total_investido) * 100
          : 0;
        client.crescimento = client.sell_out_anterior > 0
          ? ((client.sell_out_atual - client.sell_out_anterior) / client.sell_out_anterior) * 100
          : 0;
        return client;
      });

      return results.sort((a, b) => b.total_investido - a.total_investido);
    },
  });

  const filteredClients = useMemo(() => {
    if (!clientReports) return [];
    if (!searchTerm) return clientReports;
    
    const term = searchTerm.toLowerCase();
    return clientReports.filter(c => 
      c.cliente_nome?.toLowerCase().includes(term)
    );
  }, [clientReports, searchTerm]);

  const metrics = useMemo(() => {
    if (!filteredClients.length) return {
      totalClientes: 0,
      totalInvestido: 0,
      totalReceita: 0,
      roiMedio: 0,
    };

    const totalInvestido = filteredClients.reduce((acc, c) => acc + c.total_investido, 0);
    const totalReceita = filteredClients.reduce((acc, c) => acc + c.total_receita, 0);
    const roiMedio = totalInvestido > 0 
      ? ((totalReceita - totalInvestido) / totalInvestido) * 100 
      : 0;

    return {
      totalClientes: filteredClients.length,
      totalInvestido,
      totalReceita,
      roiMedio,
    };
  }, [filteredClients]);

  const handleExport = () => {
    if (!filteredClients.length) return;
    
    const headers = ['Cliente', 'Campanhas', 'Total Investido', 'Total Receita', 'ROI Médio', 'Sell Out Anterior', 'Sell Out Atual', 'Crescimento'];
    const rows = filteredClients.map(c => [
      c.cliente_nome,
      c.total_campanhas,
      c.total_investido,
      c.total_receita,
      c.roi_medio.toFixed(2),
      c.sell_out_anterior,
      c.sell_out_atual,
      c.crescimento.toFixed(2),
    ]);
    
    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio-clientes-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const formatCompact = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
    return value.toFixed(0);
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
            <h1 className="text-3xl font-bold">Relatório por Cliente</h1>
            <p className="text-muted-foreground mt-1">Análise consolidada de campanhas por cliente</p>
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
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-2xl font-bold">{metrics.totalClientes}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Clientes Ativos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-2xl font-bold">{formatCurrency(metrics.totalInvestido)}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Total Investido</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <span className="text-2xl font-bold">{formatCurrency(metrics.totalReceita)}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Receita Total</p>
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

        {/* Table */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="text-lg">Clientes</CardTitle>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Cliente</TableHead>
                    <TableHead className="text-center">Campanhas</TableHead>
                    <TableHead className="text-right">Investido</TableHead>
                    <TableHead className="text-right">Receita</TableHead>
                    <TableHead className="text-center">ROI</TableHead>
                    <TableHead className="min-w-[180px]">Sell Out (Ant. → Atual)</TableHead>
                    <TableHead className="text-center">Crescimento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                        Nenhum cliente encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredClients.map((client) => (
                      <TableRow key={client.customer_id}>
                        <TableCell className="font-medium">{client.cliente_nome}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{client.total_campanhas}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(client.total_investido)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(client.total_receita)}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className={`flex items-center justify-center gap-1 ${client.roi_medio >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {client.roi_medio >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            <span className="font-mono text-sm">{client.roi_medio >= 0 ? '+' : ''}{client.roi_medio.toFixed(1)}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <span className="text-muted-foreground">{formatCompact(client.sell_out_anterior)}</span>
                            <span className="text-muted-foreground">→</span>
                            <span className="font-medium">{formatCompact(client.sell_out_atual)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className={`flex items-center justify-center gap-1 ${client.crescimento >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {client.crescimento > 0 ? <TrendingUp className="h-3 w-3" /> : client.crescimento < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                            <span className="font-mono text-sm">{client.crescimento >= 0 ? '+' : ''}{client.crescimento.toFixed(1)}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
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
