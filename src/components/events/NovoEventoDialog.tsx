import { useState, ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCorporateEvents, useEventBudgets, useEventUsers } from "@/hooks/useCorporateEvents";
import { Loader2 } from "lucide-react";

interface NovoEventoDialogProps {
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function NovoEventoDialog({ children, open, onOpenChange }: NovoEventoDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  const setIsOpen = onOpenChange ?? setInternalOpen;

  const { createEvent } = useCorporateEvents();
  const { data: budgets } = useEventBudgets();
  const { data: users } = useEventUsers();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    event_type: "interno",
    event_date: "",
    end_date: "",
    location: "",
    budget_id: "",
    budget_amount: "",
    responsible_user_id: "",
    confidential: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    await createEvent.mutateAsync({
      name: formData.name,
      description: formData.description || undefined,
      event_type: formData.event_type,
      event_date: formData.event_date || undefined,
      end_date: formData.end_date || undefined,
      location: formData.location || undefined,
      budget_id: formData.budget_id || undefined,
      budget_amount: formData.budget_amount ? parseFloat(formData.budget_amount) : undefined,
      responsible_user_id: formData.responsible_user_id || undefined,
      confidential: formData.confidential,
    });

    setIsOpen(false);
    setFormData({
      name: "",
      description: "",
      event_type: "interno",
      event_date: "",
      end_date: "",
      location: "",
      budget_id: "",
      budget_amount: "",
      responsible_user_id: "",
      confidential: false,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Evento Corporativo</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label htmlFor="name">Nome do Evento *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Conferência Anual 2026"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="event_type">Tipo de Evento</Label>
              <Select
                value={formData.event_type}
                onValueChange={(value) => setFormData({ ...formData, event_type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="conferencia">Conferência</SelectItem>
                  <SelectItem value="workshop">Workshop</SelectItem>
                  <SelectItem value="feira">Feira</SelectItem>
                  <SelectItem value="interno">Evento Interno</SelectItem>
                  <SelectItem value="externo">Evento Externo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Local</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Local do evento"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="event_date">Data Início</Label>
              <Input
                id="event_date"
                type="date"
                value={formData.event_date}
                onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_date">Data Término</Label>
              <Input
                id="end_date"
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Detalhes sobre o evento..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="budget_id">Verba (Opcional)</Label>
              <Select
                value={formData.budget_id}
                onValueChange={(value) => setFormData({ ...formData, budget_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma verba" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sem verba vinculada</SelectItem>
                  {budgets?.map((budget) => (
                    <SelectItem key={budget.id} value={budget.id}>
                      {budget.code} - {budget.name} (Disponível: R$ {parseFloat(String(budget.available_amount || 0)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="budget_amount">Orçamento do Evento (R$)</Label>
              <Input
                id="budget_amount"
                type="number"
                step="0.01"
                min="0"
                value={formData.budget_amount}
                onChange={(e) => setFormData({ ...formData, budget_amount: e.target.value })}
                placeholder="0,00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="responsible_user_id">Responsável</Label>
            <Select
              value={formData.responsible_user_id}
              onValueChange={(value) => setFormData({ ...formData, responsible_user_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o responsável" />
              </SelectTrigger>
              <SelectContent>
                {users?.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="confidential"
              checked={formData.confidential}
              onCheckedChange={(checked) => setFormData({ ...formData, confidential: checked })}
            />
            <Label htmlFor="confidential" className="text-sm">
              Evento Confidencial (Acesso Restrito)
            </Label>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createEvent.isPending}>
              {createEvent.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar Evento
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
