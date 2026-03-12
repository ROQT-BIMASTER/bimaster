import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useProdutoBrasilHistorico, HISTORICO_ICONS } from "@/hooks/useProdutoBrasilHistorico";

interface Props {
  produtoBrasilId: string;
}

export function HistoricoAtividades({ produtoBrasilId }: Props) {
  const { data: historico = [] } = useProdutoBrasilHistorico(produtoBrasilId);
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 cursor-pointer hover:bg-accent/50 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                Histórico de Atividades
                <Badge variant="secondary" className="text-[10px]">{historico.length}</Badge>
              </CardTitle>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {historico.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Nenhuma atividade registrada.</p>
            ) : (
              <div className="space-y-3">
                {historico.map((h) => (
                  <div key={h.id} className="flex items-start gap-3 border-l-2 border-border pl-3 py-1">
                    <span className="text-base shrink-0">{HISTORICO_ICONS[h.tipo] || "📋"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">{h.descricao}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {format(new Date(h.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
