/**
 * TaskMentionCard — card de tarefa renderizado dentro de uma mensagem do chat.
 *
 * Lê a tarefa via id (vinda de `mensagens.metadata.tarefas`) e renderiza
 * status + projeto + link clicável para o detalhe. Hot-reload no status:
 * useQuery com staleTime curto e refetch on mount.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
// Sem react-router aqui: montado também pelo ChatDrawer (fora do <Router/>).
import { Badge } from "@/components/ui/badge";
import { CheckSquare, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskCardData {
  id: string;
  titulo: string;
  status: string | null;
  projeto_id: string;
  projeto_nome: string | null;
  data_prazo: string | null;
}

function statusColor(s: string | null): string {
  if (s === "concluida") return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
  if (s === "andamento" || s === "em_andamento") return "bg-blue-500/15 text-blue-700 dark:text-blue-400";
  if (s === "atrasada" || s === "bloqueada") return "bg-red-500/15 text-red-700 dark:text-red-400";
  return "bg-muted text-muted-foreground";
}

function statusLabel(s: string | null): string {
  switch (s) {
    case "concluida": return "Concluída";
    case "andamento":
    case "em_andamento": return "Em andamento";
    case "atrasada": return "Atrasada";
    case "bloqueada": return "Bloqueada";
    default: return "Pendente";
  }
}

export function TaskMentionCard({ tarefaId, mine }: { tarefaId: string; mine: boolean }) {
  const { data: task } = useQuery({
    queryKey: ["chat-task-mention-card", tarefaId],
    staleTime: 30_000,
    queryFn: async (): Promise<TaskCardData | null> => {
      const { data, error } = await supabase
        .from("projeto_tarefas")
        .select("id, titulo, status, projeto_id, data_prazo, projetos:projeto_id(nome)")
        .eq("id", tarefaId)
        .maybeSingle();
      if (error || !data) return null;
      const row = data as any;
      return {
        id: row.id,
        titulo: row.titulo,
        status: row.status,
        projeto_id: row.projeto_id,
        projeto_nome: row.projetos?.nome ?? null,
        data_prazo: row.data_prazo,
      };
    },
  });

  if (!task) {
    return (
      <div className={cn(
        "mt-2 rounded-lg border border-dashed px-3 py-1.5 text-xs",
        mine ? "border-white/30 text-white/80" : "border-border text-muted-foreground",
      )}>
        <CheckSquare className="inline h-3 w-3 mr-1 align-text-bottom" />
        Tarefa removida ou sem acesso
      </div>
    );
  }

  return (
    <Link
      to={`/projetos/${task.projeto_id}?tarefa=${task.id}`}
      className={cn(
        "mt-2 block rounded-lg border px-3 py-2 group transition-colors",
        mine
          ? "border-white/30 bg-white/10 hover:bg-white/15"
          : "border-border bg-background hover:bg-muted/60",
      )}
    >
      <div className="flex items-start gap-2">
        <CheckSquare className={cn("h-4 w-4 mt-0.5 shrink-0", mine ? "text-white" : "text-primary")} />
        <div className="flex-1 min-w-0">
          <p className={cn("text-sm font-medium truncate", mine && "text-white")}>{task.titulo}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge className={cn("text-[10px] h-4 px-1.5 border-0", statusColor(task.status))}>
              {statusLabel(task.status)}
            </Badge>
            {task.projeto_nome && (
              <span className={cn("text-[10px]", mine ? "text-white/70" : "text-muted-foreground")}>
                {task.projeto_nome}
              </span>
            )}
            {task.data_prazo && (
              <span className={cn("text-[10px]", mine ? "text-white/70" : "text-muted-foreground")}>
                prazo {new Date(task.data_prazo).toLocaleDateString("pt-BR")}
              </span>
            )}
          </div>
        </div>
        <ExternalLink className={cn(
          "h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity",
          mine ? "text-white/80" : "text-muted-foreground",
        )} />
      </div>
    </Link>
  );
}
