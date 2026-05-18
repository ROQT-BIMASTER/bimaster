/**
 * TaskMentionAutocomplete — popover para mencionar tarefas no chat.
 *
 * Diferencial único do bimaster: mencionar uma tarefa do módulo Projetos
 * direto no chat corporativo. O bubble renderiza um card clicável com
 * status, projeto e link para o detalhe.
 *
 * Trigger: `/tarefa <termo>` no MessageInput abre este popover com tarefas
 * filtradas (não excluídas, dos projetos que o usuário tem acesso via RLS).
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { CheckSquare, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TaskMention {
  id: string;
  titulo: string;
  status: string | null;
  projeto_id: string;
  projeto_nome: string | null;
  data_prazo: string | null;
}

interface Props {
  query: string;
  onPick: (task: TaskMention) => void;
  className?: string;
}

/** Cor do badge por status — mesma escala dos componentes de Projetos. */
function statusVariant(s: string | null): "default" | "secondary" | "outline" | "destructive" {
  if (s === "concluida") return "default";
  if (s === "andamento" || s === "em_andamento") return "secondary";
  if (s === "atrasada" || s === "bloqueada") return "destructive";
  return "outline";
}

function statusLabel(s: string | null): string {
  switch (s) {
    case "concluida": return "Concluída";
    case "andamento":
    case "em_andamento": return "Em andamento";
    case "atrasada": return "Atrasada";
    case "bloqueada": return "Bloqueada";
    case "pendente":
    case null:
    case undefined: return "Pendente";
    default: return s ?? "—";
  }
}

export function TaskMentionAutocomplete({ query, onPick, className }: Props) {
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["chat-task-mention", query],
    staleTime: 30_000,
    queryFn: async (): Promise<TaskMention[]> => {
      const q = query.trim();
      // Sem termo: lista as 10 tarefas mais recentes acessíveis.
      let req = supabase
        .from("projeto_tarefas")
        .select("id, titulo, status, projeto_id, data_prazo, projetos:projeto_id(nome)")
        .is("excluida_em", null)
        .order("updated_at", { ascending: false })
        .limit(10);
      if (q.length >= 1) {
        // ilike no titulo. Postgres trata acento separadamente — aceita aproximação.
        req = req.ilike("titulo", `%${q}%`);
      }
      const { data, error } = await req;
      if (error) throw error;
      return ((data ?? []) as any[]).map((t) => ({
        id: t.id,
        titulo: t.titulo,
        status: t.status,
        projeto_id: t.projeto_id,
        projeto_nome: t.projetos?.nome ?? null,
        data_prazo: t.data_prazo,
      }));
    },
  });

  const filtered = useMemo(() => tasks.slice(0, 10), [tasks]);

  if (isLoading) {
    return (
      <div className={cn("w-80 p-2 text-xs text-muted-foreground flex items-center gap-2", className)}>
        <Loader2 className="h-3 w-3 animate-spin" /> Carregando tarefas...
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className={cn("w-80 p-3 text-xs text-muted-foreground text-center", className)}>
        Nenhuma tarefa encontrada
      </div>
    );
  }

  return (
    <div className={cn("w-80", className)}>
      <ScrollArea className="max-h-64">
        <ul className="py-1">
          {filtered.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onPick(t)}
                className="w-full px-3 py-2 flex flex-col items-start gap-1 hover:bg-muted text-left"
              >
                <div className="flex items-center gap-2 w-full">
                  <CheckSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm truncate flex-1">{t.titulo}</span>
                  <Badge variant={statusVariant(t.status)} className="text-[10px] h-4 px-1 shrink-0">
                    {statusLabel(t.status)}
                  </Badge>
                </div>
                {t.projeto_nome && (
                  <p className="text-[10px] text-muted-foreground pl-5 truncate w-full">
                    {t.projeto_nome}
                  </p>
                )}
              </button>
            </li>
          ))}
        </ul>
      </ScrollArea>
    </div>
  );
}
