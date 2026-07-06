import { AlertTriangle, CheckCircle2, Database, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { MinaTarefa } from "@/hooks/useMinhasTarefas";
import { useMinhasTarefasStats } from "@/hooks/useMinhasTarefasStats";

interface Props {
  tarefas: MinaTarefa[];
  /** Quantas tarefas concluídas estão realmente sendo exibidas na coluna "Concluídas". */
  concluidasExibidas: number;
}

/**
 * Barra de diagnóstico exibida no topo do quadro "Minhas Tarefas".
 *
 * Mostra, lado a lado:
 *  - Banco: contagens autoritativas do usuário direto do banco.
 *  - Exibidas: quantas foram carregadas no cache (payload do RPC) e quantas
 *    aparecem em cada coluna após slice/ordenação.
 *
 * Serve como sinal precoce quando o payload é truncado (>= 1000 linhas do
 * limite PostgREST) ou quando alguma tarefa "some" da coluna Concluídas.
 */
export function MinhasTarefasCountersBar({ tarefas, concluidasExibidas }: Props) {
  const { data: stats } = useMinhasTarefasStats();

  const ativasCache = tarefas.filter((t) => t.status !== "concluida").length;
  const concluidasCache = tarefas.filter((t) => t.status === "concluida").length;
  const totalCache = tarefas.length;

  const bancoAtivas = stats?.ativas ?? null;
  const bancoConcluidas = stats?.concluidas ?? null;
  const bancoTotal = stats?.total ?? null;

  const divergenciaAtivas = bancoAtivas !== null ? bancoAtivas - ativasCache : 0;
  const divergenciaConcluidas =
    bancoConcluidas !== null ? bancoConcluidas - concluidasCache : 0;
  const totalOculto = bancoTotal !== null ? bancoTotal - totalCache : 0;

  const temCorte = totalOculto > 0 || totalCache >= 1000;

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-2 mb-3 rounded-md bg-muted/30 border border-border/40 text-[11px] text-muted-foreground"
        data-testid="minhas-tarefas-counters"
      >
        <div className="flex items-center gap-1.5">
          <Database className="h-3.5 w-3.5 text-primary" />
          <span className="font-medium uppercase tracking-wider text-[10px]">
            Banco
          </span>
          <span>
            {bancoTotal ?? "…"} total ·{" "}
            <span className="text-foreground font-medium">
              {bancoAtivas ?? "…"}
            </span>{" "}
            ativas ·{" "}
            <span className="text-foreground font-medium">
              {bancoConcluidas ?? "…"}
            </span>{" "}
            concluídas
          </span>
          {stats && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="secondary"
                  className="h-4 px-1.5 text-[9px] cursor-help"
                >
                  detalhes
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                <div className="space-y-0.5">
                  <div>Concluídas hoje: {stats.concluidas_hoje}</div>
                  <div>Concluídas nos últimos 30d: {stats.concluidas_30d}</div>
                  <div className="text-muted-foreground pt-1">
                    Dados autoritativos direto do banco.
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <Eye className="h-3.5 w-3.5 text-success" />
          <span className="font-medium uppercase tracking-wider text-[10px]">
            Exibidas
          </span>
          <span>
            {totalCache} carregadas ·{" "}
            <span className="text-foreground font-medium">{ativasCache}</span>{" "}
            ativas ·{" "}
            <span className="text-foreground font-medium">
              {concluidasCache}
            </span>{" "}
            concluídas
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
          <span className="font-medium uppercase tracking-wider text-[10px]">
            Coluna concluídas
          </span>
          <span>
            <span className="text-foreground font-medium">
              {concluidasExibidas}
            </span>{" "}
            de {concluidasCache}
          </span>
        </div>

        {temCorte && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 ml-auto px-2 py-0.5 rounded-md bg-warning/10 border border-warning/30 text-warning cursor-help">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">
                  {totalOculto > 0
                    ? `${totalOculto} escondidas`
                    : "Payload no limite"}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs max-w-[320px]">
              <div className="space-y-1">
                {divergenciaAtivas > 0 && (
                  <div>
                    <strong>{divergenciaAtivas}</strong> tarefa(s) ativa(s) no
                    banco não estão no payload atual.
                  </div>
                )}
                {divergenciaConcluidas > 0 && (
                  <div>
                    <strong>{divergenciaConcluidas}</strong> concluída(s) no
                    banco fora do payload atual.
                  </div>
                )}
                <div className="text-muted-foreground pt-1">
                  O backend limita a resposta em 1000 linhas por requisição.
                  Usuários com histórico grande podem ter tarefas antigas
                  cortadas — as recentes continuam visíveis.
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
