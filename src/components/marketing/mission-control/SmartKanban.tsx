import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Clock, AlertTriangle, CheckCircle, Play, Pause,
  ArrowRight, Sparkles, User, Calendar, Zap, Link2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface Task {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  status: string;
  data_prazo: string;
  responsavel_id: string | null;
  pontos_base: number;
  prioridade_ai: number;
  alerta_gargalo: boolean;
  dependencia_tarefa_id: string | null;
  lancamento: {
    nome_lancamento: string;
    produto: { nome: string } | null;
  } | null;
  responsavel: { nome: string } | null;
}

const columns = [
  { id: 'pendente', label: 'Pendente', icon: Clock, color: 'text-gray-500' },
  { id: 'em_andamento', label: 'Em Andamento', icon: Play, color: 'text-blue-500' },
  { id: 'em_revisao', label: 'Em Revisão', icon: Pause, color: 'text-amber-500' },
  { id: 'concluida', label: 'Concluída', icon: CheckCircle, color: 'text-green-500' }
];

const taskTypeLabels: Record<string, string> = {
  post_instagram: 'Post Instagram',
  post_tiktok: 'Post TikTok',
  catalogo: 'Catálogo',
  video: 'Vídeo',
  email: 'Email Marketing',
  banner: 'Banner',
  arte: 'Arte Gráfica'
};

function TaskCard({ task, onStatusChange }: { task: Task; onStatusChange: (id: string, status: string) => void }) {
  const daysUntil = Math.ceil((new Date(task.data_prazo).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const isOverdue = daysUntil < 0;
  const isUrgent = daysUntil <= 2 && daysUntil >= 0;
  const currentColumnIndex = columns.findIndex(c => c.id === task.status);
  const nextColumn = columns[currentColumnIndex + 1];

  return (
    <div className={cn(
      "p-3 rounded-lg border bg-card transition-all duration-200",
      "hover:shadow-md cursor-grab active:cursor-grabbing",
      task.alerta_gargalo && "border-red-500/50 bg-red-500/5",
      isOverdue && !task.alerta_gargalo && "border-amber-500/50"
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <Badge variant="outline" className="text-[10px]">
          {taskTypeLabels[task.tipo] || task.tipo}
        </Badge>
        <div className="flex items-center gap-1">
          {task.alerta_gargalo && (
            <span className="animate-pulse">
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </span>
          )}
          {task.dependencia_tarefa_id && (
            <Link2 className="h-3 w-3 text-muted-foreground" />
          )}
          <Badge variant="secondary" className="text-[10px] px-1.5">
            <Zap className="h-2.5 w-2.5 mr-0.5" />
            {task.pontos_base}pts
          </Badge>
        </div>
      </div>

      {/* Title and Description */}
      <p className="text-sm font-medium line-clamp-2 mb-1">{task.titulo}</p>
      {task.descricao && (
        <p className="text-xs text-muted-foreground line-clamp-1 mb-2">{task.descricao}</p>
      )}

      {/* Launch info */}
      {task.lancamento && (
        <p className="text-[10px] text-muted-foreground mb-2 truncate">
          🚀 {task.lancamento.nome_lancamento}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
        <div className="flex items-center gap-2">
          {task.responsavel ? (
            <Avatar className="h-5 w-5">
              <AvatarFallback className="text-[8px] bg-primary/10">
                {task.responsavel.nome?.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ) : (
            <User className="h-4 w-4 text-muted-foreground" />
          )}
          <span className={cn(
            "text-[10px] flex items-center gap-1",
            isOverdue && "text-red-500 font-medium",
            isUrgent && "text-amber-500 font-medium"
          )}>
            <Calendar className="h-3 w-3" />
            {isOverdue ? `${Math.abs(daysUntil)}d atrasado` : 
             isUrgent ? `${daysUntil}d restantes` :
             format(new Date(task.data_prazo), "dd/MM", { locale: ptBR })}
          </span>
        </div>

        {nextColumn && task.status !== 'concluida' && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[10px]"
            onClick={() => onStatusChange(task.id, nextColumn.id)}
          >
            <ArrowRight className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

function KanbanColumn({ 
  column, 
  tasks, 
  onStatusChange 
}: { 
  column: typeof columns[0]; 
  tasks: Task[];
  onStatusChange: (id: string, status: string) => void;
}) {
  const Icon = column.icon;
  
  return (
    <div className="flex-1 min-w-[280px] bg-muted/30 rounded-xl p-3">
      <div className="flex items-center gap-2 mb-3 px-1">
        <Icon className={cn("h-4 w-4", column.color)} />
        <span className="font-medium text-sm">{column.label}</span>
        <Badge variant="secondary" className="ml-auto text-[10px]">
          {tasks.length}
        </Badge>
      </div>
      <ScrollArea className="h-[500px]">
        <div className="space-y-2 pr-2">
          {tasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Nenhuma tarefa
            </div>
          ) : (
            tasks.map(task => (
              <TaskCard 
                key={task.id} 
                task={task} 
                onStatusChange={onStatusChange}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export function SmartKanban() {
  const queryClient = useQueryClient();

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['kanban-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lancamentos_tarefas_marketing')
        .select(`
          id,
          tipo,
          titulo,
          descricao,
          status,
          data_prazo,
          responsavel_id,
          pontos_base,
          prioridade_ai,
          alerta_gargalo,
          dependencia_tarefa_id,
          lancamento:lancamentos_produtos(
            nome_lancamento,
            produto:fabrica_produtos(nome)
          ),
          responsavel:profiles!lancamentos_tarefas_marketing_responsavel_id_fkey(nome)
        `)
        .order('prioridade_ai', { ascending: false })
        .order('data_prazo', { ascending: true });

      if (error) throw error;
      return data as unknown as Task[];
    }
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('lancamentos_tarefas_marketing')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['mission-control-kpis'] });
      toast.success('Status atualizado!');
    },
    onError: () => {
      toast.error('Erro ao atualizar status');
    }
  });

  const handleStatusChange = (id: string, status: string) => {
    updateStatus.mutate({ id, status });
  };

  const tasksByColumn = columns.reduce((acc, col) => {
    acc[col.id] = tasks?.filter(t => t.status === col.id) || [];
    return acc;
  }, {} as Record<string, Task[]>);

  // AI Insights
  const bottleneckCount = tasks?.filter(t => t.alerta_gargalo).length || 0;
  const overdueCount = tasks?.filter(t => new Date(t.data_prazo) < new Date() && t.status !== 'concluida').length || 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Kanban Inteligente
          </CardTitle>
          {(bottleneckCount > 0 || overdueCount > 0) && (
            <div className="flex items-center gap-2">
              {bottleneckCount > 0 && (
                <Badge variant="destructive" className="text-[10px]">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {bottleneckCount} gargalos
                </Badge>
              )}
              {overdueCount > 0 && (
                <Badge className="text-[10px] bg-amber-500 text-white border-transparent">
                  <Clock className="h-3 w-3 mr-1" />
                  {overdueCount} atrasadas
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="w-full">
          <div className="flex gap-4 pb-4">
            {columns.map(column => (
              <KanbanColumn
                key={column.id}
                column={column}
                tasks={tasksByColumn[column.id]}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
