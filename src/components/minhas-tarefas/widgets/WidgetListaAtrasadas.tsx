import { useMemo } from "react";
import { format, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle } from "lucide-react";
import type { MinaTarefa } from "@/hooks/useMinhasTarefas";

export function WidgetListaAtrasadas({ tarefas }: { tarefas: MinaTarefa[] }) {
  const atrasadas = useMemo(() => {
    const now = startOfDay(new Date());
    return tarefas
      .filter((t) => t.status !== "concluida" && t.data_prazo && startOfDay(new Date(t.data_prazo)) < now)
      .sort((a, b) => new Date(a.data_prazo!).getTime() - new Date(b.data_prazo!).getTime())
      .slice(0, 8);
  }, [tarefas]);

  if (atrasadas.length === 0)
    return (
      <div className="flex flex-col items-center py-6 text-muted-foreground">
        <AlertTriangle className="h-8 w-8 mb-2 text-success" />
        <p className="text-sm">Nenhuma tarefa atrasada!</p>
      </div>
    );

  return (
    <div className="space-y-1 max-h-[220px] overflow-auto">
      {atrasadas.map((t) => (
        <div key={t.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/40 text-sm">
          <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: t.projeto_cor }} />
          <span className="flex-1 truncate">{t.titulo}</span>
          <span className="text-xs text-destructive font-medium shrink-0">
            {format(new Date(t.data_prazo!), "dd/MM", { locale: ptBR })}
          </span>
        </div>
      ))}
    </div>
  );
}
