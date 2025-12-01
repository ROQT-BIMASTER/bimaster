import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { sanitizeText, sanitizeCode } from "@/lib/utils/sanitize";

interface SolicitarOrcamentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function SolicitarOrcamentoDialog({
  open,
  onOpenChange,
  onSuccess,
}: SolicitarOrcamentoDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const formData = new FormData(e.currentTarget);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error("Usuário não autenticado");
      }

      const name = sanitizeText(formData.get("name") as string);
      const code = sanitizeCode(formData.get("code") as string);
      const total_amount = parseFloat(formData.get("total_amount") as string);
      const period_start = formData.get("period_start") as string;
      const period_end = formData.get("period_end") as string;
      const notes = sanitizeText(formData.get("notes") as string || "");

      // Validações
      if (!name || name.length < 3) {
        throw new Error("Nome deve ter no mínimo 3 caracteres");
      }
      if (!code || code.length < 2) {
        throw new Error("Código deve ter no mínimo 2 caracteres");
      }
      if (!total_amount || total_amount <= 0) {
        throw new Error("Valor deve ser maior que zero");
      }
      if (new Date(period_end) <= new Date(period_start)) {
        throw new Error("Data de fim deve ser posterior à data de início");
      }

      const { error } = await supabase.from("trade_budgets").insert({
        name,
        code,
        total_amount,
        period_start,
        period_end,
        notes,
        approval_status: "pending",
        status: "inactive",
        requested_by: user.id,
      });

      if (error) throw error;

      toast.success("Solicitação de orçamento enviada para aprovação!");
      onOpenChange(false);
      onSuccess();
      (e.target as HTMLFormElement).reset();
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar solicitação");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Solicitar Novo Orçamento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Orçamento *</Label>
              <Input
                id="name"
                name="name"
                placeholder="Ex: Campanha Verão 2025"
                required
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Código *</Label>
              <Input
                id="code"
                name="code"
                placeholder="Ex: CAMP-2025-01"
                required
                maxLength={20}
                style={{ textTransform: 'uppercase' }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="total_amount">Valor Total Solicitado *</Label>
            <Input
              id="total_amount"
              name="total_amount"
              type="number"
              step="0.01"
              min="0.01"
              max="10000000"
              placeholder="0.00"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="period_start">Data Início *</Label>
              <Input
                id="period_start"
                name="period_start"
                type="date"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="period_end">Data Fim *</Label>
              <Input
                id="period_end"
                name="period_end"
                type="date"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Justificativa</Label>
            <Textarea
              id="notes"
              name="notes"
              placeholder="Descreva a justificativa para este orçamento..."
              rows={4}
              maxLength={1000}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Solicitar Orçamento
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}