import { useProjetoAtividades, ProjetoAtividade } from "@/hooks/useProjetoAtividades";
import { ProjetoInboxCard } from "./ProjetoInboxCard";
import { Loader2, Inbox } from "lucide-react";
import { isToday, isYesterday, subDays, isAfter } from "date-fns";

function groupByTime(atividades: ProjetoAtividade[]) {
  const groups: { label: string; items: ProjetoAtividade[] }[] = [
    { label: "Hoje", items: [] },
    { label: "Ontem", items: [] },
    { label: "Últimos 7 dias", items: [] },
    { label: "Mais antigos", items: [] },
  ];

  const sevenDaysAgo = subDays(new Date(), 7);

  for (const a of atividades) {
    const date = new Date(a.created_at);
    if (isToday(date)) groups[0].items.push(a);
    else if (isYesterday(date)) groups[1].items.push(a);
    else if (isAfter(date, sevenDaysAgo)) groups[2].items.push(a);
    else groups[3].items.push(a);
  }

  return groups.filter(g => g.items.length > 0);
}

export function ProjetoInboxFeed() {
  const { atividades, isLoading } = useProjetoAtividades();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (atividades.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Inbox className="h-12 w-12 mb-3 opacity-40" />
        <p className="font-medium">Caixa de entrada vazia</p>
        <p className="text-sm">Novas atividades dos seus projetos aparecerão aqui</p>
      </div>
    );
  }

  const groups = groupByTime(atividades);

  return (
    <div>
      {groups.map(group => (
        <div key={group.label}>
          <div className="px-4 py-2 bg-muted/20 border-b border-border/30">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{group.label}</span>
          </div>
          {group.items.map(a => (
            <ProjetoInboxCard key={a.id} atividade={a} />
          ))}
        </div>
      ))}
    </div>
  );
}
