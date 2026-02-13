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
import { resolveStorageUrl } from "@/lib/utils/storage-url";
import { CheckCircle2, XCircle, FileText, ExternalLink, Store, CreditCard, Calendar, User, DollarSign, Send } from "lucide-react";
import { getSafeErrorMessage } from "@/lib/utils/sanitize";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AprovarLancamentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: any;
  onSuccess: () => void;
  onApproveAndSend?: (entry: any) => void;
  type?: "entry" | "investment";
}

export function AprovarLancamentoDialog({
  open,
  onOpenChange,
  entry,
  onSuccess,
  onApproveAndSend,
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
      
      // Se for lançamento com verba vinculada, verificar saldo disponível
      if (type === "entry" && entry.budget_id) {
        const { data: budget, error: budgetError } = await supabase
          .from("trade_budgets")
          .select("total_amount, spent_amount, reserved_amount")
          .eq("id", entry.budget_id)
          .single();

        if (budgetError) throw budgetError;

        const available = 
          parseFloat(String(budget.total_amount)) - 
          parseFloat(String(budget.spent_amount || 0)) - 
          parseFloat(String(budget.reserved_amount || 0));

        if (available < parseFloat(entry.amount)) {
          throw new Error(`Saldo insuficiente na verba. Disponível: R$ ${available.toFixed(2)}`);
        }

        // Consumir o crédito
        const newSpentAmount = parseFloat(String(budget.spent_amount || 0)) + parseFloat(entry.amount);
        const { error: updateBudgetError } = await supabase
          .from("trade_budgets")
          .update({ spent_amount: newSpentAmount })
          .eq("id", entry.budget_id);

        if (updateBudgetError) throw updateBudgetError;
      }

      // Atualizar o lançamento/investimento
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

      toast.success(
        type === "investment" 
          ? "Investimento aprovado com sucesso!" 
          : entry.budget_id 
            ? "Lançamento aprovado e crédito consumido!"
            : "Lançamento aprovado com sucesso!"
      );
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
      <DialogContent className="sm:max-w-[700px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {type === "investment" ? "Revisar Investimento" : "Revisar Lançamento Financeiro"}
          </DialogTitle>
          <DialogDescription>
            Analise todos os detalhes e documentos antes de tomar sua decisão
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6 py-4">
            {/* Informações Principais */}
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <DollarSign className="h-4 w-4" />
                      <span>Valor Solicitado</span>
                    </div>
                    <p className="text-2xl font-bold text-primary">
                      R$ {parseFloat(entry.amount).toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>Data</span>
                    </div>
                    <p className="text-lg font-semibold">
                      {new Date(type === "investment" ? entry.investment_date : entry.entry_date).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric"
                      })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Solicitante */}
            {entry.created_by_profile && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <User className="h-4 w-4" />
                  Solicitante
                </div>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex flex-col gap-1">
                      <p className="font-medium">{entry.created_by_profile.nome}</p>
                      <p className="text-sm text-muted-foreground">{entry.created_by_profile.email}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Loja */}
            {entry.store && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Store className="h-4 w-4" />
                  PDV / Loja
                </div>
                <Card>
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Nome</p>
                        <p className="font-medium mt-1">{entry.store.name}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Código</p>
                        <p className="font-mono mt-1">{entry.store.code}</p>
                      </div>
                      {entry.store.address && (
                        <div className="col-span-2">
                          <p className="text-muted-foreground text-xs">Endereço</p>
                          <p className="mt-1">{entry.store.address}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Categoria/Tipo */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <CreditCard className="h-4 w-4" />
                {type === "investment" ? "Categoria do Investimento" : "Tipo de Lançamento"}
              </div>
              <Card>
                <CardContent className="pt-4">
                  <Badge variant="secondary" className="text-sm">
                    {type === "investment" 
                      ? entry.category?.replace(/_/g, " ").toUpperCase()
                      : entry.entry_type?.replace(/_/g, " ").toUpperCase()
                    }
                  </Badge>
                  {type === "investment" && entry.payment_method && (
                    <div className="mt-3">
                      <p className="text-xs text-muted-foreground">Forma de Pagamento</p>
                      <p className="text-sm mt-1 capitalize">{entry.payment_method.replace(/_/g, " ")}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Verba Vinculada (apenas para lançamentos) */}
            {type === "entry" && entry.budget && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <DollarSign className="h-4 w-4" />
                  Verba Vinculada
                </div>
                <Card className="border-blue-200 bg-blue-50/50">
                  <CardContent className="pt-4">
                    <div className="space-y-3">
                      <div>
                        <p className="font-semibold text-sm">{entry.budget.code} - {entry.budget.name}</p>
                      </div>
                      <Separator />
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground text-xs">Total Verba</p>
                          <p className="font-semibold text-green-600 mt-1">
                            R$ {parseFloat(entry.budget.total_amount || 0).toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                            })}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Já Utilizado</p>
                          <p className="font-semibold text-orange-600 mt-1">
                            R$ {parseFloat(entry.budget.spent_amount || 0).toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                            })}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Disponível</p>
                          <p className="font-semibold text-blue-600 mt-1">
                            R$ {(
                              parseFloat(entry.budget.total_amount || 0) -
                              parseFloat(entry.budget.spent_amount || 0) -
                              parseFloat(entry.budget.reserved_amount || 0)
                            ).toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                            })}
                          </p>
                        </div>
                      </div>
                      {(parseFloat(entry.budget.total_amount || 0) - 
                        parseFloat(entry.budget.spent_amount || 0) - 
                        parseFloat(entry.budget.reserved_amount || 0)) < parseFloat(entry.amount) && (
                        <div className="bg-red-100 border border-red-300 rounded p-3 mt-2">
                          <p className="text-xs text-red-700 font-semibold">
                            ⚠️ ATENÇÃO: Saldo insuficiente para este lançamento!
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Descrição e Observações */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <FileText className="h-4 w-4" />
                Detalhes
              </div>
              <Card>
                <CardContent className="pt-4 space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Descrição</p>
                    <p className="text-sm">{entry.description}</p>
                  </div>
                  {entry.notes && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Observações Adicionais</p>
                        <p className="text-sm whitespace-pre-wrap">{entry.notes}</p>
                      </div>
                    </>
                  )}
                  {entry.reference_number && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Número de Referência</p>
                        <p className="text-sm font-mono">{entry.reference_number}</p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Documentos Anexos */}
            {(entry.document_url || entry.receipt_url) && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <FileText className="h-4 w-4" />
                  Documentos Anexados
                </div>
                <Card className="border-green-200 bg-green-50/50">
                  <CardContent className="pt-4">
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={async () => {
                        const url = entry.document_url || entry.receipt_url;
                        const { signedUrl, error } = await resolveStorageUrl(url);
                        if (error || !signedUrl) { toast.error(error || "Erro ao abrir documento"); return; }
                        window.open(signedUrl, "_blank");
                      }}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Abrir Comprovante / Nota Fiscal
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Campo de Rejeição */}
            {action === "reject" && (
              <Card className="border-red-200 bg-red-50/50">
                <CardContent className="pt-4 space-y-2">
                  <Label htmlFor="rejection-reason" className="text-red-700 font-semibold">
                    Motivo da Rejeição *
                  </Label>
                  <Textarea
                    id="rejection-reason"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Explique detalhadamente o motivo da rejeição para que o solicitante possa entender..."
                    className="min-h-[120px] bg-white"
                  />
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>

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
              {type === "entry" && onApproveAndSend && (
                <Button 
                  onClick={async () => {
                    await handleApprove();
                    onApproveAndSend(entry);
                  }} 
                  disabled={loading}
                  variant="default"
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Aprovar e Enviar
                </Button>
              )}
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
