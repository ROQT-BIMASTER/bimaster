import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Search, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Users,
  DollarSign,
  Percent,
  Package,
  MoreHorizontal,
  Eye,
  Trash2,
  Building2
} from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { ClientCampaignDrawer } from './ClientCampaignDrawer';

interface LancamentoClientData {
  id: string;
  campaign_id: string;
  campaign_code: string;
  campaign_name: string;
  data_lancamento: string;
  valor_pedido: number;
  tipo_brinde: string | null;
  sell_out_anterior: number;
  sell_out_atual: number;
  roi_percentual: number | null;
  status: string;
  customer_id: string | null;
  customer_name: string;
  total_pecas: number;
}

export function CampaignClientTable() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [lancamentoToDelete, setLancamentoToDelete] = useState<string | null>(null);

  // Fetch lancamentos (execution entries) with client info
  const { data: lancamentos, isLoading } = useQuery({
    queryKey: ['lancamentos-by-client'],
    queryFn: async () => {
      // Fetch lancamentos with campaign info
      const { data: lancamentosData, error: lancamentosError } = await supabase
        .from('trade_campaign_lancamentos')
        .select(`
          id,
          campaign_id,
          customer_id,
          data_lancamento,
          valor_pedido,
          tipo_brinde,
          sell_out_anterior,
          sell_out_atual,
          roi_percentual,
          status,
          trade_campaigns(id, name, code)
        `)
        .order('data_lancamento', { ascending: false });

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
        campaign_code: lancamento.trade_campaigns?.code || '',
        campaign_name: lancamento.trade_campaigns?.name || 'Campanha não encontrada',
        data_lancamento: lancamento.data_lancamento,
        valor_pedido: lancamento.valor_pedido || 0,
        tipo_brinde: lancamento.tipo_brinde,
        sell_out_anterior: lancamento.sell_out_anterior || 0,
        sell_out_atual: lancamento.sell_out_atual || 0,
        roi_percentual: lancamento.roi_percentual,
        status: lancamento.status || 'pending',
        customer_id: lancamento.customer_id,
        customer_name: lancamento.customer_id 
          ? prospectsMap.get(lancamento.customer_id) || 'Cliente não encontrado'
          : 'Sem cliente',
        total_pecas: productTotals.get(lancamento.id) || 0,
      })) as LancamentoClientData[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (lancamentoId: string) => {
      const { error } = await supabase
        .from('trade_campaign_lancamentos')
        .delete()
        .eq('id', lancamentoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lancamentos-by-client'] });
      toast.success('Lançamento excluído com sucesso');
      setDeleteDialogOpen(false);
      setLancamentoToDelete(null);
    },
    onError: (error) => {
      console.error('Error deleting lancamento:', error);
      toast.error('Erro ao excluir lançamento');
    },
  });

  // Filter lancamentos by search term
  const filteredLancamentos = useMemo(() => {
    if (!lancamentos) return [];
    if (!searchTerm) return lancamentos;
    
    const term = searchTerm.toLowerCase();
    return lancamentos.filter(l => 
      l.customer_name?.toLowerCase().includes(term) ||
      l.campaign_name?.toLowerCase().includes(term) ||
      l.campaign_code?.toLowerCase().includes(term)
    );
  }, [lancamentos, searchTerm]);

  // Get lancamentos for selected client
  const clientLancamentos = useMemo(() => {
    if (!lancamentos || !selectedClient) return [];
    return lancamentos.filter(l => l.customer_name === selectedClient);
  }, [lancamentos, selectedClient]);

  // Calculate summary metrics
  const metrics = useMemo(() => {
    if (!filteredLancamentos.length) return {
      totalClientes: 0,
      valorTotal: 0,
      roiMedio: 0,
      totalPecas: 0,
    };

    const clientesUnicos = new Set(filteredLancamentos.map(l => l.customer_id));
    const valorTotal = filteredLancamentos.reduce((acc, l) => acc + l.valor_pedido, 0);
    const rois = filteredLancamentos.filter(l => l.roi_percentual != null);
    const roiMedio = rois.length > 0 
      ? rois.reduce((acc, l) => acc + (l.roi_percentual || 0), 0) / rois.length 
      : 0;
    const totalPecas = filteredLancamentos.reduce((acc, l) => acc + l.total_pecas, 0);

    return {
      totalClientes: clientesUnicos.size,
      valorTotal,
      roiMedio,
      totalPecas,
    };
  }, [filteredLancamentos]);

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

  const handleViewClient = (clientName: string | null) => {
    if (!clientName) return;
    setSelectedClient(clientName);
    setDrawerOpen(true);
  };

  const handleViewCampaign = (campaignId: string) => {
    navigate(`/dashboard/trade/financeiro/campanhas/${campaignId}`);
  };

  const handleDeleteLancamento = (lancamentoId: string) => {
    setLancamentoToDelete(lancamentoId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (lancamentoToDelete) {
      deleteMutation.mutate(lancamentoToDelete);
    }
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">{metrics.totalClientes}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Clientes com Lançamentos</p>
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
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">{metrics.totalPecas.toLocaleString('pt-BR')}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total de Peças</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-lg">Lançamentos por Cliente</CardTitle>
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
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader className="bg-primary/10 sticky top-0">
                <TableRow className="border-b-2 border-primary/20">
                  <TableHead className="min-w-[150px] font-semibold text-primary">Cliente</TableHead>
                  <TableHead className="min-w-[180px] font-semibold text-primary">Campanha</TableHead>
                  <TableHead className="min-w-[100px] font-semibold text-primary">Data Lançamento</TableHead>
                  <TableHead className="min-w-[120px] text-right font-semibold text-primary">Valor Pedido</TableHead>
                  <TableHead className="min-w-[100px] font-semibold text-primary">Brinde</TableHead>
                  <TableHead className="min-w-[180px] font-semibold text-primary">Anterior X Atual</TableHead>
                  <TableHead className="min-w-[80px] text-center font-semibold text-primary">ROI</TableHead>
                  <TableHead className="min-w-[80px] text-right font-semibold text-primary">Peças</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLancamentos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                      {searchTerm ? 'Nenhum lançamento encontrado para a busca.' : 'Nenhum lançamento registrado ainda.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLancamentos.map((lancamento) => (
                    <TableRow key={lancamento.id} className="hover:bg-primary/5 transition-colors odd:bg-muted/30 even:bg-background border-b border-muted">
                      <TableCell>
                        <Button
                          variant="link"
                          className="p-0 h-auto font-medium text-left justify-start"
                          onClick={() => handleViewClient(lancamento.customer_name)}
                        >
                          <Building2 className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                          {lancamento.customer_name}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{lancamento.campaign_name}</p>
                          <p className="text-xs text-muted-foreground">{lancamento.campaign_code}</p>
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
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewCampaign(lancamento.campaign_id)}>
                              <Eye className="mr-2 h-4 w-4" />
                              Ver Campanha
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => handleDeleteLancamento(lancamento.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Excluir Lançamento
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Client Campaign Drawer */}
      <ClientCampaignDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        clientName={selectedClient}
        campaigns={clientLancamentos.map(l => ({
          id: l.id,
          code: l.campaign_code,
          name: l.campaign_name,
          start_date: l.data_lancamento,
          valor_pedido: l.valor_pedido,
          tipo_brinde: l.tipo_brinde,
          sell_out_anterior: l.sell_out_anterior,
          sell_out_atual: l.sell_out_atual,
          roi_percentual: l.roi_percentual,
          status: l.status,
          cliente_nome: l.customer_name,
          customer_id: l.customer_id,
          total_pecas: l.total_pecas,
        }))}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
