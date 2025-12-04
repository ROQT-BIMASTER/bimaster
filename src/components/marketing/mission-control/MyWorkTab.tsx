import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  User, Clock, Zap, Target, Calendar, 
  CheckCircle, AlertTriangle, Timer, TrendingUp
} from "lucide-react";
import { format, differenceInDays, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const taskTypeLabels: Record<string, string> = {
  post_instagram: 'Post Instagram',
  post_tiktok: 'Post TikTok',
  catalogo: 'Catálogo',
  video: 'Vídeo',
  email: 'Email Marketing',
  banner: 'Banner',
  arte: 'Arte Gráfica'
};

const statusColors: Record<string, string> = {
  pendente: 'bg-gray-500',
  em_andamento: 'bg-blue-500',
  em_revisao: 'bg-amber-500',
  concluida: 'bg-green-500'
};

interface MyWorkTabProps {
  onTaskClick: (taskId: string) => void;
}

export function MyWorkTab({ onTaskClick }: MyWorkTabProps) {
  const { data: userData } = useQuery({
    queryKey: ['my-work-data'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // Get user's tasks
      const { data: tasks } = await supabase
        .from('lancamentos_tarefas_marketing')
        .select(`
          id, tipo, titulo, status, data_prazo, pontos_base, alerta_gargalo,
          lancamento:lancamentos_produtos(nome_lancamento)
        `)
        .eq('responsavel_id', user.id)
        .neq('status', 'concluida')
        .order('data_prazo', { ascending: true });

      // Get user's work sessions this week
      const weekStart = startOfWeek(new Date(), { locale: ptBR });
      const weekEnd = endOfWeek(new Date(), { locale: ptBR });
      
      const { data: sessions } = await supabase
        .from('marketing_work_sessions')
        .select('duracao_minutos')
        .eq('user_id', user.id)
        .gte('inicio', weekStart.toISOString())
        .lte('inicio', weekEnd.toISOString())
        .not('duracao_minutos', 'is', null);

      // Get user's stats
      const { data: stats } = await supabase
        .from('marketing_user_stats')
        .select('*')
        .eq('user_id', user.id)
        .single();

      // Get user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('nome')
        .eq('id', user.id)
        .single();

      // Get active session
      const { data: activeSession } = await supabase
        .from('marketing_work_sessions')
        .select('*, tarefa:lancamentos_tarefas_marketing(titulo)')
        .eq('user_id', user.id)
        .is('fim', null)
        .single();

      const totalMinutesThisWeek = sessions?.reduce((acc, s) => acc + (s.duracao_minutos || 0), 0) || 0;

      return {
        tasks: tasks || [],
        stats,
        profile,
        totalMinutesThisWeek,
        activeSession
      };
    }
  });

  const tasks = userData?.tasks || [];
  const stats = userData?.stats;
  const profile = userData?.profile;
  const totalMinutesThisWeek = userData?.totalMinutesThisWeek || 0;
  const activeSession = userData?.activeSession;

  const pendingTasks = tasks.filter(t => t.status === 'pendente');
  const inProgressTasks = tasks.filter(t => t.status === 'em_andamento');
  const inReviewTasks = tasks.filter(t => t.status === 'em_revisao');
  const overdueTasks = tasks.filter(t => differenceInDays(new Date(t.data_prazo), new Date()) < 0);

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}min`;
  };

  return (
    <div className="space-y-6">
      {/* Header com stats pessoais */}
      <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-xl bg-primary/20">
                {profile?.nome?.slice(0, 2).toUpperCase() || 'ME'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h2 className="text-xl font-semibold">
                Olá, {profile?.nome?.split(' ')[0] || 'Usuário'}!
              </h2>
              <p className="text-sm text-muted-foreground">
                Você tem {tasks.length} tarefas ativas
              </p>
            </div>
            <div className="grid grid-cols-3 gap-6 text-center">
              <div>
                <p className="text-2xl font-bold text-primary">{stats?.total_points || 0}</p>
                <p className="text-xs text-muted-foreground">Pontos Total</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.tasks_completed || 0}</p>
                <p className="text-xs text-muted-foreground">Concluídas</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{formatTime(totalMinutesThisWeek)}</p>
                <p className="text-xs text-muted-foreground">Esta Semana</p>
              </div>
            </div>
          </div>

          {/* Active timer indicator */}
          {activeSession && (
            <div className="mt-4 p-3 rounded-lg bg-primary/10 border border-primary/20 flex items-center gap-3">
              <div className="animate-pulse">
                <Timer className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Timer ativo</p>
                <p className="text-xs text-muted-foreground">
                  {activeSession.tarefa?.titulo}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gray-500/10">
              <Clock className="h-5 w-5 text-gray-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendingTasks.length}</p>
              <p className="text-xs text-muted-foreground">Pendentes</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Target className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{inProgressTasks.length}</p>
              <p className="text-xs text-muted-foreground">Em Andamento</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <CheckCircle className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{inReviewTasks.length}</p>
              <p className="text-xs text-muted-foreground">Em Revisão</p>
            </div>
          </CardContent>
        </Card>
        <Card className={overdueTasks.length > 0 ? "border-red-500/50" : ""}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-500">{overdueTasks.length}</p>
              <p className="text-xs text-muted-foreground">Atrasadas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Minhas Tarefas */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5" />
            Minhas Tarefas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {tasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma tarefa pendente!</p>
                </div>
              ) : (
                tasks.map(task => {
                  const daysUntil = differenceInDays(new Date(task.data_prazo), new Date());
                  const isOverdue = daysUntil < 0;
                  const isUrgent = daysUntil <= 2 && daysUntil >= 0;

                  return (
                    <div
                      key={task.id}
                      onClick={() => onTaskClick(task.id)}
                      className={cn(
                        "p-3 rounded-lg border bg-card cursor-pointer transition-all",
                        "hover:shadow-md hover:border-primary/30",
                        task.alerta_gargalo && "border-red-500/50 bg-red-500/5",
                        isOverdue && !task.alerta_gargalo && "border-amber-500/50"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-[10px]">
                              {taskTypeLabels[task.tipo] || task.tipo}
                            </Badge>
                            <Badge className={cn("text-white text-[10px]", statusColors[task.status])}>
                              {task.status}
                            </Badge>
                            {task.alerta_gargalo && (
                              <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                            )}
                          </div>
                          <p className="font-medium line-clamp-1">{task.titulo}</p>
                          {task.lancamento && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              🚀 {task.lancamento.nome_lancamento}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <Badge variant="secondary" className="text-xs mb-1">
                            <Zap className="h-3 w-3 mr-0.5" />
                            {task.pontos_base}pts
                          </Badge>
                          <p className={cn(
                            "text-xs flex items-center gap-1 justify-end",
                            isOverdue && "text-red-500 font-medium",
                            isUrgent && "text-amber-500 font-medium"
                          )}>
                            <Calendar className="h-3 w-3" />
                            {isOverdue 
                              ? `${Math.abs(daysUntil)}d atrasado`
                              : isUrgent
                                ? `${daysUntil}d restantes`
                                : format(new Date(task.data_prazo), "dd/MM", { locale: ptBR })
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}