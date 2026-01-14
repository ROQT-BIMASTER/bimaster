import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  GitBranch, Clock, CheckCircle, AlertTriangle,
  ArrowRight, User
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface WorkflowStage {
  id: string;
  nome: string;
  descricao: string | null;
  ordem: number;
  cor: string;
  icone: string | null;
  tipo: string;
  requer_aprovacao: boolean;
  aprovador_papel: string | null;
  sla_horas: number | null;
}

interface Task {
  id: string;
  titulo: string;
  tipo: string;
  status: string;
  data_prazo: string;
  etapa_atual_id: string | null;
  workflow_status: string | null;
  sla_deadline: string | null;
  sla_status: string | null;
  responsavel: { nome: string } | null;
}

export function WorkflowBoard() {
  const { data: stages, isLoading: stagesLoading } = useQuery({
    queryKey: ['workflow-stages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketing_workflow_etapas')
        .select('*')
        .order('ordem');

      if (error) throw error;
      return data as WorkflowStage[];
    }
  });

  const { data: tasks } = useQuery({
    queryKey: ['workflow-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lancamentos_tarefas_marketing')
        .select(`
          id,
          titulo,
          tipo,
          status,
          data_prazo,
          etapa_atual_id,
          workflow_status,
          sla_deadline,
          sla_status,
          responsavel:profiles!lancamentos_tarefas_marketing_responsavel_id_fkey(nome)
        `)
        .not('etapa_atual_id', 'is', null)
        .order('data_prazo');

      if (error) throw error;
      return data as unknown as Task[];
    }
  });

  const tasksByStage = stages?.reduce((acc, stage) => {
    acc[stage.id] = tasks?.filter(t => t.etapa_atual_id === stage.id) || [];
    return acc;
  }, {} as Record<string, Task[]>) || {};

  if (stagesLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Workflow de Produção
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="w-64 h-96 bg-muted/50 rounded-lg animate-pulse flex-shrink-0" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitBranch className="h-5 w-5" />
          Workflow de Produção
          <Badge variant="secondary" className="ml-2">
            {stages?.length || 0} etapas
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="w-full">
          <div className="flex gap-4 pb-4">
            {stages?.map((stage, index) => (
              <div key={stage.id} className="flex items-start gap-2">
                <div 
                  className="w-64 flex-shrink-0 rounded-xl p-3"
                  style={{ backgroundColor: `${stage.cor}15` }}
                >
                  {/* Stage Header */}
                  <div className="flex items-center gap-2 mb-3">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: stage.cor }}
                    />
                    <span className="font-medium text-sm">{stage.nome}</span>
                    <Badge variant="secondary" className="ml-auto text-[10px]">
                      {tasksByStage[stage.id]?.length || 0}
                    </Badge>
                  </div>

                  {/* Stage Info */}
                  <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
                    {stage.sla_horas && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {stage.sla_horas}h
                      </div>
                    )}
                    {stage.requer_aprovacao && (
                      <Badge variant="outline" className="text-[10px]">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Aprovação
                      </Badge>
                    )}
                  </div>

                  {/* Tasks */}
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2 pr-2">
                      {tasksByStage[stage.id]?.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-xs">
                          Nenhuma tarefa
                        </div>
                      ) : (
                        tasksByStage[stage.id]?.map(task => (
                          <div 
                            key={task.id}
                            className={cn(
                              "p-2 rounded-lg bg-card border",
                              task.sla_status === 'atrasado' && "border-red-500/50",
                              task.sla_status === 'alerta' && "border-amber-500/50"
                            )}
                          >
                            <p className="text-sm font-medium line-clamp-2">{task.titulo}</p>
                            
                            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                              {task.responsavel && (
                                <div className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {task.responsavel.nome?.split(' ')[0]}
                                </div>
                              )}
                              
                              {task.sla_deadline && (
                                <div className={cn(
                                  "flex items-center gap-1",
                                  task.sla_status === 'atrasado' && "text-red-500",
                                  task.sla_status === 'alerta' && "text-amber-500"
                                )}>
                                  {task.sla_status === 'atrasado' && <AlertTriangle className="h-3 w-3" />}
                                  <Clock className="h-3 w-3" />
                                  {format(new Date(task.sla_deadline), "dd/MM HH:mm", { locale: ptBR })}
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </div>

                {/* Arrow between stages */}
                {index < (stages?.length || 0) - 1 && (
                  <div className="flex items-center pt-10">
                    <ArrowRight className="h-5 w-5 text-muted-foreground/50" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
