import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { ModuleBreadcrumb } from "@/components/navigation/ModuleBreadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  Award
} from 'lucide-react';

interface SellerReport {
  seller_id: string;
  seller_nome: string;
  seller_avatar: string | null;
  total_campanhas: number;
  total_investido: number;
  total_receita: number;
  roi_medio: number;
  campanhas_aprovadas: number;
  campanhas_concluidas: number;
}

export default function TradeReportSellers() {
  const [searchTerm, setSearchTerm] = useState('');

  const { data: sellerReports, isLoading } = useQuery({
    queryKey: ['trade-report-sellers'],
    queryFn: async () => {
      // Fetch campaigns with responsible user
      const { data: campaigns, error: campaignsError } = await supabase
        .from('trade_campaigns')
        .select(`
          id,
          responsible_user_id,
          actual_cost,
          actual_revenue,
          roi_percentual,
          status
        `)
        .not('responsible_user_id', 'is', null);

      if (campaignsError) throw campaignsError;

      // Fetch profiles for seller names
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, nome');

      const profilesMap = new Map(
        profiles?.map(p => [p.id, { nome: p.nome, avatar: null }]) || []
      );

      // Aggregate by seller
      const sellerMap = new Map<string, SellerReport>();

      campaigns?.forEach(campaign => {
        const sellerId = campaign.responsible_user_id;
        if (!sellerId) return;

        const profile = profilesMap.get(sellerId);
        const existing = sellerMap.get(sellerId) || {
          seller_id: sellerId,
          seller_nome: profile?.nome || 'Vendedor não encontrado',
          seller_avatar: profile?.avatar || null,
          total_campanhas: 0,
          total_investido: 0,
          total_receita: 0,
          roi_medio: 0,
          campanhas_aprovadas: 0,
          campanhas_concluidas: 0,
        };

        existing.total_campanhas += 1;
        existing.total_investido += campaign.actual_cost || 0;
        existing.total_receita += campaign.actual_revenue || 0;
        
        if (campaign.status === 'approved' || campaign.status === 'in_progress') {
          existing.campanhas_aprovadas += 1;
        }
        if (campaign.status === 'completed') {
          existing.campanhas_concluidas += 1;
        }

        sellerMap.set(sellerId, existing);
      });

      // Calculate ROI
      const results = Array.from(sellerMap.values()).map(seller => {
        seller.roi_medio = seller.total_investido > 0
          ? ((seller.total_receita - seller.total_investido) / seller.total_investido) * 100
          : 0;
        return seller;
      });

      return results.sort((a, b) => b.total_receita - a.total_receita);
    },
  });

  const filteredSellers = useMemo(() => {
    if (!sellerReports) return [];
    if (!searchTerm) return sellerReports;
    
    const term = searchTerm.toLowerCase();
    return sellerReports.filter(s => 
      s.seller_nome?.toLowerCase().includes(term)
    );
  }, [sellerReports, searchTerm]);

  const metrics = useMemo(() => {
    if (!filteredSellers.length) return {
      totalVendedores: 0,
      totalInvestido: 0,
      totalReceita: 0,
      roiMedio: 0,
    };

    const totalInvestido = filteredSellers.reduce((acc, s) => acc + s.total_investido, 0);
    const totalReceita = filteredSellers.reduce((acc, s) => acc + s.total_receita, 0);
    const roiMedio = totalInvestido > 0 
      ? ((totalReceita - totalInvestido) / totalInvestido) * 100 
      : 0;

    return {
      totalVendedores: filteredSellers.length,
      totalInvestido,
      totalReceita,
      roiMedio,
    };
  }, [filteredSellers]);

  const handleExport = () => {
    if (!filteredSellers.length) return;
    
    const headers = ['Vendedor', 'Campanhas', 'Aprovadas', 'Concluídas', 'Total Investido', 'Total Receita', 'ROI Médio'];
    const rows = filteredSellers.map(s => [
      s.seller_nome,
      s.total_campanhas,
      s.campanhas_aprovadas,
      s.campanhas_concluidas,
      s.total_investido,
      s.total_receita,
      s.roi_medio.toFixed(2),
    ]);
    
    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio-vendedores-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
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

  // Find top performer
  const topPerformer = filteredSellers.length > 0 
    ? filteredSellers.reduce((prev, curr) => prev.roi_medio > curr.roi_medio ? prev : curr)
    : null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <ModuleBreadcrumb 
          moduleName="Administrativo Trade" 
          moduleHref="/dashboard/trade/admin" 
          currentPage="Relatório por Vendedor" 
        />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Relatório por Vendedor</h1>
            <p className="text-muted-foreground mt-1">Performance individual da equipe de trade</p>
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
                <span className="text-2xl font-bold">{metrics.totalVendedores}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Vendedores Ativos</p>
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

        {/* Top Performer */}
        {topPerformer && topPerformer.roi_medio > 0 && (
          <Card className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20 border-amber-200 dark:border-amber-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <Award className="h-8 w-8 text-amber-500" />
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={topPerformer.seller_avatar || undefined} />
                    <AvatarFallback>{getInitials(topPerformer.seller_nome)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">Destaque: {topPerformer.seller_nome}</p>
                    <p className="text-sm text-muted-foreground">
                      Melhor ROI: <span className="text-green-600 font-medium">+{topPerformer.roi_medio.toFixed(1)}%</span>
                      {' '}com {topPerformer.total_campanhas} campanhas
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Table */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="text-lg">Vendedores</CardTitle>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar vendedor..."
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
                    <TableHead className="min-w-[200px]">Vendedor</TableHead>
                    <TableHead className="text-center">Campanhas</TableHead>
                    <TableHead className="text-center">Aprovadas</TableHead>
                    <TableHead className="text-center">Concluídas</TableHead>
                    <TableHead className="text-right">Investido</TableHead>
                    <TableHead className="text-right">Receita</TableHead>
                    <TableHead className="text-center">ROI</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSellers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                        Nenhum vendedor encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSellers.map((seller) => (
                      <TableRow key={seller.seller_id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={seller.seller_avatar || undefined} />
                              <AvatarFallback className="text-xs">{getInitials(seller.seller_nome)}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{seller.seller_nome}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{seller.total_campanhas}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-green-600 border-green-300">
                            {seller.campanhas_aprovadas}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">{seller.campanhas_concluidas}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(seller.total_investido)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(seller.total_receita)}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className={`flex items-center justify-center gap-1 ${seller.roi_medio >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {seller.roi_medio >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            <span className="font-mono text-sm">{seller.roi_medio >= 0 ? '+' : ''}{seller.roi_medio.toFixed(1)}%</span>
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
