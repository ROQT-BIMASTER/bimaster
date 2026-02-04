import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useDepartmentBudgets } from "@/hooks/useDepartmentBudgets";
import { Loader2, Wallet } from "lucide-react";

interface SolicitarVerbaDepartamentoDialogProps {
  departmentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SolicitarVerbaDepartamentoDialog({ 
  departmentId,
  open, 
  onOpenChange 
}: SolicitarVerbaDepartamentoDialogProps) {
  const { createBudget } = useDepartmentBudgets(departmentId);

  const [formData, setFormData] = useState({
    name: "",
    total_amount: "",
    period_start: "",
    period_end: "",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.total_amount || !formData.period_start || !formData.period_end) {
      return;
    }

    await createBudget.mutateAsync({
      department_id: departmentId,
      name: formData.name,
      total_amount: parseFloat(formData.total_amount),
      period_start: formData.period_start,
      period_end: formData.period_end,
      notes: formData.notes || undefined,
    });

    // Reset form
    setFormData({
      name: "",
      total_amount: "",
      period_start: "",
      period_end: "",
      notes: "",
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Solicitar Verba
          </DialogTitle>
          <DialogDescription>
            Solicite uma nova verba para o departamento. A solicitação será enviada para aprovação do financeiro.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome da Verba *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Verba Anual 2024"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="total_amount">Valor Solicitado (R$) *</Label>
            <Input
              id="total_amount"
              type="number"
              step="0.01"
              min="0"
              value={formData.total_amount}
              onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })}
              placeholder="0,00"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="period_start">Início do Período *</Label>
              <Input
                id="period_start"
                type="date"
                value={formData.period_start}
                onChange={(e) => setFormData({ ...formData, period_start: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="period_end">Fim do Período *</Label>
              <Input
                id="period_end"
                type="date"
                value={formData.period_end}
                onChange={(e) => setFormData({ ...formData, period_end: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Justificativa</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Explique a necessidade desta verba..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={createBudget.isPending || !formData.name || !formData.total_amount}
            >
              {createBudget.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Wallet className="mr-2 h-4 w-4" />
              Solicitar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
