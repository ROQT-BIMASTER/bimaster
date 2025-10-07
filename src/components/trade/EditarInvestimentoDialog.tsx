import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface EditarInvestimentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  investmentId: string;
  onSuccess?: () => void;
}

export const EditarInvestimentoDialog = ({ 
  open, 
  onOpenChange, 
  investmentId,
  onSuccess 
}: EditarInvestimentoDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [stores, setStores] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    store_id: "",
    investment_date: "",
    category: "",
    amount: "",
    description: "",
    payment_method: "",
    notes: "",
  });

  useEffect(() => {
    if (open && investmentId) {
      fetchInvestmentData();
      fetchStores();
    }
  }, [open, investmentId]);

  const fetchStores = async () => {
    const { data } = await supabase
      .from("stores")
      .select("id, name, city")
      .eq("status", "active")
      .order("name");
    if (data) setStores(data);
  };

  const fetchInvestmentData = async () => {
    try {
      const { data, error } = await supabase
        .from("trade_investments")
        .select("*")
        .eq("id", investmentId)
        .single();

      if (error) throw error;

      if (data) {
        setFormData({
          store_id: data.store_id || "",
          investment_date: data.investment_date || "",
          category: data.category || "",
          amount: data.amount?.toString() || "",
          description: data.description || "",
          payment_method: data.payment_method || "",
          notes: data.notes || "",
        });
      }
    } catch (error) {
      console.error("Erro ao carregar investimento:", error);
      toast.error("Erro ao carregar dados do investimento");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from("trade_investments")
        .update({
          store_id: formData.store_id,
          investment_date: formData.investment_date,
          category: formData.category,
          amount: parseFloat(formData.amount),
          description: formData.description,
          payment_method: formData.payment_method,
          notes: formData.notes,
        })
        .eq("id", investmentId);

      if (error) throw error;

      toast.success("Investimento atualizado com sucesso!");
      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao atualizar investimento:", error);
      toast.error("Erro ao atualizar investimento: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar Investimento</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>PDV / Loja *</Label>
              <Select value={formData.store_id} onValueChange={(value) => setFormData(prev => ({ ...prev, store_id: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o PDV" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name} - {store.city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Data do Investimento *</Label>
              <Input
                type="date"
                value={formData.investment_date}
                onChange={(e) => setFormData(prev => ({ ...prev, investment_date: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Categoria *</Label>
              <Select value={formData.category} onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="merchandising">Merchandising</SelectItem>
                  <SelectItem value="promotion">Promoção</SelectItem>
                  <SelectItem value="training">Treinamento</SelectItem>
                  <SelectItem value="equipment">Equipamento</SelectItem>
                  <SelectItem value="other">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Valor (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                placeholder="0,00"
                required
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label>Descrição *</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descreva o investimento"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Forma de Pagamento</Label>
              <Select value={formData.payment_method} onValueChange={(value) => setFormData(prev => ({ ...prev, payment_method: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Dinheiro</SelectItem>
                  <SelectItem value="debit">Débito</SelectItem>
                  <SelectItem value="credit">Crédito</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="transfer">Transferência</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 col-span-2">
              <Label>Observações</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Observações adicionais"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Alterações
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
