import { usePaymentQueueHistory, getActionLabel } from "@/hooks/usePaymentQueueHistory";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, UserCircle, Send, RotateCcw, XCircle, CheckCircle, DollarSign, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

interface Props {
  paymentQueueId?: string | null;
}

const ACTION_ICON: Record<string, React.ReactNode> = {
  submitted: <Send className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />,
  corrected: <RotateCcw className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />,
  rejected: <XCircle className="h-3.5 w-3.5 text-destructive" />,
  approved: <CheckCircle className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />,
  paid: <DollarSign className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />,
  edited_by_financial: <Send className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />,
};

const ACTION_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  submitted: "default",
  corrected: "secondary",
  rejected: "destructive",
  approved: "default",
  paid: "default",
};

const FIELD_LABELS: Record<string, string> = {
  supplier_name: "Fornecedor",
  supplier_document: "CNPJ/CPF",
  document_type: "Tipo Documento",
  document_number: "Nº Documento",
  amount: "Valor",
  due_date: "Vencimento",
  portador: "Portador",
  description: "Descrição",
  notes: "Observações",
  department_name: "Departamento",
};

export function PaymentQueueHistory({ paymentQueueId }: Props) {
  const { data: history, isLoading } = usePaymentQueueHistory(paymentQueueId);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  if (!paymentQueueId) return null;
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <Loader2 className="h-3 w-3 animate-spin" />
        Carregando histórico...
      </div>
    );
  }
  if (!history?.length) return null;

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-1">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        <Clock className="h-3 w-3" />
        Histórico ({history.length})
      </h4>
      <ScrollArea className="max-h-[250px]">
        <div className="space-y-2 pr-2">
          {history.map((entry, index) => {
            const isOpen = expandedItems.has(entry.id);
            const snapshot = entry.snapshot || {};
            const snapshotEntries = Object.entries(snapshot).filter(
              ([key]) => !["source_type", "source_id", "source_code", "requested_by", "attachments", "empresa_id", "empresa_nome"].includes(key)
            );

            return (
              <div key={entry.id}>
                <Collapsible open={isOpen} onOpenChange={() => toggleExpand(entry.id)}>
                  <CollapsibleTrigger asChild>
                    <button className="w-full flex items-center gap-2 text-left hover:bg-muted/50 rounded px-2 py-1.5 transition-colors">
                      <div className="rounded-full bg-muted p-1 shrink-0">
                        {ACTION_ICON[entry.action] || <Clock className="h-3.5 w-3.5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant={ACTION_VARIANT[entry.action] || "secondary"} className="text-[10px]">
                            {getActionLabel(entry.action)}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {format(new Date(entry.changed_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        {entry.changed_by_name && (
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                            <UserCircle className="h-2.5 w-2.5" />
                            {entry.changed_by_name}
                          </div>
                        )}
                      </div>
                      {snapshotEntries.length > 0 && (
                        isOpen ? <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                      )}
                    </button>
                  </CollapsibleTrigger>
                  {snapshotEntries.length > 0 && (
                    <CollapsibleContent>
                      <div className="ml-8 mt-1 space-y-0.5 pb-1">
                        {snapshotEntries.map(([key, val]) => (
                          <div key={key} className="text-[10px] bg-muted/30 rounded px-2 py-0.5">
                            <span className="font-medium">{FIELD_LABELS[key] || key}:</span>{" "}
                            <span className="text-foreground">{val === null || val === "" ? "(vazio)" : String(val)}</span>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  )}
                </Collapsible>
                {index < history.length - 1 && <Separator className="mt-1" />}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
