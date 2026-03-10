import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Undo2, Trash2, Loader2 } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TarefaExcluida {
  id: string;
  titulo: string;
  excluida_em: string;
}

interface ProjetoLixeiraDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tarefas: TarefaExcluida[];
  loading?: boolean;
  onRestaurar: (tarefaId: string) => void;
}

export function ProjetoLixeiraDialog({ open, onOpenChange, tarefas, loading, onRestaurar }: ProjetoLixeiraDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-muted-foreground" />
            Lixeira
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : tarefas.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma tarefa excluída</p>
        ) : (
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {tarefas.map(t => (
              <div key={t.id} className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-muted/50 group">
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{t.titulo}</p>
                  <p className="text-xs text-muted-foreground">
                    Excluída {formatDistanceToNow(new Date(t.excluida_em), { locale: ptBR, addSuffix: true })}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => onRestaurar(t.id)}
                >
                  <Undo2 className="h-3.5 w-3.5" />
                  Restaurar
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
