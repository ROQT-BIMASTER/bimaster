import { CheckCircle2, Circle, Workflow, ArrowRight, GitBranch, AlertTriangle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { KanbanPipeline, KanbanItem } from "@/hooks/useKanbanAprovacoes";

interface Props {
  pipeline: KanbanPipeline;
  itens: KanbanItem[];
}

/**
 * Stepper horizontal mostrando todas as etapas do pipeline em ordem,
 * com contadores de itens ativos e indicação visual de etapa com atrasados.
 */
export function PipelineStepper({ pipeline, itens }: Props) {
  const agora = new Date();
  const ativos = itens.filter((i) => i.status === "em_andamento");
  const aprovados = itens.filter((i) => i.status === "aprovado").length;
  const rejeitados = itens.filter((i) => i.status === "rejeitado").length;
  const atrasadosTotal = ativos.filter((i) => i.prazo_em && new Date(i.prazo_em) < agora).length;

  return (
    <div className="rounded-lg border border-border bg-card/60 backdrop-blur-sm p-3">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <Workflow className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">{pipeline.nome}</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant="secondary" className="text-[10px] h-5">
            {ativos.length} ativo{ativos.length === 1 ? "" : "s"}
          </Badge>
          {atrasadosTotal > 0 && (
            <Badge variant="destructive" className="text-[10px] h-5 gap-0.5">
              <AlertTriangle className="h-2.5 w-2.5" /> {atrasadosTotal} atrasado{atrasadosTotal === 1 ? "" : "s"}
            </Badge>
          )}
          {aprovados > 0 && (
            <Badge variant="outline" className="text-[10px] h-5 gap-0.5 border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-2.5 w-2.5" /> {aprovados}
            </Badge>
          )}
          {rejeitados > 0 && (
            <Badge variant="outline" className="text-[10px] h-5 gap-0.5 border-destructive/40 text-destructive">
              <XCircle className="h-2.5 w-2.5" /> {rejeitados}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {pipeline.etapas.map((et, idx) => {
          const itensEt = ativos.filter((i) => i.etapa_atual_id === et.id);
          const temAtrasado = itensEt.some((i) => i.prazo_em && new Date(i.prazo_em) < agora);
          const ativa = itensEt.length > 0;
          const isEncaminhamento = et.tipo === "encaminhamento" || !!et.pipeline_destino_id;

          return (
            <div key={et.id} className="flex items-center gap-1 shrink-0">
              <div className="flex items-center gap-1.5">
                <div
                  className={cn(
                    "flex items-center justify-center rounded-full h-6 w-6 text-[10px] font-semibold border-2 transition",
                    ativa && !temAtrasado && "bg-primary text-primary-foreground border-primary",
                    ativa && temAtrasado && "bg-destructive text-destructive-foreground border-destructive",
                    !ativa && "bg-background text-muted-foreground border-muted-foreground/30",
                  )}
                  title={`${et.nome} — ${itensEt.length} item(ns)`}
                >
                  {idx + 1}
                </div>
                <div className="flex flex-col leading-tight">
                  <span className={cn("text-[11px] font-medium flex items-center gap-1", !ativa && "text-muted-foreground")}>
                    {isEncaminhamento && <GitBranch className="h-2.5 w-2.5" />}
                    {et.nome}
                  </span>
                  <span className="text-[9px] text-muted-foreground">
                    {itensEt.length === 0 ? "—" : `${itensEt.length} aqui`}
                  </span>
                </div>
              </div>
              {idx < pipeline.etapas.length - 1 && (
                <ArrowRight className="h-3 w-3 text-muted-foreground/50 mx-1" />
              )}
            </div>
          );
        })}

        {/* Terminais */}
        <ArrowRight className="h-3 w-3 text-muted-foreground/30 mx-1 shrink-0" />
        <div className="flex items-center gap-1 shrink-0">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <span className="text-[10px] text-muted-foreground">Aprovado</span>
        </div>
        <span className="text-[10px] text-muted-foreground/40 mx-1">/</span>
        <div className="flex items-center gap-1 shrink-0">
          <XCircle className="h-4 w-4 text-destructive/70" />
          <span className="text-[10px] text-muted-foreground">Rejeitado</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Mini-trilha de bolinhas para mostrar progresso dentro de um card.
 */
export function MiniTrilha({
  total,
  atual,
  isEncaminhamento,
}: {
  total: number;
  atual: number; // 1-based index of current step
  isEncaminhamento?: boolean;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: total }).map((_, i) => {
        const passou = i + 1 < atual;
        const aqui = i + 1 === atual;
        return (
          <div key={i} className="flex items-center">
            {passou ? (
              <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" />
            ) : aqui ? (
              <div className={cn(
                "h-2.5 w-2.5 rounded-full border-2 border-primary",
                isEncaminhamento ? "bg-primary/30" : "bg-primary",
              )} />
            ) : (
              <Circle className="h-2.5 w-2.5 text-muted-foreground/40" />
            )}
            {i < total - 1 && <div className="h-px w-1.5 bg-muted-foreground/30" />}
          </div>
        );
      })}
    </div>
  );
}
