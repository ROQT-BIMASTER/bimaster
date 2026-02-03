import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle, XCircle, AlertTriangle, Loader2, Calendar, Target, DollarSign, User } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useTradeBudgets } from "@/hooks/useTradeData";

interface AprovacaoCampanhaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: any;
  onSuccess?: () => void;
}

export function AprovacaoCampanhaDialog({
  open,
  onOpenChange,
  campaign,
  onSuccess,
}: AprovacaoCampanhaDialogProps) {
  const queryClient = useQueryClient();
  const [selectedBudgetId, setSelectedBudgetId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  // Buscar verbas aprovadas
  const { data: budgets = [] } = useTradeBudgets({ status: "approved" });

  // Reset states when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedBudgetId(campaign?.budget_id || "");
      setNotes("");
      setRejectReason("");
    }
  }, [open, campaign?.budget_id]);

  const hasBudget = !!campaign?.budget_id;
  const selectedBudget = budgets.find((b: any) => b.id === selectedBudgetId);
  const availableAmount = selectedBudget 
    ? parseFloat(String(selectedBudget.total_amount || 0)) - parseFloat(String(selectedBudget.spent_amount || 0)) - parseFloat(String(selectedBudget.reserved_amount || 0))
    : 0;
  const estimatedCost = parseFloat(String(campaign?.estimated_cost || 0));
  const hasSufficientBalance = availableAmount >= estimatedCost;

  const getCampaignTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      sell_in: "Sell-In",
      sell_out: "Sell-Out",
      institucional: "Institucional",
      cooperada: "Cooperada",
      mdf: "MDF",
      midia: "Mídia",
      incentivo: "Incentivo",
      degustacao: "Degustação",
      bonificacao: "Bonificação",
    };
    return labels[type] || type;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  // Mutação para aprovar campanha
  const approveMutation = useMutation({
    mutationFn: async () => {
      const finalBudgetId = selectedBudgetId || campaign.budget_id;
      
      if (!finalBudgetId) {
        throw new Error("Selecione uma verba para aprovar esta campanha");
      }

      // Verificar saldo disponível
      const budget = budgets.find((b: any) => b.id === finalBudgetId);
      if (budget) {
        const available = parseFloat(String(budget.total_amount || 0)) - parseFloat(String(budget.spent_amount || 0)) - parseFloat(String(budget.reserved_amount || 0));
        if (available < estimatedCost) {
          throw new Error(`Saldo insuficiente na verba. Disponível: ${formatCurrency(available)}, Necessário: ${formatCurrency(estimatedCost)}`);
        }
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from("trade_campaigns")
        .update({
          budget_id: finalBudgetId,
          status: "approved",
          validation_status: "approved",
          validation_notes: notes || null,
          validated_by: user.id,
          validated_at: new Date().toISOString(),
        })
        .eq("id", campaign.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trade-pending-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["trade-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["trade-budgets"] });
      queryClient.invalidateQueries({ queryKey: ["trade-pending-entries"] });
      queryClient.invalidateQueries({ queryKey: ["trade-pending-investments"] });
      toast.success("Campanha aprovada com sucesso!");
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  // Mutação para rejeitar campanha
  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!rejectReason.trim()) {
        throw new Error("Informe o motivo da rejeição");
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from("trade_campaigns")
        .update({
          status: "draft",
          validation_status: "rejected",
          validation_notes: rejectReason,
          validated_by: user.id,
          validated_at: new Date().toISOString(),
        })
        .eq("id", campaign.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trade-pending-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["trade-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["trade-budgets"] });
      toast.success("Campanha rejeitada");
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  if (!campaign) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Revisar Campanha
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informações da Campanha */}
          <div className="grid gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground text-xs">Código</Label>
                <p className="font-mono font-medium">{campaign.code}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Tipo</Label>
                <Badge variant="outline">{getCampaignTypeLabel(campaign.campaign_type)}</Badge>
              </div>
            </div>

            <div>
              <Label className="text-muted-foreground text-xs">Nome</Label>
              <p className="font-semibold">{campaign.name}</p>
            </div>

            {campaign.description && (
              <div>
                <Label className="text-muted-foreground text-xs">Descrição</Label>
                <p className="text-sm">{campaign.description}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label className="text-muted-foreground text-xs">Período</Label>
                  <p className="text-sm">
                    {format(new Date(campaign.start_date), "dd/MM/yyyy")} - {format(new Date(campaign.end_date), "dd/MM/yyyy")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label className="text-muted-foreground text-xs">Custo Estimado</Label>
                  <p className="font-semibold text-primary">{formatCurrency(estimatedCost)}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label className="text-muted-foreground text-xs">Solicitante</Label>
                <p className="text-sm">
                  {campaign.created_by_profile?.nome || "N/A"}
                  {campaign.created_by_profile?.email && (
                    <span className="text-muted-foreground ml-1">({campaign.created_by_profile.email})</span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Vinculação de Verba */}
          {!hasBudget ? (
            <div className="space-y-4 p-4 border-2 border-dashed border-orange-300 bg-orange-50 rounded-lg">
              <div className="flex items-center gap-2 text-orange-700">
                <AlertTriangle className="h-5 w-5" />
                <span className="font-semibold">Vinculação de Verba Obrigatória</span>
              </div>
              <p className="text-sm text-orange-600">
                Esta campanha não possui verba vinculada. Selecione uma verba aprovada para aprovar.
              </p>
              
              <div className="space-y-2">
                <Label htmlFor="budget">Verba *</Label>
                <Select value={selectedBudgetId} onValueChange={setSelectedBudgetId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma verba aprovada" />
                  </SelectTrigger>
                  <SelectContent>
                    {budgets.map((budget: any) => {
                      const available = parseFloat(budget.total_amount || 0) - parseFloat(budget.spent_amount || 0) - parseFloat(budget.reserved_amount || 0);
                      return (
                        <SelectItem key={budget.id} value={budget.id}>
                          {budget.code} - {budget.name} (Disponível: {formatCurrency(available)})
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {selectedBudget && (
                <div className="flex items-center justify-between p-3 bg-white rounded border">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">💰 Disponível: {formatCurrency(availableAmount)}</p>
                    <p className="text-sm text-muted-foreground">📊 Custo campanha: {formatCurrency(estimatedCost)}</p>
                  </div>
                  {hasSufficientBalance ? (
                    <Badge className="bg-green-100 text-green-800">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Saldo OK
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <XCircle className="h-3 w-3 mr-1" />
                      Saldo Insuficiente
                    </Badge>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle className="h-5 w-5" />
                <span className="font-semibold">Verba Vinculada</span>
              </div>
              <p className="text-sm mt-2">
                {campaign.budget?.code} - {campaign.budget?.name}
              </p>
              <p className="text-xs text-green-600 mt-1">
                Disponível: {formatCurrency(
                  parseFloat(String(campaign.budget?.total_amount || 0)) -
                  parseFloat(String(campaign.budget?.spent_amount || 0)) -
                  parseFloat(String(campaign.budget?.reserved_amount || 0))
                )}
              </p>
            </div>
          )}

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="notes">Observações (opcional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Adicione observações sobre a aprovação..."
              rows={2}
            />
          </div>

          {/* Motivo de Rejeição */}
          <div className="space-y-2">
            <Label htmlFor="rejectReason">Motivo da Rejeição (obrigatório se rejeitar)</Label>
            <Textarea
              id="rejectReason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Informe o motivo caso rejeite esta campanha..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() => rejectMutation.mutate()}
            disabled={rejectMutation.isPending || !rejectReason.trim()}
          >
            {rejectMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <XCircle className="h-4 w-4 mr-2" />
            Rejeitar
          </Button>
          <Button
            onClick={() => approveMutation.mutate()}
            disabled={approveMutation.isPending || (!hasBudget && (!selectedBudgetId || !hasSufficientBalance))}
            className="bg-green-600 hover:bg-green-700"
          >
            {approveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <CheckCircle className="h-4 w-4 mr-2" />
            {hasBudget ? "Aprovar Campanha" : "Aprovar e Vincular Verba"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
