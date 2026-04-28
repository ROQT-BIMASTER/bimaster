import { useNavigate } from "react-router-dom";
import { useMinhasTarefas, type MinaTarefa } from "@/hooks/useMinhasTarefas";
import { useMeusProjetosRecentes } from "@/hooks/useMeusProjetosRecentes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, FolderKanban, ArrowRight, Rocket, CalendarDays, CalendarOff } from "lucide-react";
import { format, isToday, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ProjetoHomeAtividades } from "@/components/projetos/home/ProjetoHomeAtividades";

const MAX_ITEMS = 8;

function TarefaRow({ tarefa, onToggle }: { tarefa: MinaTarefa; onToggle: (id: string, done: boolean) => void }) {
  const navigate = useNavigate();
  const isDone = tarefa.status === "concluida";
  const isOverdue = !isDone && tarefa.data_prazo && new Date(tarefa.data_prazo) < new Date();

  return (
    <div
      className="group flex items-center gap-3 p-3 rounded-lg border border-border/40 bg-card hover:shadow-sm transition-all cursor-pointer"
      onClick={() => navigate(`/dashboard/projetos/${tarefa.projeto_id}`)}
    >
      <Checkbox
        checked={isDone}
        onCheckedChange={(checked) => onToggle(tarefa.id, !!checked)}
        onClick={(e) => e.stopPropagation()}
        className="h-4 w-4 rounded-full"
      />
      <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: tarefa.projeto_cor }} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${isDone ? "line-through text-muted-foreground" : ""}`}>
          {tarefa.titulo}
        </p>
        <p className="text-[11px] text-muted-foreground truncate">{tarefa.projeto_nome}</p>
      </div>
      {tarefa.data_prazo ? (
        <span className={`text-[11px] font-medium shrink-0 ${isOverdue ? "text-destructive" : "text-muted-foreground"}`}>
          {isOverdue && <AlertTriangle className="h-3 w-3 inline mr-0.5 -mt-0.5" />}
          {format(new Date(tarefa.data_prazo), "d MMM", { locale: ptBR })}
        </span>
      ) : (
        !isDone && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className="shrink-0 gap-1 animate-pulse border-amber-500/60 text-amber-600 dark:text-amber-400 text-[10px] h-5 px-1.5"
              >
                <CalendarOff className="h-3 w-3" />
                Sem prazo
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="left">
              Defina datas de início e/ou prazo para priorizar esta tarefa
            </TooltipContent>
          </Tooltip>
        )
      )}
    </div>
  );
}

interface Props {
  onGoToTarefas: () => void;
}

export function HojeTab({ onGoToTarefas }: Props) {
  const { data: tarefas = [], isLoading: loadingTarefas } = useMinhasTarefas();
  const { data: projetos = [], isLoading: loadingProjetos } = useMeusProjetosRecentes();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const now = startOfDay(new Date());
  const pendentes = tarefas.filter(t => t.status !== "concluida");
  const atrasadas = pendentes.filter(t => t.data_prazo && isBefore(startOfDay(new Date(t.data_prazo)), now));
  const hoje = pendentes.filter(t => t.data_prazo && isToday(new Date(t.data_prazo)));

  const destaque = [...atrasadas, ...hoje].slice(0, MAX_ITEMS);

  const handleToggle = async (id: string, done: boolean) => {
    const update: any = { status: done ? "concluida" : "pendente" };
    update.data_conclusao = done ? new Date().toISOString() : null;
    const { error } = await supabase.from("projeto_tarefas").update(update).eq("id", id);
    if (error) {
      toast.error("Erro ao atualizar tarefa");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["minhas-tarefas"] });
    queryClient.invalidateQueries({ queryKey: ["meus-projetos-recentes"] });
    toast.success(done ? "Tarefa concluída!" : "Tarefa reaberta");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            Para focar agora
          </h2>
          <Button variant="ghost" size="sm" onClick={onGoToTarefas} className="gap-1 text-xs">
            Ver todas em Tarefas <ArrowRight className="h-3 w-3" />
          </Button>
        </div>

        {loadingTarefas ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
          </div>
        ) : destaque.length === 0 ? (
          <EmptyState
            icon={Rocket}
            title="Tudo em dia!"
            description="Nenhuma tarefa atrasada ou para hoje. Aproveite para planejar o que vem a seguir."
            actionLabel="Ver todas as tarefas"
            onAction={onGoToTarefas}
          />
        ) : (
          <>
            {atrasadas.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-destructive mb-2">
                  Atrasadas · {atrasadas.length}
                </p>
                <div className="space-y-2">
                  {atrasadas.slice(0, MAX_ITEMS).map(t => (
                    <TarefaRow key={t.id} tarefa={t} onToggle={handleToggle} />
                  ))}
                </div>
              </div>
            )}
            {hoje.length > 0 && atrasadas.length < MAX_ITEMS && (
              <div className={atrasadas.length > 0 ? "mt-4" : ""}>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-2">
                  Hoje · {hoje.length}
                </p>
                <div className="space-y-2">
                  {hoje.slice(0, MAX_ITEMS - atrasadas.length).map(t => (
                    <TarefaRow key={t.id} tarefa={t} onToggle={handleToggle} />
                  ))}
                </div>
              </div>
            )}
            {(atrasadas.length + hoje.length) > MAX_ITEMS && (
              <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={onGoToTarefas}>
                Ver mais {(atrasadas.length + hoje.length) - MAX_ITEMS} tarefas
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </>
        )}
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-primary" />
              Meus Projetos
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loadingProjetos ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : projetos.length === 0 ? (
              <div className="py-6 text-center text-muted-foreground text-sm">Nenhum projeto ativo</div>
            ) : (
              <div className="divide-y divide-border/30">
                {projetos.map(p => {
                  const progress = p.total_tarefas > 0 ? Math.round((p.concluidas / p.total_tarefas) * 100) : 0;
                  return (
                    <button
                      key={p.id}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                      onClick={() => navigate(`/dashboard/projetos/${p.id}`)}
                    >
                      <div
                        className="h-8 w-8 rounded-md flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ backgroundColor: p.cor }}
                      >
                        {p.nome.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.nome}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Progress value={progress} className="h-1.5 flex-1" />
                          <span className="text-[10px] text-muted-foreground shrink-0">{progress}%</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {p.atrasadas > 0 && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
                            {p.atrasadas}
                          </Badge>
                        )}
                        {p.minhas_pendentes > 0 && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                            {p.minhas_pendentes}
                          </Badge>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <ProjetoHomeAtividades />
      </div>
    </div>
  );
}
