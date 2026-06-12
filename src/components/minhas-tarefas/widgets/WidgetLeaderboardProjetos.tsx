import { useMemo } from "react";
import { subDays, startOfDay } from "date-fns";
import { Trophy } from "lucide-react";
import { parseLocalDate, getToday } from "@/lib/utils/parseLocalDate";
import type { MinaTarefa } from "@/hooks/useMinhasTarefas";

interface ProjectStats {
  id: string;
  nome: string;
  cor: string;
  velocity: number;
  pendentes: number;
  total: number;
}

export function WidgetLeaderboardProjetos({ tarefas }: { tarefas: MinaTarefa[] }) {
  const projetos = useMemo<ProjectStats[]>(() => {
    const now = getToday();
    const cutoff = subDays(now, 7);
    const map = new Map<string, ProjectStats>();
    for (const t of tarefas) {
      const cur = map.get(t.projeto_id) || {
        id: t.projeto_id,
        nome: t.projeto_nome,
        cor: t.projeto_cor,
        velocity: 0,
        pendentes: 0,
        total: 0,
      };
      cur.total++;
      if (t.status !== "concluida") cur.pendentes++;
      if (t.status === "concluida") {
        const ref = t.data_conclusao ? parseLocalDate(t.data_conclusao) : t.updated_at ? new Date(t.updated_at) : null;
        if (ref && startOfDay(ref).getTime() >= cutoff.getTime()) {
          cur.velocity++;
        }
      }
      map.set(t.projeto_id, cur);
    }
    return Array.from(map.values())
      .sort((a, b) => b.velocity - a.velocity || b.total - a.total)
      .slice(0, 5);
  }, [tarefas]);

  if (projetos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
        <Trophy className="h-7 w-7 opacity-40 mb-2" />
        <p className="text-xs">Sem dados de projetos</p>
      </div>
    );
  }

  const maxVelocity = Math.max(1, ...projetos.map((p) => p.velocity));

  return (
    <ul className="space-y-2.5">
      {projetos.map((p, idx) => {
        const pct = (p.velocity / maxVelocity) * 100;
        return (
          <li key={p.id} className="space-y-1">
            <div className="flex items-center gap-2 text-xs">
              <span className="w-4 text-center text-[10px] font-semibold text-muted-foreground tabular-nums">
                {idx + 1}
              </span>
              <span className="h-2 w-2 rounded-sm shrink-0" style={{ backgroundColor: p.cor }} />
              <span className="flex-1 truncate font-medium text-foreground">{p.nome}</span>
              <span className="tabular-nums text-muted-foreground">
                {p.velocity} <span className="text-[10px]">conc/7d</span>
              </span>
            </div>
            <div className="ml-6 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.max(4, pct)}%`,
                  backgroundColor: p.cor,
                }}
              />
            </div>
            <div className="ml-6 flex items-center justify-between text-[10px] text-muted-foreground tabular-nums">
              <span>{p.pendentes} pendentes</span>
              <span>{p.total} total</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
