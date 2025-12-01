import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { sanitizeText } from "@/lib/utils/sanitize";

interface Budget {
  id: string;
  name: string;
  code: string;
  total_amount: number;
  period_start: string;
  period_end: string;
  notes?: string;
  requested_by: string;
  approval_status: string;
  profiles?: {
    nome: string;
    email: string;
  };
}

interface AprovarOrcamentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budget: Budget | null;
  onSuccess: () => void;
}

export function AprovarOrcamentoDialog({
  open,
  onOpenChange,
  budget,
  onSuccess,
}: AprovarOrcamentoDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [action, setAction] = useState<"approve" | "reject" | null>(null);

  const handleApprove = async () => {
    if (!budget) return;
    setAction("approve");
    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from("trade_budgets")
        .update({
          approval_status: "approved",
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          status: "active",
        })
        .eq("id", budget.id);

      if (error) throw error;

      toast.success("Orçamento aprovado com sucesso!");
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || "Erro ao aprovar orçamento");
    } finally {
      setIsSubmitting(false);
      setAction(null);
    }
  };

  const handleReject = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!budget) return;
    setAction("reject");
    setIsSubmitting(true);

    try {
      const formData = new FormData(e.currentTarget);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const rejection_reason = sanitizeText(formData.get("rejection_reason") as string);

      if (!rejection_reason || rejection_reason.length < 10) {
        throw new Error("Motivo da rejeição deve ter no mínimo 10 caracteres");
      }

      const { error } = await supabase
        .from("trade_budgets")
        .update({
          approval_status: "rejected",
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          rejection_reason,
          status: "inactive",
        })
        .eq("id", budget.id);

      if (error) throw error;

      toast.success("Orçamento rejeitado");
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || "Erro ao rejeitar orçamento");
    } finally {
      setIsSubmitting(false);
      setAction(null);
    }
  };

  if (!budget) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Aprovar Solicitação de Orçamento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Informações do Solicitante */}
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Solicitante:</span>
              <span className="text-sm">{budget.profiles?.nome || "N/A"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Email:</span>
              <span className="text-sm">{budget.profiles?.email || "N/A"}</span>
            </div>
          </div>

          {/* Detalhes do Orçamento */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome do Orçamento</Label>
              <div className="p-2 bg-muted rounded">{budget.name}</div>
            </div>
            <div className="space-y-2">
              <Label>Código</Label>
              <div className="p-2 bg-muted rounded">
                <Badge variant="outline">{budget.code}</Badge>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Valor Solicitado</Label>
            <div className="p-3 bg-muted rounded text-2xl font-bold">
              {new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL'
              }).format(budget.total_amount)}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Período de Início</Label>
              <div className="p-2 bg-muted rounded">
                {format(new Date(budget.period_start), 'dd/MM/yyyy', { locale: ptBR })}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Período de Fim</Label>
              <div className="p-2 bg-muted rounded">
                {format(new Date(budget.period_end), 'dd/MM/yyyy', { locale: ptBR })}
              </div>
            </div>
          </div>

          {budget.notes && (
            <div className="space-y-2">
              <Label>Justificativa</Label>
              <div className="p-3 bg-muted rounded whitespace-pre-wrap">
                {budget.notes}
              </div>
            </div>
          )}

          {/* Ações */}
          {action === "reject" ? (
            <form onSubmit={handleReject} className="space-y-4 pt-4 border-t">
              <div className="space-y-2">
                <Label htmlFor="rejection_reason">Motivo da Rejeição *</Label>
                <Textarea
                  id="rejection_reason"
                  name="rejection_reason"
                  placeholder="Descreva o motivo da rejeição..."
                  rows={4}
                  required
                  minLength={10}
                  maxLength={500}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAction(null)}
                  disabled={isSubmitting}
                >
                  Voltar
                </Button>
                <Button type="submit" variant="destructive" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <XCircle className="mr-2 h-4 w-4" />
                  Confirmar Rejeição
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => setAction("reject")}
                disabled={isSubmitting}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Rejeitar
              </Button>
              <Button
                type="button"
                onClick={handleApprove}
                disabled={isSubmitting}
              >
                {isSubmitting && action === "approve" && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                <CheckCircle className="mr-2 h-4 w-4" />
                Aprovar
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}