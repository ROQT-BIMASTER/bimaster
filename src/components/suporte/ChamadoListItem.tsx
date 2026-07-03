import { Badge } from "@/components/ui/badge";
import { LifeBuoy, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  SUPORTE_PRIORIDADE_CLASS,
  SUPORTE_PRIORIDADE_LABEL,
  SUPORTE_STATUS_COLOR,
  SUPORTE_STATUS_LABEL,
  type SuporteChamado,
} from "@/hooks/suporte/types";

interface Props {
  chamado: SuporteChamado;
  selecionado?: boolean;
  onClick: () => void;
  /** Mostra o nome do solicitante (visão do agente). */
  mostrarSolicitante?: boolean;
}

/** Chip de SLA — só aparece quando a Fase 2 (motor de SLA) populou os campos. */
function SlaChip({ chamado }: { chamado: SuporteChamado }) {
  if (chamado.status === "resolvido") {
    if (chamado.sla_status === "cumprido")
      return <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-700 border-green-500/20">SLA cumprido</Badge>;
    if (chamado.sla_status === "violado")
      return <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-700 border-red-500/20">SLA violado</Badge>;
    return null;
  }
  if (chamado.sla_status === "violado")
    return <Badge className="text-[10px] bg-red-600 text-white gap-1"><Timer className="h-3 w-3" />SLA violado</Badge>;
  if (chamado.sla_status === "em_risco")
    return <Badge className="text-[10px] bg-orange-500 text-white gap-1"><Timer className="h-3 w-3" />SLA em risco</Badge>;
  if (chamado.sla_status === "pausado")
    return <Badge variant="outline" className="text-[10px] text-muted-foreground gap-1"><Timer className="h-3 w-3" />SLA pausado</Badge>;

  const prazo = chamado.primeira_resposta_em ? chamado.prazo_resolucao_em : chamado.prazo_primeira_resposta_em;
  if (!prazo) return null;
  return (
    <Badge variant="outline" className="text-[10px] text-muted-foreground gap-1">
      <Timer className="h-3 w-3" />
      {formatDistanceToNow(new Date(prazo), { addSuffix: true, locale: ptBR })}
    </Badge>
  );
}

export function ChamadoListItem({ chamado, selecionado, onClick, mostrarSolicitante }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-lg border p-3 transition-colors hover:bg-accent/50",
        selecionado && "border-primary bg-accent/60",
      )}
    >
      <div className="flex items-start gap-2">
        <LifeBuoy className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{chamado.titulo ?? "(sem título)"}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {chamado.fila && (
              <Badge variant="outline" className="text-[10px]">
                {chamado.fila.nome}
              </Badge>
            )}
            <Badge className={cn("text-white text-[10px]", SUPORTE_STATUS_COLOR[chamado.status])}>
              {SUPORTE_STATUS_LABEL[chamado.status]}
            </Badge>
            <Badge variant="outline" className={cn("text-[10px]", SUPORTE_PRIORIDADE_CLASS[chamado.prioridade])}>
              {SUPORTE_PRIORIDADE_LABEL[chamado.prioridade]}
            </Badge>
            <SlaChip chamado={chamado} />
          </div>
          <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
            {chamado.protocolo && <span className="font-mono">{chamado.protocolo}</span>}
            {mostrarSolicitante && chamado.requester?.nome && <span>• {chamado.requester.nome}</span>}
            <span>
              •{" "}
              {formatDistanceToNow(new Date(chamado.ultima_interacao_em ?? chamado.created_at), {
                addSuffix: true,
                locale: ptBR,
              })}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}
