import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, XCircle } from "lucide-react";
import { getSafeErrorMessage } from "@/lib/utils/sanitize";

interface AprovarLancamentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: any;
  onSuccess: () => void;
  type?: "entry" | "investment";
}

export function AprovarLancamentoDialog({
  open,
  onOpenChange,
  entry,
  onSuccess,
  type = "entry",
}: AprovarLancamentoDialogProps) {
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<"approve" | "reject" | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const handleApprove = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const tableName = type === "investment" ? "trade_investments" : "trade_financial_entries";
      const updateData: any = {
        approval_status: "approved",
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      };

      if (type === "entry") {
        updateData.status = "approved";
        updateData.updated_at = new Date().toISOString();
      } else {
        updateData.status = "approved";
      }

      const { error } = await supabase
        .from(tableName)
        .update(updateData)
        .eq("id", entry.id);

      if (error) throw error;

      toast.success(type === "investment" ? "Investimento aprovado com sucesso!" : "Lançamento aprovado com sucesso!");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(getSafeErrorMessage(error));
    } finally {
      setLoading(false);
      setAction(null);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error("Por favor, informe o motivo da rejeição");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const tableName = type === "investment" ? "trade_investments" : "trade_financial_entries";
      const updateData: any = {
        approval_status: "rejected",
        status: "rejected",
        rejected_reason: rejectionReason,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      };

      if (type === "entry") {
        updateData.updated_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from(tableName)
        .update(updateData)
        .eq("id", entry.id);

      if (error) throw error;

      toast.success(type === "investment" ? "Investimento rejeitado" : "Lançamento rejeitado");
      onSuccess();
      onOpenChange(false);
      setRejectionReason("");
    } catch (error: any) {
      toast.error(getSafeErrorMessage(error));
    } finally {
      setLoading(false);
      setAction(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {type === "investment" ? "Aprovar Investimento" : "Aprovar Lançamento Financeiro"}
          </DialogTitle>
          <DialogDescription>
            Revise as informações e aprove ou rejeite este {type === "investment" ? "investimento" : "lançamento"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Valor</p>
              <p className="font-semibold">
                R$ {parseFloat(entry.amount).toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Data</p>
              <p className="font-semibold">
                {new Date(type === "investment" ? entry.investment_date : entry.entry_date).toLocaleDateString("pt-BR")}
              </p>
            </div>
          </div>

          {type === "investment" && entry.category && (
            <div>
              <p className="text-sm text-muted-foreground">Categoria</p>
              <p className="text-sm mt-1 capitalize">{entry.category}</p>
            </div>
          )}

          <div>
            <p className="text-sm text-muted-foreground">Descrição</p>
            <p className="text-sm mt-1">{entry.description}</p>
          </div>

          {entry.notes && (
            <div>
              <p className="text-sm text-muted-foreground">Observações</p>
              <p className="text-sm mt-1">{entry.notes}</p>
            </div>
          )}

          {action === "reject" && (
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">Motivo da Rejeição *</Label>
              <Textarea
                id="rejection-reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explique o motivo da rejeição..."
                className="min-h-[100px]"
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {action === null ? (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={() => setAction("reject")}
                disabled={loading}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Rejeitar
              </Button>
              <Button onClick={handleApprove} disabled={loading}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Aprovar
              </Button>
            </>
          ) : action === "reject" ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setAction(null);
                  setRejectionReason("");
                }}
                disabled={loading}
              >
                Voltar
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={loading}
              >
                Confirmar Rejeição
              </Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
