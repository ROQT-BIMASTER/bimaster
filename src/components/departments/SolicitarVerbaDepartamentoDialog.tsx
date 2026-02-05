import { useState, useEffect } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDepartmentBudgets } from "@/hooks/useDepartmentBudgets";
import { useUserEmpresas, usePrimaryEmpresa } from "@/hooks/useUserEmpresas";
import { Loader2, Wallet, Building } from "lucide-react";

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
  const { data: userEmpresas = [] } = useUserEmpresas();
  const { primaryEmpresa } = usePrimaryEmpresa();

  const [formData, setFormData] = useState({
    name: "",
    total_amount: "",
    period_start: "",
    period_end: "",
    notes: "",
    empresa_id: "",
  });

  // Pre-selecionar filial principal
  useEffect(() => {
    if (primaryEmpresa && !formData.empresa_id) {
      setFormData(prev => ({ 
        ...prev, 
        empresa_id: primaryEmpresa.id.toString() 
      }));
    }
  }, [primaryEmpresa]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.total_amount || !formData.period_start || !formData.period_end) {
      return;
    }

    const selectedEmpresa = userEmpresas.find(
      ue => ue.empresa_id.toString() === formData.empresa_id
    );

    await createBudget.mutateAsync({
      department_id: departmentId,
      name: formData.name,
      total_amount: parseFloat(formData.total_amount),
      period_start: formData.period_start,
      period_end: formData.period_end,
      notes: formData.notes || undefined,
      empresa_id: selectedEmpresa?.empresa_id,
      empresa_nome: selectedEmpresa?.empresa.nome,
    });

    // Reset form
    setFormData({
      name: "",
      total_amount: "",
      period_start: "",
      period_end: "",
      notes: "",
      empresa_id: primaryEmpresa?.id.toString() || "",
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
          {/* Seletor de Filial */}
          <div className="space-y-2">
            <Label htmlFor="empresa_id" className="flex items-center gap-2">
              <Building className="h-4 w-4" />
              Filial *
            </Label>
            <Select
              value={formData.empresa_id}
              onValueChange={(value) => setFormData({ ...formData, empresa_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a filial" />
              </SelectTrigger>
              <SelectContent>
                {userEmpresas.map((ue) => (
                  <SelectItem key={ue.empresa_id} value={ue.empresa_id.toString()}>
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      {ue.empresa.nome}
                      {ue.is_primary && (
                        <span className="text-xs text-primary">(Principal)</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
