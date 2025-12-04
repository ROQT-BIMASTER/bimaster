import { Badge } from "@/components/ui/badge";
import { Rocket, Calendar, Target, Clock } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Launch {
  id: string;
  nome_lancamento: string;
  descricao?: string | null;
  data_prevista?: string | null;
  data_efetiva?: string | null;
  status: string;
  tipo: string;
  prioridade: string;
}

interface RelatedTask {
  id: string;
  titulo: string;
  tipo: string;
  status: string;
}

interface LaunchContextProps {
  launch: Launch | null;
  relatedTasks?: RelatedTask[];
}

const statusColors: Record<string, string> = {
  planejado: 'bg-gray-500',
  em_preparacao: 'bg-blue-500',
  aprovado: 'bg-amber-500',
  lancado: 'bg-green-500',
  cancelado: 'bg-red-500'
};

const statusLabels: Record<string, string> = {
  planejado: 'Planejado',
  em_preparacao: 'Em Preparação',
  aprovado: 'Aprovado',
  lancado: 'Lançado',
  cancelado: 'Cancelado'
};

const tipoLabels: Record<string, string> = {
  novo_produto: 'Novo Produto',
  reformulacao: 'Reformulação',
  promocao: 'Promoção',
  extensao_linha: 'Extensão de Linha'
};

export function LaunchContext({ launch, relatedTasks = [] }: LaunchContextProps) {
  if (!launch) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <Rocket className="h-10 w-10 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Lançamento não vinculado</p>
      </div>
    );
  }

  const daysUntilLaunch = launch.data_prevista 
    ? differenceInDays(new Date(launch.data_prevista), new Date())
    : null;

  const isLaunched = launch.status === 'lancado';
  const isPastDue = daysUntilLaunch !== null && daysUntilLaunch < 0 && !isLaunched;

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <Rocket className="h-4 w-4" />
        Contexto do Lançamento
      </h4>

      <div className="p-3 rounded-lg bg-muted/30 border space-y-3">
        {/* Nome e status */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium">{launch.nome_lancamento}</p>
            {launch.descricao && (
              <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                {launch.descricao}
              </p>
            )}
          </div>
          <Badge className={cn("text-white text-xs", statusColors[launch.status])}>
            {statusLabels[launch.status] || launch.status}
          </Badge>
        </div>

        {/* Info badges */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="text-xs">
            <Target className="h-3 w-3 mr-1" />
            {tipoLabels[launch.tipo] || launch.tipo}
          </Badge>
          
          {launch.data_prevista && (
            <Badge 
              variant={isPastDue ? "destructive" : "secondary"} 
              className="text-xs"
            >
              <Calendar className="h-3 w-3 mr-1" />
              {format(new Date(launch.data_prevista), "dd/MM/yyyy", { locale: ptBR })}
            </Badge>
          )}

          {daysUntilLaunch !== null && !isLaunched && (
            <Badge 
              variant={isPastDue ? "destructive" : daysUntilLaunch <= 7 ? "warning" : "outline"}
              className="text-xs"
            >
              <Clock className="h-3 w-3 mr-1" />
              {isPastDue 
                ? `${Math.abs(daysUntilLaunch)}d atrasado`
                : daysUntilLaunch === 0 
                  ? 'Hoje!'
                  : `${daysUntilLaunch}d restantes`
              }
            </Badge>
          )}
        </div>

        {/* Related tasks */}
        {relatedTasks.length > 0 && (
          <div className="pt-2 border-t border-border/50">
            <p className="text-xs text-muted-foreground mb-2">
              Outras tarefas deste lançamento:
            </p>
            <div className="space-y-1">
              {relatedTasks.slice(0, 5).map(task => (
                <div 
                  key={task.id}
                  className="flex items-center justify-between text-xs p-1.5 rounded bg-background/50"
                >
                  <span className="truncate">{task.titulo}</span>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {task.status}
                  </Badge>
                </div>
              ))}
              {relatedTasks.length > 5 && (
                <p className="text-xs text-muted-foreground text-center">
                  +{relatedTasks.length - 5} outras tarefas
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}