import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Users, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Percent, 
  Package, 
  Building2,
  Target,
  Calendar,
  BarChart3,
  Eye,
  Search,
  Minus,
  Filter
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency } from "@/lib/formatters";
import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";

interface LancamentoResult {
  id: string;
  campaign_id: string;
  campaign_name: string;
  campaign_code: string;
  campaign_type: string;
  customer_id: string | null;
  customer_name: string;
  data_lancamento: string;
  valor_pedido: number;
  tipo_brinde: string | null;
  sell_out_anterior: number;
  sell_out_atual: number;
  unon_anterior: number | null;
  unon_atual: number | null;
  crescimento_percentual: number | null;
  roi_percentual: number | null;
  status: string;
  total_pecas: number;
}

export function CampaignResultsPanel() {
  const navigate = useNavigate();
  const { isAdminOrSupervisor, loading: roleLoading } = useUserRole();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCampaign, setSelectedCampaign] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id || null);
    });
  }, []);

  // Fetch all lancamentos with campaign and customer info
  const { data: lancamentos, isLoading } = useQuery({
    queryKey: ['campaign-results-panel', isAdminOrSupervisor, currentUserId],
    enabled: !roleLoading && currentUserId !== null,
    queryFn: async () => {
      // Fetch lancamentos with campaign info
      let query = supabase
        .from('trade_campaign_lancamentos')
        .select(`
          id,
          campaign_id,
          customer_id,
          created_by,
          data_lancamento,
          valor_pedido,
          tipo_brinde,
          sell_out_anterior,
          sell_out_atual,
          unon_anterior,
          unon_atual,
          crescimento_percentual,
          roi_percentual,
          status,
          trade_campaigns(id, name, code, campaign_type)
        `);

      // Filtrar para não-admins/supervisores
      if (!isAdminOrSupervisor && currentUserId) {
        query = query.eq("created_by", currentUserId);
      }

      const { data: lancamentosData, error: lancamentosError } = await query.order('data_lancamento', { ascending: false });

      if (lancamentosError) throw lancamentosError;

      // Fetch prospects for customer names
      const { data: prospects } = await supabase
        .from('prospects')
        .select('id, nome_empresa');

      const prospectsMap = new Map(
        prospects?.map(p => [p.id, p.nome_empresa]) || []
      );

      // Fetch product quantities per lancamento
      const { data: products } = await supabase
        .from('trade_campaign_products')
        .select('lancamento_id, quantity');

      const productTotals = new Map<string, number>();
      products?.forEach(p => {
        if (p.lancamento_id) {
          const current = productTotals.get(p.lancamento_id) || 0;
          productTotals.set(p.lancamento_id, current + (p.quantity || 0));
        }
      });

      // Combine data
      return lancamentosData?.map(lancamento => ({
        id: lancamento.id,
        campaign_id: lancamento.campaign_id,
        campaign_name: lancamento.trade_campaigns?.name || 'Campanha não encontrada',
        campaign_code: lancamento.trade_campaigns?.code || '',
        campaign_type: lancamento.trade_campaigns?.campaign_type || '',
        customer_id: lancamento.customer_id,
        customer_name: lancamento.customer_id 
          ? prospectsMap.get(lancamento.customer_id) || 'Cliente não encontrado'
          : 'Sem cliente',
        data_lancamento: lancamento.data_lancamento,
        valor_pedido: lancamento.valor_pedido || 0,
        tipo_brinde: lancamento.tipo_brinde,
        sell_out_anterior: lancamento.sell_out_anterior || 0,
        sell_out_atual: lancamento.sell_out_atual || 0,
        unon_anterior: lancamento.unon_anterior,
        unon_atual: lancamento.unon_atual,
        crescimento_percentual: lancamento.crescimento_percentual,
        roi_percentual: lancamento.roi_percentual,
        status: lancamento.status || 'pending',
        total_pecas: productTotals.get(lancamento.id) || 0,
      })) as LancamentoResult[];
    },
  });

  // Get unique campaigns for filter
  const campaignOptions = useMemo(() => {
    if (!lancamentos) return [];
    const unique = new Map<string, { id: string; name: string; code: string }>();
    lancamentos.forEach(l => {
      if (!unique.has(l.campaign_id)) {
        unique.set(l.campaign_id, { 
          id: l.campaign_id, 
          name: l.campaign_name, 
          code: l.campaign_code 
        });
      }
    });
    return Array.from(unique.values());
  }, [lancamentos]);

  // Filter lancamentos
  const filteredLancamentos = useMemo(() => {
    if (!lancamentos) return [];
    
    return lancamentos.filter(l => {
      // Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesSearch = 
          l.customer_name.toLowerCase().includes(term) ||
          l.campaign_name.toLowerCase().includes(term) ||
          l.campaign_code.toLowerCase().includes(term);
        if (!matchesSearch) return false;
      }
      
      // Campaign filter
      if (selectedCampaign !== 'all' && l.campaign_id !== selectedCampaign) {
        return false;
      }
      
      // Status filter
      if (selectedStatus !== 'all' && l.status !== selectedStatus) {
        return false;
      }
      
      return true;
    });
  }, [lancamentos, searchTerm, selectedCampaign, selectedStatus]);

  // Calculate metrics
  const metrics = useMemo(() => {
    if (!filteredLancamentos.length) return {
      totalLancamentos: 0,
      clientesUnicos: 0,
      valorTotal: 0,
      roiMedio: 0,
      crescimentoMedio: 0,
      totalPecas: 0,
      sellOutAnterior: 0,
      sellOutAtual: 0,
    };

    const clientesUnicos = new Set(filteredLancamentos.map(l => l.customer_id)).size;
    const valorTotal = filteredLancamentos.reduce((acc, l) => acc + l.valor_pedido, 0);
    const rois = filteredLancamentos.filter(l => l.roi_percentual != null);
    const roiMedio = rois.length > 0 
      ? rois.reduce((acc, l) => acc + (l.roi_percentual || 0), 0) / rois.length 
      : 0;
    const crescimentos = filteredLancamentos.filter(l => l.crescimento_percentual != null);
    const crescimentoMedio = crescimentos.length > 0
      ? crescimentos.reduce((acc, l) => acc + (l.crescimento_percentual || 0), 0) / crescimentos.length
      : 0;
    const totalPecas = filteredLancamentos.reduce((acc, l) => acc + l.total_pecas, 0);
    const sellOutAnterior = filteredLancamentos.reduce((acc, l) => acc + l.sell_out_anterior, 0);
    const sellOutAtual = filteredLancamentos.reduce((acc, l) => acc + l.sell_out_atual, 0);

    return {
      totalLancamentos: filteredLancamentos.length,
      clientesUnicos,
      valorTotal,
      roiMedio,
      crescimentoMedio,
      totalPecas,
      sellOutAnterior,
      sellOutAtual,
    };
  }, [filteredLancamentos]);

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: "default" | "secondary" | "outline" | "destructive"; label: string }> = {
      pending: { variant: "outline", label: "Pendente" },
      approved: { variant: "default", label: "Aprovado" },
      completed: { variant: "secondary", label: "Concluído" },
      rejected: { variant: "destructive", label: "Rejeitado" },
    };
    const { variant, label } = config[status] || config.pending;
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
      compre_ganhe: "Compre e Ganhe",
    };
    return labels[type] || type;
  };

  const renderComparison = (anterior: number, atual: number) => {
    const diff = anterior > 0 ? ((atual - anterior) / anterior) * 100 : 0;

    const TrendIcon = diff > 0 ? TrendingUp : diff < 0 ? TrendingDown : Minus;
    const trendColor = diff > 0 ? 'text-success' : diff < 0 ? 'text-destructive' : 'text-muted-foreground';

    return (
      <div className="flex items-center gap-1 text-sm">
        <span className="text-muted-foreground">{formatCurrency(anterior)}</span>
        <span className="text-muted-foreground">→</span>
        <span className="font-medium">{formatCurrency(atual)}</span>
        {diff !== 0 && (
          <span className={`flex items-center gap-0.5 ${trendColor}`}>
            <TrendIcon className="h-3 w-3" />
            <span className="text-xs">({diff > 0 ? '+' : ''}{diff.toFixed(0)}%)</span>
          </span>
        )}
      </div>
    );
  };

  const renderRoiBadge = (roi: number | null) => {
    if (roi == null) return <Badge variant="secondary">-</Badge>;
    const isPositive = roi >= 0;
    return (
      <Badge variant={isPositive ? 'default' : 'destructive'} className="font-mono">
        {isPositive ? '+' : ''}{roi.toFixed(1)}%
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-4 w-24 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">{metrics.totalLancamentos}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total Lançamentos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">{metrics.clientesUnicos}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Clientes Únicos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">{formatCurrency(metrics.valorTotal)}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Valor Total Pedidos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Percent className="h-4 w-4 text-muted-foreground" />
              <span className={`text-2xl font-bold ${metrics.roiMedio >= 0 ? 'text-success' : 'text-destructive'}`}>
                {metrics.roiMedio >= 0 ? '+' : ''}{metrics.roiMedio.toFixed(1)}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">ROI Médio</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className={`text-2xl font-bold ${metrics.crescimentoMedio >= 0 ? 'text-success' : 'text-destructive'}`}>
                {metrics.crescimentoMedio >= 0 ? '+' : ''}{metrics.crescimentoMedio.toFixed(1)}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Crescimento Médio</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">{metrics.totalPecas.toLocaleString('pt-BR')}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total de Peças</p>
          </CardContent>
        </Card>
      </div>

      {/* Sell Out Comparison Card */}
      <Card className="bg-gradient-to-r from-primary/5 to-transparent border-primary/20">
        <CardContent className="py-4">
          <div className="flex flex-col md:flex-row items-center justify-around gap-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Sell Out Anterior (Total)</p>
              <p className="text-2xl font-bold">{formatCurrency(metrics.sellOutAnterior)}</p>
            </div>
            <div className="flex items-center gap-2">
              {metrics.sellOutAtual >= metrics.sellOutAnterior ? (
                <TrendingUp className="h-8 w-8 text-success" />
              ) : (
                <TrendingDown className="h-8 w-8 text-destructive" />
              )}
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Sell Out Atual (Total)</p>
              <p className="text-2xl font-bold text-primary">{formatCurrency(metrics.sellOutAtual)}</p>
            </div>
            <div className="text-center border-l pl-4">
              <p className="text-sm text-muted-foreground">Incremento</p>
              <p className={`text-2xl font-bold ${metrics.sellOutAtual >= metrics.sellOutAnterior ? 'text-success' : 'text-destructive'}`}>
                {formatCurrency(metrics.sellOutAtual - metrics.sellOutAnterior)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters and Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Painel Geral de Resultados
              </CardTitle>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar cliente ou campanha..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                <SelectTrigger className="w-[200px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filtrar campanha" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Campanhas</SelectItem>
                  {campaignOptions.map((campaign) => (
                    <SelectItem key={campaign.id} value={campaign.id}>
                      {campaign.code} - {campaign.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Status</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="approved">Aprovado</SelectItem>
                  <SelectItem value="completed">Concluído</SelectItem>
                  <SelectItem value="rejected">Rejeitado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <CardDescription className="mt-2">
            Visão consolidada de todos os lançamentos de campanhas
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader className="bg-primary/10 sticky top-0">
                <TableRow className="border-b-2 border-primary/20">
                  <TableHead className="min-w-[150px] font-semibold text-primary">Cliente</TableHead>
                  <TableHead className="min-w-[180px] font-semibold text-primary">Campanha</TableHead>
                  <TableHead className="min-w-[100px] font-semibold text-primary">Data</TableHead>
                  <TableHead className="min-w-[120px] text-right font-semibold text-primary">Valor Pedido</TableHead>
                  <TableHead className="min-w-[100px] font-semibold text-primary">Brinde</TableHead>
                  <TableHead className="min-w-[220px] font-semibold text-primary">Sell Out (Anterior → Atual)</TableHead>
                  <TableHead className="min-w-[80px] text-center font-semibold text-primary">ROI</TableHead>
                  <TableHead className="min-w-[80px] text-right font-semibold text-primary">Peças</TableHead>
                  <TableHead className="min-w-[80px] font-semibold text-primary">Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLancamentos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                      {searchTerm || selectedCampaign !== 'all' || selectedStatus !== 'all' 
                        ? 'Nenhum lançamento encontrado para os filtros aplicados.' 
                        : 'Nenhum lançamento registrado ainda.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLancamentos.map((lancamento) => (
                    <TableRow key={lancamento.id} className="hover:bg-primary/5 transition-colors odd:bg-muted/30 even:bg-background border-b border-muted">
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-medium">{lancamento.customer_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{lancamento.campaign_name}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{lancamento.campaign_code}</span>
                            <Badge variant="outline" className="text-xs py-0">
                              {getCampaignTypeLabel(lancamento.campaign_type)}
                            </Badge>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {lancamento.data_lancamento 
                          ? format(new Date(lancamento.data_lancamento), 'dd/MM/yyyy', { locale: ptBR })
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(lancamento.valor_pedido)}
                      </TableCell>
                      <TableCell>
                        {lancamento.tipo_brinde ? (
                          <Badge variant="secondary">{lancamento.tipo_brinde}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {renderComparison(lancamento.sell_out_anterior, lancamento.sell_out_atual)}
                      </TableCell>
                      <TableCell className="text-center">
                        {renderRoiBadge(lancamento.roi_percentual)}
                      </TableCell>
                      <TableCell className="text-right">
                        {lancamento.total_pecas > 0 ? lancamento.total_pecas.toLocaleString('pt-BR') : '-'}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(lancamento.status)}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigate(`/dashboard/trade/financeiro/campanhas/${lancamento.campaign_id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
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
  );
}
