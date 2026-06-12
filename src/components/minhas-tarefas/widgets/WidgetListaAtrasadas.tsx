import { useMemo } from "react";
import { format, startOfDay, differenceInCalendarDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2 } from "lucide-react";
import { parseLocalDate, getToday } from "@/lib/utils/parseLocalDate";
import type { MinaTarefa } from "@/hooks/useMinhasTarefas";
import { TarefaResponsavelAvatar } from "@/components/projetos/shared/TarefaResponsavelAvatar";

export function WidgetListaAtrasadas({ tarefas }: { tarefas: MinaTarefa[] }) {
  const atrasadas = useMemo(() => {
    const now = getToday();
    return tarefas
      .filter((t) => {
        if (t.status === "concluida") return false;
        const p = parseLocalDate(t.data_prazo);
        return p && startOfDay(p) < now;
      })
      .sort((a, b) => (parseLocalDate(a.data_prazo)?.getTime() ?? 0) - (parseLocalDate(b.data_prazo)?.getTime() ?? 0))
      .slice(0, 8);
  }, [tarefas]);

  if (atrasadas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
        <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center mb-2">
          <CheckCircle2 className="h-5 w-5 text-success" />
        </div>
        <p className="text-xs font-medium text-foreground">Tudo em dia</p>
        <p className="text-[11px] mt-0.5">Nenhuma tarefa atrasada</p>
      </div>
    );
  }

  const now = getToday();

  return (
    <ul className="divide-y divide-border/60 max-h-[240px] overflow-auto -mx-1">
      {atrasadas.map((t) => {
        const prazo = parseLocalDate(t.data_prazo) ?? now;
        const diasAtraso = Math.abs(differenceInCalendarDays(startOfDay(prazo), now));
        return (
          <li
            key={t.id}
            className="flex items-center gap-2.5 px-2 py-2 hover:bg-muted/40 transition-colors rounded-sm"
          >
            <span
              className="h-6 w-1 rounded-full shrink-0"
              style={{ backgroundColor: t.projeto_cor }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate leading-tight">{t.titulo}</p>
              <p className="text-[10.5px] text-muted-foreground truncate mt-0.5">{t.projeto_nome}</p>
            </div>
            <TarefaResponsavelAvatar
              responsavelId={t.responsavel_id}
              nome={t.responsavel_nome}
              avatarUrl={t.responsavel_avatar_url}
              size="xs"
            />
            <div className="text-right shrink-0">
              <p className="text-[11px] font-semibold text-destructive tabular-nums leading-tight">
                {diasAtraso}d
              </p>
              <p className="text-[10px] text-muted-foreground tabular-nums mt-0.5">
                {format(prazo, "dd/MM", { locale: ptBR })}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
