import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import {
  FileText,
  ChevronRight,
  AlertTriangle,
  Clock,
  GitBranch,
  Workflow,
  Check,
  X,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDraggable } from "@dnd-kit/core";
import type { KanbanItem, KanbanPipeline } from "@/hooks/useKanbanAprovacoes";
import { MiniTrilha } from "./MiniTrilha";

const PIPELINE_COLORS = [
  "border-l-primary",
  "border-l-emerald-500",
  "border-l-amber-500",
  "border-l-sky-500",
  "border-l-fuchsia-500",
  "border-l-rose-500",
  "border-l-violet-500",
  "border-l-orange-500",
];

function pipelineColor(pipelineId: string | null) {
  if (!pipelineId) return "border-l-muted-foreground/40";
  let h = 0;
  for (let i = 0; i < pipelineId.length; i++) h = (h * 31 + pipelineId.charCodeAt(i)) >>> 0;
  return PIPELINE_COLORS[h % PIPELINE_COLORS.length];
}

interface Props {
  item: KanbanItem;
  pipeline?: KanbanPipeline;
  onOpen: (item: KanbanItem) => void;
  currentUserId?: string;
  onQuickAction?: (item: KanbanItem, destino: "aprovado" | "rejeitado" | "em_revisao") => void;
}

export function CardAprovacao({ item, pipeline, onOpen, currentUserId, onQuickAction }: Props) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    data: { item },
  });

  const atrasado =
    item.prazo_em &&
    new Date(item.prazo_em) < new Date() &&
    item.status === "em_andamento";

  const total = pipeline?.etapas.length ?? 0;
  const idx = pipeline?.etapas.findIndex((e) => e.id === item.etapa_atual_id) ?? -1;
  const atual = idx >= 0 ? idx + 1 : 0;
  const isEncaminhamento = item.etapa_tipo === "encaminhamento";

  const podeAgirRapido =
    !!onQuickAction &&
    !!currentUserId &&
    item.status === "em_andamento" &&
    item.responsavel_atual_id === currentUserId;
  const podeDevolver = podeAgirRapido && (item.etapa_ordem ?? 1) > 1;

  function quick(e: React.MouseEvent, destino: "aprovado" | "rejeitado" | "em_revisao") {
    e.stopPropagation();
    e.preventDefault();
    onQuickAction?.(item, destino);
  }

  return (
    <Card
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(item)}
      className={cn(
        "group relative p-2.5 cursor-pointer hover:border-primary/40 transition border-l-[3px] bg-card/80 backdrop-blur-sm",
        pipelineColor(item.pipeline_id),
        isDragging && "opacity-50",
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-xs font-semibold leading-tight line-clamp-2 flex-1 flex items-center gap-1.5">
          <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
          {item.documento_nome || item.documento_tipo || "Documento"}
        </p>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      </div>

      {(item.projeto_nome || item.tarefa_titulo) && (
        <p className="text-[10px] text-muted-foreground truncate mb-1.5">
          {[item.projeto_nome, item.tarefa_titulo].filter(Boolean).join(" › ")}
        </p>
      )}

      {item.pipeline_nome && (
        <div className="flex items-center gap-1 mb-1.5">
          <Badge variant="secondary" className="text-[10px] h-4 px-1.5 gap-0.5 font-medium">
            <Workflow className="h-2.5 w-2.5" />
            {item.pipeline_nome}
          </Badge>
          {isEncaminhamento && (
            <Badge variant="outline" className="text-[10px] h-4 px-1.5 gap-0.5">
              <GitBranch className="h-2.5 w-2.5" /> encaminha
            </Badge>
          )}
        </div>
      )}

      {total > 0 && atual > 0 && item.status === "em_andamento" && (
        <div className="flex items-center gap-1.5 mb-1.5">
          <MiniTrilha total={total} atual={atual} isEncaminhamento={isEncaminhamento} />
          <span className="text-[9px] text-muted-foreground">
            {item.etapa_nome ? `${item.etapa_nome} · ` : ""}Etapa {atual} de {total}
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-1">
        {item.responsavel_nome && (
          <span className="text-[10px] text-muted-foreground truncate">
            → {item.responsavel_nome}
          </span>
        )}
        {item.status === "em_andamento" && item.prazo_em && (
          atrasado ? (
            <Badge variant="destructive" className="text-[10px] h-4 gap-0.5 px-1.5">
              <AlertTriangle className="h-2.5 w-2.5" /> Vencido
            </Badge>
          ) : (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Clock className="h-2.5 w-2.5" />
              {new Date(item.prazo_em).toLocaleDateString("pt-BR")}
            </span>
          )
        )}
      </div>

      {/* Quick actions — visíveis no hover, apenas para o responsável atual */}
      {podeAgirRapido && !isEncaminhamento && (
        <TooltipProvider delayDuration={150}>
          <div
            className="absolute top-1.5 right-1.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition bg-card/95 backdrop-blur-sm rounded-md border shadow-sm p-0.5"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                  onClick={(e) => quick(e, "aprovado")}
                  aria-label="Aprovar"
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[10px]">Aprovar</TooltipContent>
            </Tooltip>
            {podeDevolver && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-amber-600 hover:text-amber-700 hover:bg-amber-500/10"
                    onClick={(e) => quick(e, "em_revisao")}
                    aria-label="Devolver para revisão"
                  >
                    <Undo2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-[10px]">Devolver</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-destructive hover:bg-destructive/10"
                  onClick={(e) => quick(e, "rejeitado")}
                  aria-label="Rejeitar"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[10px]">Rejeitar</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      )}
    </Card>
  );
}
