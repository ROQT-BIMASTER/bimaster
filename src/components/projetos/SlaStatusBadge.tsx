import { AlertOctagon, ShieldAlert, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type SlaMarkStatus = "em_risco" | "violado" | "cumprido" | "no_prazo";

interface SlaStatusBadgeProps {
  status: SlaMarkStatus;
  compact?: boolean;
  className?: string;
  /** Descrição do "tipo de atividade" (estágio/status) para o tooltip. */
  contexto?: string;
}

const CONFIG: Record<
  SlaMarkStatus,
  { label: string; className: string; Icon: typeof AlertOctagon; tooltip: string }
> = {
  violado: {
    label: "SLA Violado",
    className:
      "bg-destructive/15 text-destructive border-destructive/60 font-semibold animate-pulse",
    Icon: AlertOctagon,
    tooltip:
      "O prazo da atividade foi ultrapassado. Um chamado foi (ou será) aberto na Central de Suporte.",
  },
  em_risco: {
    label: "SLA em Risco",
    className: "bg-warning/15 text-warning border-warning/50 font-semibold",
    Icon: ShieldAlert,
    tooltip:
      "O prazo desta atividade está próximo do vencimento. Priorize a execução para evitar escalonamento.",
  },
  cumprido: {
    label: "SLA Cumprido",
    className: "bg-emerald-500/15 text-emerald-500 border-emerald-500/40",
    Icon: ShieldCheck,
    tooltip: "Atividade concluída dentro do prazo.",
  },
  no_prazo: {
    label: "No Prazo",
    className: "bg-muted text-muted-foreground border-border",
    Icon: ShieldCheck,
    tooltip: "Atividade dentro do prazo previsto.",
  },
};

/**
 * Selo de status de SLA para o card do Kanban. Apenas os estados
 * "em_risco" e "violado" são exibidos por padrão — os demais só
 * aparecem quando explicitamente requisitados.
 */
export function SlaStatusBadge({
  status,
  compact = true,
  className,
  contexto,
}: SlaStatusBadgeProps) {
  const cfg = CONFIG[status];

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded border whitespace-nowrap uppercase tracking-wide",
              compact ? "text-[9px] h-4 px-1.5" : "text-[10px] h-5 px-2",
              cfg.className,
              className,
            )}
            aria-label={cfg.label}
          >
            <cfg.Icon className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
            {cfg.label}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          <div className="font-semibold">{cfg.label}</div>
          <div className="text-muted-foreground">{cfg.tooltip}</div>
          {contexto && (
            <div className="text-muted-foreground mt-1">Atividade: {contexto}</div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Deriva o status de SLA de uma tarefa validando o tipo de atividade:
 * - Ignora tarefas concluídas, canceladas ou arquivadas (não escalam).
 * - Prefere o `sla_status` persistido (calculado pelo backend).
 * - Fallback: deriva de `data_prazo` com janela de risco de 15%.
 */
export function derivarSlaStatus(tarefa: {
  status?: string | null;
  data_prazo?: string | null;
  data_conclusao?: string | null;
  created_at?: string | null;
  sla_status?: string | null;
  sla_limite?: string | null;
}): SlaMarkStatus | null {
  const status = (tarefa.status ?? "").toLowerCase();
  if (["cancelada", "arquivada"].includes(status)) return null;

  if (status === "concluida" || tarefa.data_conclusao) {
    if (tarefa.sla_status === "violado") return "violado";
    if (tarefa.sla_status === "cumprido") return "cumprido";
    return null;
  }

  // Confia no valor persistido quando existir
  if (tarefa.sla_status === "violado") return "violado";
  if (tarefa.sla_status === "em_risco") return "em_risco";

  const prazoIso = tarefa.sla_limite ?? tarefa.data_prazo;
  if (!prazoIso) return null;

  const prazo = new Date(prazoIso).getTime();
  const now = Date.now();
  if (isNaN(prazo)) return null;

  if (now > prazo) return "violado";

  const inicioIso = tarefa.created_at;
  if (inicioIso) {
    const inicio = new Date(inicioIso).getTime();
    if (!isNaN(inicio) && prazo > inicio) {
      const consumido = (now - inicio) / (prazo - inicio);
      if (consumido >= 0.85) return "em_risco";
    }
  } else {
    // Sem created_at, cai numa janela absoluta de 15 minutos antes do prazo
    if (prazo - now <= 15 * 60_000) return "em_risco";
  }

  return null;
}
