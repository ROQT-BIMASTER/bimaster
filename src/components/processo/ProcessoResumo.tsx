import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, Scale, Clock, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProductProcess } from "@/hooks/useProductProcess";
import { useEtapasConfig } from "@/hooks/useEtapasConfig";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  produtoTipo: "china" | "brasil" | "fabrica";
  produtoRefId: string;
}

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  em_andamento: { bg: "bg-blue-500/10", text: "text-blue-600", label: "Em Andamento" },
  aprovado: { bg: "bg-emerald-500/10", text: "text-emerald-600", label: "Aprovado" },
  reprovado: { bg: "bg-destructive/10", text: "text-destructive", label: "Reprovado" },
  cancelado: { bg: "bg-muted", text: "text-muted-foreground", label: "Cancelado" },
};

export function ProcessoResumo({ produtoTipo, produtoRefId }: Props) {
  const { process, processLoading, events } = useProductProcess(produtoTipo, produtoRefId);
  const { etapas } = useEtapasConfig(produtoTipo);

  if (processLoading) {
    return (
      <Card className="p-4 flex items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  if (!process) return null;

  const etapaAtualIndex = etapas.findIndex(e => e.etapa_key === process.etapa_atual);
  const progressPercent = etapaAtualIndex >= 0
    ? Math.round(((etapaAtualIndex + 1) / etapas.length) * 100)
    : 0;

  const statusStyle = STATUS_STYLE[process.status] || STATUS_STYLE.em_andamento;
  const totalEvents = events.length;

  return (
    <Card className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">
            Processo {process.numero_processo}
          </span>
        </div>
        <Badge className={cn("text-[10px]", statusStyle.bg, statusStyle.text)}>
          {statusStyle.label}
        </Badge>
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground">Progresso</span>
          <span className="font-medium">{progressPercent}%</span>
        </div>
        <Progress value={progressPercent} className="h-2" />
      </div>

      {/* Step pills */}
      <div className="flex flex-wrap gap-1">
        {etapas.map((etapa, i) => {
          const isCurrent = etapa.etapa_key === process.etapa_atual;
          const isPast = i < etapaAtualIndex;
          return (
            <Badge
              key={etapa.etapa_key}
              variant="outline"
              className={cn(
                "text-[9px] px-1.5 py-0 h-5 transition-all",
                isCurrent && "bg-primary text-primary-foreground border-primary font-bold",
                isPast && "bg-emerald-500/10 text-emerald-600 border-emerald-200",
                !isCurrent && !isPast && "text-muted-foreground border-border/50"
              )}
            >
              {isPast && <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />}
              {etapa.etapa_label}
            </Badge>
          );
        })}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-muted/50 rounded-md p-2">
          <div className="text-lg font-bold text-foreground">{totalEvents}</div>
          <div className="text-[10px] text-muted-foreground">Eventos</div>
        </div>
        <div className="bg-muted/50 rounded-md p-2">
          <div className="text-lg font-bold text-foreground">{etapaAtualIndex + 1}/{etapas.length}</div>
          <div className="text-[10px] text-muted-foreground">Etapa</div>
        </div>
        <div className="bg-muted/50 rounded-md p-2">
          <div className="text-[11px] font-medium text-foreground">
            {format(new Date(process.created_at), "dd/MM/yy", { locale: ptBR })}
          </div>
          <div className="text-[10px] text-muted-foreground flex items-center justify-center gap-0.5">
            <Clock className="h-2.5 w-2.5" /> Início
          </div>
        </div>
      </div>
    </Card>
  );
}
