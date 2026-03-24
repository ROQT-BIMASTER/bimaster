import { useProcessDecisions, type ProcessDecision } from "@/hooks/useProcessDecisions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, AlertTriangle, Clock, ChevronDown } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";

interface Props {
  submissaoId: string;
  processId?: string;
  onReenviar?: (decision: ProcessDecision) => void;
}

const decisionConfig = {
  approved: { label: "Aprovado", icon: CheckCircle2, color: "text-success", bg: "bg-success/10", badge: "default" as const },
  rejected: { label: "Rejeitado", icon: XCircle, color: "text-destructive", bg: "bg-destructive/10", badge: "destructive" as const },
  needs_revision: { label: "Ajuste Solicitado", icon: AlertTriangle, color: "text-warning", bg: "bg-warning/10", badge: "secondary" as const },
};

export function ChinaInboxDecisoes({ submissaoId, processId, onReenviar }: Props) {
  const { decisions, isLoading } = useProcessDecisions(processId, submissaoId);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const chinaDecisions = decisions.filter(d => d.destination === "china");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (chinaDecisions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        Nenhuma decisão do Brasil recebida.
      </div>
    );
  }

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        📥 Decisões do Brasil
        <Badge variant="outline" className="text-xs">{chinaDecisions.length}</Badge>
      </h3>

      {chinaDecisions.map((decision) => {
        const config = decisionConfig[decision.decision_type];
        const Icon = config.icon;
        const isOverdue = decision.prazo_retorno && new Date(decision.prazo_retorno) < new Date();
        const daysLeft = decision.prazo_retorno
          ? differenceInDays(new Date(decision.prazo_retorno), new Date())
          : null;

        return (
          <Collapsible
            key={decision.id}
            open={expandedIds.has(decision.id)}
            onOpenChange={() => toggleExpanded(decision.id)}
          >
            <Card className={cn("border", config.bg)}>
              <CollapsibleTrigger asChild>
                <CardHeader className="pb-2 cursor-pointer hover:opacity-80">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className={cn("h-4 w-4", config.color)} />
                      <CardTitle className="text-sm">{config.label}</CardTitle>
                      <Badge variant="outline" className="text-xs">V{decision.version}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      {decision.prazo_retorno && (
                        <Badge variant={isOverdue ? "destructive" : "outline"} className="text-xs flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {isOverdue ? "Atrasado" : `${daysLeft}d restantes`}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(decision.decided_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </span>
                      <ChevronDown className={cn(
                        "h-4 w-4 text-muted-foreground transition-transform",
                        expandedIds.has(decision.id) && "rotate-180"
                      )} />
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <CardContent className="pt-0 space-y-3">
                  <p className="text-sm text-foreground">{decision.message}</p>

                  {decision.items_affected && (decision.items_affected as any[]).length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Itens Pendentes:</p>
                      <ul className="space-y-1">
                        {(decision.items_affected as any[]).map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="text-destructive mt-0.5">●</span>
                            <div>
                              <span className="font-medium">{item.label}</span>
                              {item.motivo && (
                                <span className="text-muted-foreground ml-1">— {item.motivo}</span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {decision.decision_type === "needs_revision" && onReenviar && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onReenviar(decision)}
                      className="mt-2"
                    >
                      🔄 Reenviar Correções
                    </Button>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}
    </div>
  );
}
