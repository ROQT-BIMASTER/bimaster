import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  X, Clock, User, Calendar, AlertTriangle, Zap,
  Package, FlaskConical, DollarSign, Rocket,
  CheckSquare, FileText, MessageSquare, Timer
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

import { ProductHistory } from "./task-detail/ProductHistory";
import { ProductFormula } from "./task-detail/ProductFormula";
import { ProductPricing } from "./task-detail/ProductPricing";
import { LaunchContext } from "./task-detail/LaunchContext";
import { TaskChecklist } from "./task-detail/TaskChecklist";
import { TaskFiles } from "./task-detail/TaskFiles";
import { TaskComments } from "./task-detail/TaskComments";
import { TaskTimer } from "./task-detail/TaskTimer";

interface TaskDetailDrawerProps {
  taskId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusColors: Record<string, string> = {
  pendente: 'bg-gray-500',
  em_andamento: 'bg-blue-500',
  em_revisao: 'bg-amber-500',
  concluida: 'bg-green-500'
};

const statusLabels: Record<string, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em Andamento',
  em_revisao: 'Em Revisão',
  concluida: 'Concluída'
};

const taskTypeLabels: Record<string, string> = {
  post_instagram: 'Post Instagram',
  post_tiktok: 'Post TikTok',
  catalogo: 'Catálogo',
  video: 'Vídeo',
  email: 'Email Marketing',
  banner: 'Banner',
  arte: 'Arte Gráfica'
};

