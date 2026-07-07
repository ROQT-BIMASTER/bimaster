import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Workflow, AlarmClock } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { ProcessoOperacionalTag } from "@/hooks/suporte/useProcessoOperacionalMap";

interface Props {
  tag: ProcessoOperacionalTag;
  compact?: boolean;
}

/**
 * Etiqueta dupla exibida em cards de "Minhas Tarefas" / Central de Trabalho
 * para tarefas geradas por processos operacionais:
 *  - Badge com o nome do processo e "Etapa X/Y".
 *  - Selo de SLA colorido (verde >2h · amarelo <2h · vermelho vencido).
 */
export function ProcessoOperacionalBadge({ tag, compact }: Props) {
  const now = Date.now();
  const sla = tag.sla_limite ? new Date(tag.sla_limite).getTime() : null;
  const diffMs = sla ? sla - now : null;

  let slaColor = "border-success/50 bg-success/10 text-success";
  let slaLabel = "SLA ok";
  if (diffMs !== null) {
    if (diffMs < 0) {
      slaColor = "border-destructive/60 bg-destructive/10 text-destructive";
      slaLabel = `SLA vencido há ${formatDistanceToNowStrict(new Date(sla!), { locale: ptBR })}`;
    } else if (diffMs < 2 * 60 * 60 * 1000) {
      slaColor = "border-warning/60 bg-warning/10 text-warning";
      slaLabel = `SLA em ${formatDistanceToNowStrict(new Date(sla!), { locale: ptBR })}`;
    } else {
      slaLabel = `SLA em ${formatDistanceToNowStrict(new Date(sla!), { locale: ptBR })}`;
    }
  }

  const nome = tag.total_etapas
    ? `${tag.processo_nome} — Etapa ${tag.etapa_ordem}/${tag.total_etapas}`
    : tag.processo_nome;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className={`shrink-0 gap-1 border-primary/40 bg-primary/5 text-primary text-[10px] h-5 px-1.5 ${compact ? "max-w-[160px]" : ""}`}
            >
              <Workflow className="h-3 w-3" />
              <span className="truncate">{compact ? "Processo" : nome}</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top">
            Tarefa gerada pelo processo: <b>{nome}</b>
          </TooltipContent>
        </Tooltip>
        {tag.sla_limite && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className={`shrink-0 gap-1 text-[10px] h-5 px-1.5 ${slaColor}`}>
                <AlarmClock className="h-3 w-3" />
                {slaLabel.split(" ").slice(0, 3).join(" ")}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top">{slaLabel}</TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
