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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDepartmentExpenses, DEPARTMENT_EXPENSE_CATEGORIES } from "@/hooks/useDepartmentExpenses";
import { useDepartmentBudgets } from "@/hooks/useDepartmentBudgets";
import { Loader2, Plus, FileText, Wallet } from "lucide-react";

interface NovaDespesaDepartamentoDialogProps {
  departmentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NovaDespesaDepartamentoDialog({ 
  departmentId,
  open, 
  onOpenChange 
}: NovaDespesaDepartamentoDialogProps) {
  const { createExpense } = useDepartmentExpenses(departmentId);
  const { activeBudgets } = useDepartmentBudgets(departmentId);

  const [formData, setFormData] = useState({
    category: "",
    description: "",
    valor_previsto: "",
    valor_realizado: "",
    expense_date: "",
    budget_id: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.category) {
      return;
    }

    await createExpense.mutateAsync({
      department_id: departmentId,
      category: formData.category,
      description: formData.description || undefined,
      valor_previsto: formData.valor_previsto ? parseFloat(formData.valor_previsto) : undefined,
      valor_realizado: formData.valor_realizado ? parseFloat(formData.valor_realizado) : undefined,
      expense_date: formData.expense_date || undefined,
      budget_id: formData.budget_id || undefined,
    });

    // Reset form
    setFormData({
      category: "",
      description: "",
      valor_previsto: "",
      valor_realizado: "",
      expense_date: "",
      budget_id: "",
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Nova Despesa
          </DialogTitle>
          <DialogDescription>
            Registre uma nova despesa para o departamento
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="category">Categoria *</Label>
            <Select
              value={formData.category}
              onValueChange={(value) => setFormData({ ...formData, category: value })}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                {DEPARTMENT_EXPENSE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descreva a despesa..."
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="valor_previsto">Valor Previsto (R$)</Label>
              <Input
                id="valor_previsto"
                type="number"
                step="0.01"
                min="0"
                value={formData.valor_previsto}
                onChange={(e) => setFormData({ ...formData, valor_previsto: e.target.value })}
                placeholder="0,00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="valor_realizado">Valor Realizado (R$)</Label>
              <Input
                id="valor_realizado"
                type="number"
                step="0.01"
                min="0"
                value={formData.valor_realizado}
                onChange={(e) => setFormData({ ...formData, valor_realizado: e.target.value })}
                placeholder="0,00"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="expense_date">Data da Despesa</Label>
              <Input
                id="expense_date"
                type="date"
                value={formData.expense_date}
                onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="budget_id">Verba (opcional)</Label>
              <Select
                value={formData.budget_id}
                onValueChange={(value) => setFormData({ ...formData, budget_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {activeBudgets.map((budget) => (
                    <SelectItem key={budget.id} value={budget.id}>
                      <div className="flex items-center gap-2">
                        <Wallet className="h-3 w-3" />
                        {budget.code} - {budget.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createExpense.isPending || !formData.category}>
              {createExpense.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <FileText className="mr-2 h-4 w-4" />
              Criar Despesa
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
