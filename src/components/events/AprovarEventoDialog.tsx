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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useCorporateEvents, useEventBudgets, CorporateEvent } from "@/hooks/useCorporateEvents";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Calendar, 
  MapPin, 
  DollarSign, 
  User, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2
} from "lucide-react";

interface AprovarEventoDialogProps {
  event: CorporateEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AprovarEventoDialog({ event, open, onOpenChange }: AprovarEventoDialogProps) {
  const [selectedBudgetId, setSelectedBudgetId] = useState("");
  const [observations, setObservations] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);
  
  const { data: budgets, isLoading: loadingBudgets } = useEventBudgets();
  const { approveEvent, rejectEvent } = useCorporateEvents();

  const selectedBudget = budgets?.find(b => b.id === selectedBudgetId);
  const hasSufficientBalance = selectedBudget 
    ? selectedBudget.available_amount >= (event?.budget_amount || 0)
    : false;

  const getEventTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      conferencia: "Conferência",
      workshop: "Workshop",
      feira: "Feira",
      interno: "Evento Interno",
      externo: "Evento Externo",
    };
    return labels[type] || type;
  };

  const handleApprove = async () => {
    if (!event || !selectedBudgetId) return;

    try {
      await approveEvent.mutateAsync({ 
        id: event.id, 
        budget_id: selectedBudgetId 
      });
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error("Erro ao aprovar evento:", error);
    }
  };

  const handleReject = async () => {
    if (!event) return;
    if (!observations.trim()) {
      return;
    }

    try {
      await rejectEvent.mutateAsync({ 
        id: event.id, 
        observations 
      });
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error("Erro ao rejeitar evento:", error);
    }
  };

  const resetForm = () => {
    setSelectedBudgetId("");
    setObservations("");
    setIsRejecting(false);
  };

  if (!event) return null;

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!newOpen) resetForm();
      onOpenChange(newOpen);
    }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isRejecting ? (
              <>
                <XCircle className="h-5 w-5 text-destructive" />
                Rejeitar Evento
              </>
            ) : (
              <>
                <CheckCircle className="h-5 w-5 text-primary" />
                Aprovar Evento
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isRejecting 
              ? "Informe o motivo da rejeição do evento." 
              : "Revise os detalhes e selecione a verba para aprovação."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Detalhes do Evento */}
          <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">{event.name}</h3>
              <Badge variant="outline" className="font-mono">{event.code}</Badge>
            </div>
            
            {event.description && (
              <p className="text-sm text-muted-foreground">{event.description}</p>
            )}

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>
                  {event.event_date 
                    ? format(new Date(event.event_date), "dd/MM/yyyy", { locale: ptBR })
                    : "Data não definida"}
                  {event.end_date && event.end_date !== event.event_date && (
                    <span className="text-muted-foreground">
                      {" - "}{format(new Date(event.end_date), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  )}
                </span>
              </div>
              
              {event.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{event.location}</span>
                </div>
              )}
              
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">
                  R$ {(event.budget_amount || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{event.creator?.nome || "Não informado"}</span>
              </div>
            </div>

            <Badge variant="secondary">{getEventTypeLabel(event.event_type)}</Badge>
          </div>

          <Separator />

          {!isRejecting ? (
            <>
              {/* Seleção de Verba */}
              <div className="space-y-2">
                <Label htmlFor="budget">Verba para Vinculação *</Label>
                <Select value={selectedBudgetId} onValueChange={setSelectedBudgetId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a verba" />
                  </SelectTrigger>
                  <SelectContent>
                    {loadingBudgets ? (
                      <div className="p-2 text-center text-sm text-muted-foreground">
                        Carregando verbas...
                      </div>
                    ) : budgets?.length === 0 ? (
                      <div className="p-2 text-center text-sm text-muted-foreground">
                        Nenhuma verba disponível
                      </div>
                    ) : (
                      budgets?.map((budget) => (
                        <SelectItem key={budget.id} value={budget.id}>
                          <div className="flex items-center justify-between w-full gap-4">
                            <span>{budget.code} - {budget.name}</span>
                            <span className="text-muted-foreground">
                              R$ {budget.available_amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Alerta de saldo insuficiente */}
              {selectedBudgetId && !hasSufficientBalance && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Saldo insuficiente! A verba selecionada possui apenas R$ {selectedBudget?.available_amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}, 
                    mas o evento solicita R$ {(event.budget_amount || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.
                  </AlertDescription>
                </Alert>
              )}

              {/* Observações opcionais */}
              <div className="space-y-2">
                <Label htmlFor="observations">Observações (opcional)</Label>
                <Textarea
                  id="observations"
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  placeholder="Adicione observações sobre a aprovação..."
                  rows={3}
                />
              </div>
            </>
          ) : (
            /* Motivo da Rejeição */
            <div className="space-y-2">
              <Label htmlFor="reject-reason">Motivo da Rejeição *</Label>
              <Textarea
                id="reject-reason"
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Informe o motivo da rejeição..."
                rows={4}
                required
              />
              {!observations.trim() && (
                <p className="text-sm text-destructive">O motivo da rejeição é obrigatório.</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {!isRejecting ? (
            <>
              <Button
                variant="outline"
                onClick={() => setIsRejecting(true)}
                className="text-destructive hover:text-destructive"
              >
                <XCircle className="mr-2 h-4 w-4" />
                Rejeitar
              </Button>
              <Button
                onClick={handleApprove}
                disabled={!selectedBudgetId || !hasSufficientBalance || approveEvent.isPending}
              >
                {approveEvent.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="mr-2 h-4 w-4" />
                )}
                Aprovar Evento
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setIsRejecting(false)}>
                Voltar
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={!observations.trim() || rejectEvent.isPending}
              >
                {rejectEvent.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="mr-2 h-4 w-4" />
                )}
                Confirmar Rejeição
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
