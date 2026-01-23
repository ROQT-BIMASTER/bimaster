import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Building2, 
  TrendingUp, 
  TrendingDown,
  Calendar,
  Package,
  FileText,
  Plus,
  Edit,
  Trash2,
  History
} from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CampaignOrdersManager } from './CampaignOrdersManager';

interface ClientCampaignDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientName: string | null;
  campaigns: Array<{
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
    total_pecas: number;
  }>;
  onEditCampaign?: (campaignId: string) => void;
  onDeleteCampaign?: (campaignId: string) => void;
}

export function ClientCampaignDrawer({
  open,
  onOpenChange,
  clientName,
  campaigns,
  onEditCampaign,
  onDeleteCampaign,
}: ClientCampaignDrawerProps) {
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  // Calculate summary metrics
  const metrics = {
    totalCampaigns: campaigns.length,
    totalValue: campaigns.reduce((acc, c) => acc + (c.valor_pedido || 0), 0),
    avgRoi: campaigns.filter(c => c.roi_percentual != null).length > 0
      ? campaigns.filter(c => c.roi_percentual != null)
          .reduce((acc, c) => acc + (c.roi_percentual || 0), 0) / 
        campaigns.filter(c => c.roi_percentual != null).length
      : 0,
    totalPecas: campaigns.reduce((acc, c) => acc + c.total_pecas, 0),
    totalSelloutGrowth: campaigns.filter(c => c.sell_out_anterior && c.sell_out_atual).length > 0
      ? campaigns
          .filter(c => c.sell_out_anterior && c.sell_out_atual && c.sell_out_anterior > 0)
          .reduce((acc, c) => {
            const growth = ((c.sell_out_atual! - c.sell_out_anterior!) / c.sell_out_anterior!) * 100;
            return acc + growth;
          }, 0) / campaigns.filter(c => c.sell_out_anterior && c.sell_out_atual).length
      : 0,
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      draft: { label: 'Rascunho', variant: 'secondary' },
      pending_approval: { label: 'Aguardando', variant: 'outline' },
      approved: { label: 'Aprovada', variant: 'default' },
      active: { label: 'Ativa', variant: 'default' },
      completed: { label: 'Concluída', variant: 'secondary' },
      cancelled: { label: 'Cancelada', variant: 'destructive' },
    };
    const config = statusMap[status] || { label: status, variant: 'secondary' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-hidden flex flex-col">
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <SheetTitle className="text-lg">{clientName || 'Cliente'}</SheetTitle>
          </div>
          <SheetDescription>
            Histórico completo de campanhas e pedidos
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 py-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Total Campanhas</p>
                  <p className="text-xl font-bold">{metrics.totalCampaigns}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Valor Total</p>
                  <p className="text-xl font-bold">{formatCurrency(metrics.totalValue)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">ROI Médio</p>
                  <p className={`text-xl font-bold ${metrics.avgRoi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {metrics.avgRoi >= 0 ? '+' : ''}{metrics.avgRoi.toFixed(1)}%
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Crescimento Médio</p>
                  <div className="flex items-center gap-1">
                    {metrics.totalSelloutGrowth >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-600" />
                    )}
                    <p className={`text-xl font-bold ${metrics.totalSelloutGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {metrics.totalSelloutGrowth >= 0 ? '+' : ''}{metrics.totalSelloutGrowth.toFixed(1)}%
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Campaigns History */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <History className="h-4 w-4" />
                Histórico de Campanhas
              </h3>
              
              {campaigns.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhuma campanha encontrada para este cliente.
                </p>
              ) : (
                <div className="space-y-3">
                  {campaigns.map((campaign) => (
                    <Card key={campaign.id} className="hover:bg-muted/30 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-medium">{campaign.name}</p>
                            <p className="text-xs text-muted-foreground">{campaign.code}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            {getStatusBadge(campaign.status)}
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7"
                              onClick={() => onEditCampaign?.(campaign.id)}
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => onDeleteCampaign?.(campaign.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Calendar className="h-3.5 w-3.5" />
                            {campaign.start_date 
                              ? format(new Date(campaign.start_date), 'dd/MM/yyyy', { locale: ptBR })
                              : '-'
                            }
                          </div>
                          <div className="text-right font-mono">
                            {formatCurrency(campaign.valor_pedido || 0)}
                          </div>
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Package className="h-3.5 w-3.5" />
                            {campaign.total_pecas.toLocaleString('pt-BR')} peças
                          </div>
                          <div className="text-right">
                            {campaign.roi_percentual != null ? (
                              <Badge variant={campaign.roi_percentual >= 0 ? 'default' : 'destructive'} className="font-mono">
                                ROI: {campaign.roi_percentual >= 0 ? '+' : ''}{campaign.roi_percentual.toFixed(1)}%
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </div>
                        </div>

                        {/* Sell Out Comparison */}
                        {(campaign.sell_out_anterior || campaign.sell_out_atual) && (
                          <div className="mt-2 pt-2 border-t text-sm">
                            <span className="text-muted-foreground">Sell Out: </span>
                            <span className="text-muted-foreground">
                              {campaign.sell_out_anterior?.toLocaleString('pt-BR') || 0}
                            </span>
                            <span className="mx-1">→</span>
                            <span className="font-medium">
                              {campaign.sell_out_atual?.toLocaleString('pt-BR') || 0}
                            </span>
                            {campaign.sell_out_anterior && campaign.sell_out_atual && campaign.sell_out_anterior > 0 && (
                              <span className={`ml-1 ${
                                campaign.sell_out_atual >= campaign.sell_out_anterior 
                                  ? 'text-green-600' 
                                  : 'text-red-600'
                              }`}>
                                ({campaign.sell_out_atual >= campaign.sell_out_anterior ? '+' : ''}
                                {(((campaign.sell_out_atual - campaign.sell_out_anterior) / campaign.sell_out_anterior) * 100).toFixed(0)}%)
                              </span>
                            )}
                          </div>
                        )}

                        {/* Orders Section */}
                        <div className="mt-3 pt-2 border-t">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start text-muted-foreground hover:text-foreground"
                            onClick={() => setSelectedCampaignId(
                              selectedCampaignId === campaign.id ? null : campaign.id
                            )}
                          >
                            <FileText className="h-3.5 w-3.5 mr-1.5" />
                            Ver Pedidos e NFs
                          </Button>
                          
                          {selectedCampaignId === campaign.id && (
                            <div className="mt-2">
                              <CampaignOrdersManager campaignId={campaign.id} />
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
