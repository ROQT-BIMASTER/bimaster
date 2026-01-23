import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { 
  Plus, 
  Edit, 
  Trash2, 
  FileText,
  Loader2,
  Package
} from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface CampaignOrder {
  id: string;
  campaign_id: string;
  numero_pedido: string;
  numero_nf: string | null;
  valor_pedido: number;
  data_pedido: string | null;
  data_nf: string | null;
  observacoes: string | null;
}

interface CampaignOrdersManagerProps {
  campaignId: string;
}

export function CampaignOrdersManager({ campaignId }: CampaignOrdersManagerProps) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<CampaignOrder | null>(null);
  const [formData, setFormData] = useState({
    numero_pedido: '',
    numero_nf: '',
    valor_pedido: '',
    data_pedido: '',
    data_nf: '',
    observacoes: '',
  });

  const { data: orders, isLoading } = useQuery({
    queryKey: ['campaign-orders', campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trade_campaign_orders')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as CampaignOrder[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<CampaignOrder>) => {
      if (editingOrder) {
        const { error } = await supabase
          .from('trade_campaign_orders')
          .update({
            numero_pedido: data.numero_pedido,
            numero_nf: data.numero_nf || null,
            valor_pedido: data.valor_pedido || 0,
            data_pedido: data.data_pedido || null,
            data_nf: data.data_nf || null,
            observacoes: data.observacoes || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingOrder.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('trade_campaign_orders')
          .insert({
            campaign_id: campaignId,
            numero_pedido: data.numero_pedido,
            numero_nf: data.numero_nf || null,
            valor_pedido: data.valor_pedido || 0,
            data_pedido: data.data_pedido || null,
            data_nf: data.data_nf || null,
            observacoes: data.observacoes || null,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign-orders', campaignId] });
      toast.success(editingOrder ? 'Pedido atualizado!' : 'Pedido adicionado!');
      handleCloseDialog();
    },
    onError: (error) => {
      console.error('Error saving order:', error);
      toast.error('Erro ao salvar pedido');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from('trade_campaign_orders')
        .delete()
        .eq('id', orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign-orders', campaignId] });
      toast.success('Pedido removido!');
    },
    onError: (error) => {
      console.error('Error deleting order:', error);
      toast.error('Erro ao remover pedido');
    },
  });

  const handleOpenDialog = (order?: CampaignOrder) => {
    if (order) {
      setEditingOrder(order);
      setFormData({
        numero_pedido: order.numero_pedido,
        numero_nf: order.numero_nf || '',
        valor_pedido: order.valor_pedido.toString(),
        data_pedido: order.data_pedido || '',
        data_nf: order.data_nf || '',
        observacoes: order.observacoes || '',
      });
    } else {
      setEditingOrder(null);
      setFormData({
        numero_pedido: '',
        numero_nf: '',
        valor_pedido: '',
        data_pedido: '',
        data_nf: '',
        observacoes: '',
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingOrder(null);
    setFormData({
      numero_pedido: '',
      numero_nf: '',
      valor_pedido: '',
      data_pedido: '',
      data_nf: '',
      observacoes: '',
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.numero_pedido.trim()) {
      toast.error('Número do pedido é obrigatório');
      return;
    }

    saveMutation.mutate({
      numero_pedido: formData.numero_pedido,
      numero_nf: formData.numero_nf || null,
      valor_pedido: parseFloat(formData.valor_pedido) || 0,
      data_pedido: formData.data_pedido || null,
      data_nf: formData.data_nf || null,
      observacoes: formData.observacoes || null,
    });
  };

  const totalValue = orders?.reduce((acc, o) => acc + (o.valor_pedido || 0), 0) || 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {orders?.length || 0} pedido(s) - Total: {formatCurrency(totalValue)}
        </p>
        <Button variant="outline" size="sm" onClick={() => handleOpenDialog()}>
          <Plus className="h-3 w-3 mr-1" />
          Adicionar
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-2">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : orders && orders.length > 0 ? (
        <div className="space-y-1.5">
          {orders.map((order) => (
            <div 
              key={order.id} 
              className="flex items-center justify-between p-2 bg-muted/50 rounded-md text-sm"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs">
                    #{order.numero_pedido}
                  </Badge>
                  {order.numero_nf && (
                    <Badge variant="secondary" className="font-mono text-xs">
                      NF: {order.numero_nf}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span className="font-mono">{formatCurrency(order.valor_pedido)}</span>
                  {order.data_pedido && (
                    <span>
                      {format(new Date(order.data_pedido), 'dd/MM/yy', { locale: ptBR })}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6"
                  onClick={() => handleOpenDialog(order)}
                >
                  <Edit className="h-3 w-3" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 text-destructive hover:text-destructive"
                  onClick={() => deleteMutation.mutate(order.id)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-2">
          Nenhum pedido cadastrado
        </p>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingOrder ? 'Editar Pedido' : 'Novo Pedido'}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="numero_pedido">Nº Pedido *</Label>
                <Input
                  id="numero_pedido"
                  value={formData.numero_pedido}
                  onChange={(e) => setFormData(prev => ({ ...prev, numero_pedido: e.target.value }))}
                  placeholder="Ex: 12345"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="numero_nf">Nº NF</Label>
                <Input
                  id="numero_nf"
                  value={formData.numero_nf}
                  onChange={(e) => setFormData(prev => ({ ...prev, numero_nf: e.target.value }))}
                  placeholder="Ex: 67890"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="valor_pedido">Valor (R$)</Label>
                <Input
                  id="valor_pedido"
                  type="number"
                  step="0.01"
                  value={formData.valor_pedido}
                  onChange={(e) => setFormData(prev => ({ ...prev, valor_pedido: e.target.value }))}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="data_pedido">Data Pedido</Label>
                <Input
                  id="data_pedido"
                  type="date"
                  value={formData.data_pedido}
                  onChange={(e) => setFormData(prev => ({ ...prev, data_pedido: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="data_nf">Data NF</Label>
              <Input
                id="data_nf"
                type="date"
                value={formData.data_nf}
                onChange={(e) => setFormData(prev => ({ ...prev, data_nf: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="observacoes">Observações</Label>
              <Input
                id="observacoes"
                value={formData.observacoes}
                onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                placeholder="Observações..."
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingOrder ? 'Salvar' : 'Adicionar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
