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
  Edit,
  Trash2,
  Building2
} from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { ClientCampaignDrawer } from './ClientCampaignDrawer';

interface CampaignClientData {
  id: string;
  code: string;
  name: string;
  start_date: string;
  valor_pedido: number | null;
  tipo_brinde: string | null;
  sell_out_anterior: number | null;
  sell_out_atual: number | null;
  roi_percentual: number | null;
  status: string;
  cliente_nome: string | null;
  customer_id: string | null;
  total_pecas: number;
}

export function CampaignClientTable() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState<string | null>(null);

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['campaign-client-details'],
    queryFn: async () => {
      // Fetch campaigns with client info
      const { data: campaignsData, error: campaignsError } = await supabase
        .from('trade_campaigns')
        .select(`
          id,
          code,
          name,
          start_date,
          valor_pedido,
          tipo_brinde,
          sell_out_anterior,
          sell_out_atual,
          roi_percentual,
          status,
          customer_id
        `)
        .order('start_date', { ascending: false });

      if (campaignsError) throw campaignsError;

      // Fetch prospects for client names
      const { data: prospects } = await supabase
        .from('prospects')
        .select('id, nome_empresa');

      const prospectsMap = new Map(
        prospects?.map(p => [p.id, p.nome_empresa]) || []
      );

      // Fetch product quantities per campaign
      const { data: products } = await supabase
        .from('trade_campaign_products')
        .select('campaign_id, quantity');

      const productTotals = new Map<string, number>();
      products?.forEach(p => {
        const current = productTotals.get(p.campaign_id) || 0;
        productTotals.set(p.campaign_id, current + (p.quantity || 0));
      });

      // Combine data
      return campaignsData?.map(campaign => ({
        ...campaign,
        cliente_nome: campaign.customer_id 
          ? prospectsMap.get(campaign.customer_id) || 'Cliente não encontrado'
          : 'Sem cliente',
        total_pecas: productTotals.get(campaign.id) || 0,
      })) as CampaignClientData[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      const { error } = await supabase
        .from('trade_campaigns')
        .delete()
        .eq('id', campaignId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign-client-details'] });
      toast.success('Campanha excluída com sucesso');
      setDeleteDialogOpen(false);
      setCampaignToDelete(null);
    },
    onError: (error) => {
      console.error('Error deleting campaign:', error);
      toast.error('Erro ao excluir campanha');
    },
  });

  // Filter campaigns by search term
  const filteredCampaigns = useMemo(() => {
    if (!campaigns) return [];
    if (!searchTerm) return campaigns;
    
    const term = searchTerm.toLowerCase();
    return campaigns.filter(c => 
      c.cliente_nome?.toLowerCase().includes(term) ||
      c.name?.toLowerCase().includes(term) ||
      c.code?.toLowerCase().includes(term)
    );
  }, [campaigns, searchTerm]);

  // Get campaigns for selected client
  const clientCampaigns = useMemo(() => {
    if (!campaigns || !selectedClient) return [];
    return campaigns.filter(c => c.cliente_nome === selectedClient);
  }, [campaigns, selectedClient]);

  // Calculate summary metrics
  const metrics = useMemo(() => {
    if (!filteredCampaigns.length) return {
      totalClientes: 0,
      valorTotal: 0,
      roiMedio: 0,
      totalPecas: 0,
    };

    const clientesUnicos = new Set(filteredCampaigns.map(c => c.cliente_nome));
    const valorTotal = filteredCampaigns.reduce((acc, c) => acc + (c.valor_pedido || 0), 0);
    const rois = filteredCampaigns.filter(c => c.roi_percentual != null);
    const roiMedio = rois.length > 0 
      ? rois.reduce((acc, c) => acc + (c.roi_percentual || 0), 0) / rois.length 
      : 0;
    const totalPecas = filteredCampaigns.reduce((acc, c) => acc + c.total_pecas, 0);

    return {
      totalClientes: clientesUnicos.size,
      valorTotal,
      roiMedio,
      totalPecas,
    };
  }, [filteredCampaigns]);

  const formatCompactValue = (value: number | null) => {
    if (value == null) return '-';
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
    return value.toFixed(0);
  };

  const renderComparison = (anterior: number | null, atual: number | null) => {
    if (anterior == null && atual == null) return <span className="text-muted-foreground">-</span>;
    
    const diff = atual != null && anterior != null && anterior > 0
      ? ((atual - anterior) / anterior) * 100
      : null;

    const TrendIcon = diff == null 
      ? Minus 
      : diff > 0 
        ? TrendingUp 
        : diff < 0 
          ? TrendingDown 
          : Minus;

    const trendColor = diff == null 
      ? 'text-muted-foreground' 
      : diff > 0 
        ? 'text-green-600' 
        : diff < 0 
          ? 'text-red-600' 
          : 'text-muted-foreground';

    return (
      <div className="flex items-center gap-1 text-sm">
        <span className="text-muted-foreground">{formatCompactValue(anterior)}</span>
        <span className="text-muted-foreground">→</span>
        <span className="font-medium">{formatCompactValue(atual)}</span>
        {diff != null && (
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

  const handleEditCampaign = (campaignId: string) => {
    navigate(`/dashboard/trade/financeiro/campanhas/${campaignId}`);
  };

  const handleDeleteCampaign = (campaignId: string) => {
    setCampaignToDelete(campaignId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (campaignToDelete) {
      deleteMutation.mutate(campaignToDelete);
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
            <p className="text-xs text-muted-foreground mt-1">Clientes com Campanhas</p>
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
              <span className={`text-2xl font-bold ${metrics.roiMedio >= 0 ? 'text-green-600' : 'text-red-600'}`}>
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
            <CardTitle className="text-lg">Campanhas por Cliente</CardTitle>
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
              <TableHeader className="bg-muted/50 sticky top-0">
                <TableRow className="border-b-2 border-primary/10">
                  <TableHead className="min-w-[150px] font-semibold">Cliente</TableHead>
                  <TableHead className="min-w-[180px] font-semibold">Campanha</TableHead>
                  <TableHead className="min-w-[100px] font-semibold">Data Entrada</TableHead>
                  <TableHead className="min-w-[120px] text-right font-semibold">Valor Pedido</TableHead>
                  <TableHead className="min-w-[100px] font-semibold">Brinde</TableHead>
                  <TableHead className="min-w-[180px] font-semibold">Anterior X Atual</TableHead>
                  <TableHead className="min-w-[80px] text-center font-semibold">ROI</TableHead>
                  <TableHead className="min-w-[80px] text-right font-semibold">Peças</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCampaigns.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                      {searchTerm ? 'Nenhuma campanha encontrada para a busca.' : 'Nenhuma campanha cadastrada.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCampaigns.map((campaign) => (
                    <TableRow key={campaign.id} className="hover:bg-primary/5 transition-colors even:bg-muted/30">
                      <TableCell>
                        <Button
                          variant="link"
                          className="p-0 h-auto font-medium text-left justify-start"
                          onClick={() => handleViewClient(campaign.cliente_nome)}
                        >
                          <Building2 className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                          {campaign.cliente_nome || '-'}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{campaign.name}</p>
                          <p className="text-xs text-muted-foreground">{campaign.code}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {campaign.start_date 
                          ? format(new Date(campaign.start_date), 'dd/MM/yyyy', { locale: ptBR })
                          : '-'
                        }
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {campaign.valor_pedido != null 
                          ? formatCurrency(campaign.valor_pedido)
                          : '-'
                        }
                      </TableCell>
                      <TableCell>
                        {campaign.tipo_brinde ? (
                          <Badge variant="outline">{campaign.tipo_brinde}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {renderComparison(campaign.sell_out_anterior, campaign.sell_out_atual)}
                      </TableCell>
                      <TableCell className="text-center">
                        {renderRoiBadge(campaign.roi_percentual)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {campaign.total_pecas > 0 
                          ? campaign.total_pecas.toLocaleString('pt-BR')
                          : '-'
                        }
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewClient(campaign.cliente_nome)}>
                              <Eye className="h-4 w-4 mr-2" />
                              Ver Cliente
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEditCampaign(campaign.id)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Editar Campanha
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleDeleteCampaign(campaign.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
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

      {/* Client Drawer */}
      <ClientCampaignDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        clientName={selectedClient}
        campaigns={clientCampaigns}
        onEditCampaign={handleEditCampaign}
        onDeleteCampaign={handleDeleteCampaign}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta campanha? Esta ação não pode ser desfeita.
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
