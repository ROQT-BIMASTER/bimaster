import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Timer, Play, Square, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format, differenceInMinutes, differenceInSeconds } from "date-fns";
import { ptBR } from "date-fns/locale";

interface WorkSession {
  id: string;
  inicio: string;
  fim?: string | null;
  duracao_minutos?: number | null;
  observacoes?: string | null;
}

interface TaskTimerProps {
  tarefaId: string;
  sessions: WorkSession[];
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) {
    return `${hours}h ${mins}min`;
  }
  return `${mins}min`;
}

function formatElapsed(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function TaskTimer({ tarefaId, sessions }: TaskTimerProps) {
  const [elapsed, setElapsed] = useState(0);
  const queryClient = useQueryClient();

  // Find active session (session without fim)
  const activeSession = sessions.find(s => !s.fim);

  // Calculate total time
  const totalMinutes = sessions.reduce((acc, s) => {
    if (s.duracao_minutos) return acc + s.duracao_minutos;
    if (s.fim) {
      return acc + differenceInMinutes(new Date(s.fim), new Date(s.inicio));
    }
    return acc;
  }, 0);

  // Timer effect for active session
  useEffect(() => {
    if (!activeSession) {
      setElapsed(0);
      return;
    }

    const updateElapsed = () => {
      const seconds = differenceInSeconds(new Date(), new Date(activeSession.inicio));
      setElapsed(seconds);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [activeSession]);

  const startSession = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const { error } = await supabase
        .from('marketing_work_sessions')
        .insert({
          tarefa_id: tarefaId,
          user_id: user.id,
          inicio: new Date().toISOString()
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-detail', tarefaId] });
      toast.success('Timer iniciado!');
    },
    onError: () => toast.error('Erro ao iniciar timer')
  });

  const stopSession = useMutation({
    mutationFn: async () => {
      if (!activeSession) return;

      const fim = new Date();
      const duracao = differenceInMinutes(fim, new Date(activeSession.inicio));

      const { error } = await supabase
        .from('marketing_work_sessions')
        .update({
          fim: fim.toISOString(),
          duracao_minutos: duracao
        })
        .eq('id', activeSession.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-detail', tarefaId] });
      toast.success('Timer parado!');
    },
    onError: () => toast.error('Erro ao parar timer')
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Timer className="h-4 w-4" />
          Timer de Trabalho
        </h4>
        <Badge variant="secondary" className="text-xs">
          <Clock className="h-3 w-3 mr-1" />
          Total: {formatDuration(totalMinutes + Math.floor(elapsed / 60))}
        </Badge>
      </div>

      {/* Active timer display */}
      <div className={cn(
        "p-4 rounded-lg border text-center transition-all",
        activeSession ? "bg-primary/5 border-primary/30" : "bg-muted/30"
      )}>
        <p className={cn(
          "text-3xl font-mono font-bold",
          activeSession ? "text-primary" : "text-muted-foreground"
        )}>
          {formatElapsed(elapsed)}
        </p>
        
        <div className="mt-3">
          {activeSession ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => stopSession.mutate()}
              disabled={stopSession.isPending}
            >
              {stopSession.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Square className="h-4 w-4 mr-1" />
              )}
              Parar Timer
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={() => startSession.mutate()}
              disabled={startSession.isPending}
            >
              {startSession.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-1" />
              )}
              Iniciar Timer
            </Button>
          )}
        </div>
      </div>

      {/* Session history */}
      {sessions.filter(s => s.fim).length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Sessões anteriores:</p>
          <div className="space-y-1 max-h-[150px] overflow-y-auto">
            {sessions
              .filter(s => s.fim)
              .sort((a, b) => new Date(b.inicio).getTime() - new Date(a.inicio).getTime())
              .slice(0, 5)
              .map(session => (
                <div 
                  key={session.id}
                  className="flex items-center justify-between text-xs p-2 rounded bg-muted/50"
                >
                  <span>
                    {format(new Date(session.inicio), "dd/MM HH:mm", { locale: ptBR })}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {session.duracao_minutos ? formatDuration(session.duracao_minutos) : '-'}
                  </Badge>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}