export function TaskDetailDrawer({ taskId, open, onOpenChange }: TaskDetailDrawerProps) {
  const { data: taskDetail, isLoading } = useQuery({
    queryKey: ['task-detail', taskId],
    queryFn: async () => {
      if (!taskId) return null;

      const { data, error } = await supabase
        .from('lancamentos_tarefas_marketing')
        .select(`
          *,
          lancamento:lancamentos_produtos(
            *,
            produto:fabrica_produtos(
              *,
              formula:fabrica_formulas!fabrica_formulas_produto_id_fkey(
                id, nome, versao, rendimento,
                *,
                itens:fabrica_formula_itens(
                  *,
                  materia_prima:fabrica_materias_primas(nome, codigo, unidade)
                )
              )
            )
          ),
          responsavel:profiles!lancamentos_tarefas_marketing_responsavel_id_fkey(nome),
          checklist:marketing_task_checklist(*),
          arquivos:marketing_task_files(*),
          comentarios:marketing_task_comments(*),
          sessoes:marketing_work_sessions(*)
        `)
        .eq('id', taskId)
        .single();

      if (error) throw error;

      // Fetch related tasks from same launch
      let relatedTasks: any[] = [];
      if (data?.lancamento_id) {
        const { data: related } = await supabase
          .from('lancamentos_tarefas_marketing')
          .select('id, titulo, tipo, status')
          .eq('lancamento_id', data.lancamento_id)
          .neq('id', taskId)
          .limit(10);
        relatedTasks = related || [];
      }

      // Fetch product prices
      let precos: any[] = [];
      if (data?.lancamento?.produto?.id) {
        const { data: precosData } = await supabase
          .from('fabrica_precos_produtos')
          .select(`
            id,
            custo_base,
            preco_final,
            margem_lucro_percentual,
            tabela:fabrica_tabelas_preco(nome, codigo)
          `)
          .eq('produto_id', data.lancamento.produto.id);
        precos = precosData || [];
      }

      return {
        ...data,
        relatedTasks,
        precos
      };
    },
    enabled: !!taskId && open
  });

  const task = taskDetail;
  const produto = task?.lancamento?.produto as any;
  const lancamento = task?.lancamento as any;
  const daysUntil = task?.data_prazo 
    ? differenceInDays(new Date(task.data_prazo), new Date())
    : null;
  const isOverdue = daysUntil !== null && daysUntil < 0;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[95vh] max-h-[95vh]">
        <div className="mx-auto w-full max-w-4xl h-full flex flex-col">
          {/* Header */}
          <DrawerHeader className="border-b pb-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {taskTypeLabels[task?.tipo] || task?.tipo}
                  </Badge>
                  {task?.alerta_gargalo && (
                    <Badge variant="destructive" className="text-xs">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Gargalo
                    </Badge>
                  )}
                </div>
                <DrawerTitle className="text-xl">
                  {isLoading ? 'Carregando...' : task?.titulo}
                </DrawerTitle>
                {task?.descricao && (
                  <p className="text-sm text-muted-foreground">{task.descricao}</p>
                )}
              </div>
              <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Meta info */}
            {task && (
              <div className="flex items-center gap-4 mt-3 flex-wrap">
                <Badge className={cn("text-white", statusColors[task.status])}>
                  {statusLabels[task.status]}
                </Badge>
                
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  {task.responsavel?.nome || 'Não atribuído'}
                </div>

                <div className={cn(
                  "flex items-center gap-1 text-sm",
                  isOverdue ? "text-red-500" : "text-muted-foreground"
                )}>
                  <Calendar className="h-4 w-4" />
                  {format(new Date(task.data_prazo), "dd/MM/yyyy", { locale: ptBR })}
                  {daysUntil !== null && (
                    <span className="ml-1">
                      ({isOverdue ? `${Math.abs(daysUntil)}d atrasado` : `${daysUntil}d restantes`})
                    </span>
                  )}
                </div>

                <Badge variant="secondary" className="text-xs">
                  <Zap className="h-3 w-3 mr-1" />
                  {task.pontos_base} pts
                </Badge>
              </div>
            )}
          </DrawerHeader>

          {/* Content */}
          <ScrollArea className="flex-1">
            <div className="p-4">
              <Tabs defaultValue="produto" className="w-full">
                <TabsList className="grid w-full grid-cols-4 mb-4">
                  <TabsTrigger value="produto" className="text-xs">
                    <Package className="h-3.5 w-3.5 mr-1" />
                    Produto
                  </TabsTrigger>
                  <TabsTrigger value="trabalho" className="text-xs">
                    <CheckSquare className="h-3.5 w-3.5 mr-1" />
                    Trabalho
                  </TabsTrigger>
                  <TabsTrigger value="arquivos" className="text-xs">
                    <FileText className="h-3.5 w-3.5 mr-1" />
                    Arquivos
                  </TabsTrigger>
                  <TabsTrigger value="discussao" className="text-xs">
                    <MessageSquare className="h-3.5 w-3.5 mr-1" />
                    Discussão
                  </TabsTrigger>
                </TabsList>

                {/* Tab: Produto */}
                <TabsContent value="produto" className="space-y-6">
                  <ProductHistory product={produto} />
                  
                  <Separator />
                  
                  <ProductFormula formula={null} />
                  
                  <Separator />
                  
                  <ProductPricing precos={task?.precos || []} />
                  
                  <Separator />
                  
                  <LaunchContext 
                    launch={lancamento} 
                    relatedTasks={task?.relatedTasks}
                  />
                </TabsContent>

                {/* Tab: Trabalho */}
                <TabsContent value="trabalho" className="space-y-6">
                  {taskId && (
                    <>
                      <TaskChecklist 
                        tarefaId={taskId} 
                        items={task?.checklist || []}
                      />
                      
                      <Separator />
                      
                      <TaskTimer 
                        tarefaId={taskId}
                        sessions={task?.sessoes || []}
                      />
                    </>
                  )}
                </TabsContent>

                {/* Tab: Arquivos */}
                <TabsContent value="arquivos">
                  {taskId && (
                    <TaskFiles 
                      tarefaId={taskId}
                      files={task?.arquivos || []}
                    />
                  )}
                </TabsContent>

                {/* Tab: Discussão */}
                <TabsContent value="discussao">
                  {taskId && (
                    <TaskComments 
                      tarefaId={taskId}
                      comments={(task?.comentarios || []).map((c: any) => ({
                        ...c,
                        autor: { nome: 'Usuário' }
                      }))}
                    />
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </ScrollArea>
        </div>
      </DrawerContent>
    </Drawer>
  );
}