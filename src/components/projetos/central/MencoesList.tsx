import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AtSign, Check, Trash2, MessageSquare, FolderOpen, Workflow } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { MencaoItem } from "@/hooks/useMencoesNotifications";

interface MencoesListProps {
  mencoes: MencaoItem[];
  isLoading: boolean;
  onMarcarLida: (ids: string[]) => void;
  onRemover: (ids: string[]) => void;
}

const ICON_BY_TYPE: Record<string, typeof MessageSquare> = {
  task_mention: MessageSquare,
  chat_mention: FolderOpen,
  process_mention: Workflow,
};

const LABEL_BY_TYPE: Record<string, string> = {
  task_mention: "Tarefa",
  chat_mention: "Chat do projeto",
  process_mention: "Processo",
};

export function MencoesList({ mencoes, isLoading, onMarcarLida, onRemover }: MencoesListProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Carregando menções...</div>;
  }

  if (mencoes.length === 0) {
    return (
      <div className="p-12 text-center">
        <AtSign className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
        <p className="text-sm font-medium">Nenhuma menção ainda</p>
        <p className="text-xs text-muted-foreground mt-1">
          Quando alguém mencionar você com @, a notificação aparecerá aqui
        </p>
      </div>
    );
  }

  const open = (m: MencaoItem) => {
    if (!m.read) onMarcarLida([m.id]);
    if (m.action_url) navigate(m.action_url);
  };

  return (
    <div className="divide-y divide-border/40">
      {mencoes.map(m => {
        const Icon = ICON_BY_TYPE[m.type] || AtSign;
        return (
          <div
            key={m.id}
            className={cn(
              "flex items-start gap-3 px-4 py-3 hover:bg-muted/40 transition-colors group",
              !m.read && "bg-primary/5"
            )}
          >
            <button
              onClick={() => open(m)}
              className="flex items-start gap-3 flex-1 text-left min-w-0"
            >
              <div className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0",
                m.read ? "bg-muted text-muted-foreground" : "bg-primary/15 text-primary"
              )}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium truncate">{m.title}</span>
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5 flex-shrink-0">
                    {LABEL_BY_TYPE[m.type] || "Menção"}
                  </Badge>
                  {!m.read && <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{m.message}</p>
                <p className="text-[10px] text-muted-foreground/70 mt-1">
                  {format(new Date(m.created_at), "dd MMM, HH:mm", { locale: ptBR })}
                </p>
              </div>
            </button>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {!m.read && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title="Marcar como lida"
                  onClick={() => onMarcarLida([m.id])}
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                title="Remover"
                onClick={() => onRemover([m.id])}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
