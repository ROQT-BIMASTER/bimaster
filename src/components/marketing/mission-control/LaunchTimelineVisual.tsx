import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { format, differenceInDays, addDays, isToday, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Rocket, Calendar, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Launch {
  id: string;
  nome: string;
  data_lancamento: string;
  status: string;
  produto: {
    nome: string;
    foto_url?: string;
  } | null;
  tarefas: {
    id: string;
    status: string;
  }[];
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  planejado: { label: "Planejado", color: "bg-blue-500", icon: <Calendar className="h-3 w-3" /> },
  em_preparacao: { label: "Em Preparação", color: "bg-amber-500", icon: <Clock className="h-3 w-3" /> },
  aprovado: { label: "Aprovado", color: "bg-green-500", icon: <CheckCircle className="h-3 w-3" /> },
  lancado: { label: "Lançado", color: "bg-purple-500", icon: <Rocket className="h-3 w-3" /> }
};

function LaunchCard({ launch }: { launch: Launch }) {
  const daysUntil = differenceInDays(new Date(launch.data_lancamento), new Date());
  const totalTasks = launch.tarefas?.length || 0;
  const completedTasks = launch.tarefas?.filter(t => t.status === 'concluida').length || 0;
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
  const config = statusConfig[launch.status] || statusConfig.planejado;
  
  const isOverdue = daysUntil < 0 && launch.status !== 'lancado';
  const isUrgent = daysUntil <= 3 && daysUntil >= 0 && launch.status !== 'lancado';

  return (
    <div className={cn(
      "relative min-w-[280px] p-4 rounded-xl border transition-all duration-300",
      "hover:shadow-lg hover:scale-[1.02] cursor-pointer",
      isOverdue && "border-red-500/50 bg-red-500/5",
      isUrgent && "border-amber-500/50 bg-amber-500/5",
      !isOverdue && !isUrgent && "border-border/50 bg-card"
    )}>
      {/* Status indicator */}
      <div className={cn(
        "absolute top-0 left-4 -translate-y-1/2 px-2 py-0.5 rounded-full text-[10px] font-medium text-white flex items-center gap-1",
        config.color
      )}>
        {config.icon}
        {config.label}
      </div>

      {/* Product image or placeholder */}
      <div className="mt-2 mb-3 flex items-center gap-3">
        <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
          {launch.produto?.foto_url ? (
            <img src={launch.produto.foto_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <Rocket className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm truncate">{launch.nome}</h4>
          <p className="text-xs text-muted-foreground truncate">
            {launch.produto?.nome || 'Sem produto'}
          </p>
        </div>
      </div>

      {/* Date and countdown */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted-foreground">
          {format(new Date(launch.data_lancamento), "dd MMM yyyy", { locale: ptBR })}
        </span>
        <Badge variant={isOverdue ? "destructive" : isUrgent ? "warning" : "secondary"} className="text-[10px]">
          {isOverdue ? (
            <><AlertTriangle className="h-3 w-3 mr-1" /> {Math.abs(daysUntil)}d atrasado</>
          ) : isToday(new Date(launch.data_lancamento)) ? (
            "HOJE!"
          ) : (
            `${daysUntil}d restantes`
          )}
        </Badge>
      </div>

      {/* Progress */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">Progresso das tarefas</span>
          <span className="font-medium">{completedTasks}/{totalTasks}</span>
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>
    </div>
  );
}

export function LaunchTimelineVisual() {
  const { data: launches, isLoading } = useQuery({
    queryKey: ['launch-timeline'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lancamentos_produtos')
        .select(`
          id,
          nome,
          data_lancamento,
          status,
          produto:fabrica_produtos(nome, foto_url),
          tarefas:lancamentos_tarefas_marketing(id, status)
        `)
        .in('status', ['planejado', 'em_preparacao', 'aprovado'])
        .order('data_lancamento', { ascending: true })
        .limit(10);
      
      if (error) throw error;
      return data as unknown as Launch[];
    }
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            Timeline de Lançamentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            {[1,2,3].map(i => (
              <div key={i} className="min-w-[280px] h-[160px] rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Rocket className="h-5 w-5 text-primary" />
          Timeline de Lançamentos
          {launches && launches.length > 0 && (
            <Badge variant="secondary" className="ml-2">{launches.length} ativos</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {launches && launches.length > 0 ? (
          <ScrollArea className="w-full">
            <div className="flex gap-4 pb-4 pt-3">
              {launches.map(launch => (
                <LaunchCard key={launch.id} launch={launch} />
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Rocket className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Nenhum lançamento ativo</p>
            <p className="text-sm">Crie um lançamento no módulo Fábrica</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
