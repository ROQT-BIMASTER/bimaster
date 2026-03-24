import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { CheckCircle2, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import { useProcessDecisions } from "@/hooks/useProcessDecisions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processId: string;
  submissaoId: string;
  documentos?: Array<{ id: string; nome_arquivo?: string; tipo_documento: string }>;
}

const DECISION_TYPES = [
  { value: "approved" as const, label: "Aprovar", icon: CheckCircle2, color: "text-success", bg: "bg-success/10 border-success/30 hover:bg-success/20" },
  { value: "rejected" as const, label: "Rejeitar", icon: XCircle, color: "text-destructive", bg: "bg-destructive/10 border-destructive/30 hover:bg-destructive/20" },
  { value: "needs_revision" as const, label: "Solicitar Ajuste", icon: AlertTriangle, color: "text-warning", bg: "bg-warning/10 border-warning/30 hover:bg-warning/20" },
] as const;

export function ProcessDecisionDialog({ open, onOpenChange, processId, submissaoId, documentos = [] }: Props) {
  const { createDecision } = useProcessDecisions(processId, submissaoId);
  const [decisionType, setDecisionType] = useState<"approved" | "rejected" | "needs_revision" | null>(null);
  const [message, setMessage] = useState("");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [prazoRetorno, setPrazoRetorno] = useState("");

  const handleSubmit = async () => {
    if (!decisionType || !message.trim()) {
      toast.error("Selecione o tipo de decisão e preencha o motivo.");
      return;
    }

    const items = Array.from(selectedItems).map(id => {
      const doc = documentos.find(d => d.id === id);
      return { documento_id: id, label: doc?.nome_arquivo || doc?.tipo_documento || id };
    });

    try {
      await createDecision.mutateAsync({
        process_id: processId,
        submissao_id: submissaoId,
        origin: "brasil",
        destination: "china",
        decision_type: decisionType,
        message: message.trim(),
        items_affected: items.length > 0 ? items : undefined,
        prazo_retorno: prazoRetorno || undefined,
      });
      toast.success("Decisão registrada com sucesso.");
      resetAndClose();
    } catch {
      toast.error("Erro ao registrar decisão.");
    }
  };

  const resetAndClose = () => {
    setDecisionType(null);
    setMessage("");
    setSelectedItems(new Set());
    setPrazoRetorno("");
    onOpenChange(false);
  };

  const toggleItem = (id: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            📜 Decisão do Brasil
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Decision type selector */}
          <div className="grid grid-cols-3 gap-2">
            {DECISION_TYPES.map(dt => {
              const Icon = dt.icon;
              const isActive = decisionType === dt.value;
              return (
                <button
                  key={dt.value}
                  onClick={() => setDecisionType(dt.value)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all text-sm font-medium",
                    isActive ? dt.bg + " border-2" : "border-border hover:bg-accent/30"
                  )}
                >
                  <Icon className={cn("h-5 w-5", isActive ? dt.color : "text-muted-foreground")} />
                  <span className={isActive ? dt.color : "text-foreground"}>{dt.label}</span>
                </button>
              );
            })}
          </div>

          {/* Message */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Motivo / Justificativa *</Label>
            <Textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Descreva o motivo da decisão..."
              rows={3}
            />
          </div>

          {/* Affected items (for needs_revision) */}
          {decisionType === "needs_revision" && documentos.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Itens que precisam de correção</Label>
              <div className="max-h-40 overflow-y-auto space-y-1 rounded-lg border p-2">
                {documentos.map(doc => (
                  <label key={doc.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent/30 px-2 py-1 rounded">
                    <Checkbox
                      checked={selectedItems.has(doc.id)}
                      onCheckedChange={() => toggleItem(doc.id)}
                    />
                    <span className="truncate">{doc.nome_arquivo || doc.tipo_documento}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Prazo (for needs_revision) */}
          {decisionType === "needs_revision" && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Prazo de retorno</Label>
              <Input
                type="date"
                value={prazoRetorno}
                onChange={e => setPrazoRetorno(e.target.value)}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={resetAndClose}>Cancelar</Button>
          <Button
            onClick={handleSubmit}
            disabled={!decisionType || !message.trim() || createDecision.isPending}
          >
            {createDecision.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Registrar Decisão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
