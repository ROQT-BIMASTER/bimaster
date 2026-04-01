import { ProjetoAtividade } from "@/hooks/useProjetoAtividades";
import { ProjetoInboxCard } from "./ProjetoInboxCard";
import { Loader2, Inbox } from "lucide-react";
import { isToday, isYesterday, subDays, isAfter } from "date-fns";
import { EmptyState } from "@/components/ui/empty-state";

type GroupMode = "tempo" | "projeto";

function groupByTime(atividades: ProjetoAtividade[]) {
  const groups: { label: string; items: ProjetoAtividade[]; color?: string }[] = [
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

function groupByProjeto(atividades: ProjetoAtividade[]) {
  const map = new Map<string, { label: string; items: ProjetoAtividade[]; color: string }>();
  for (const a of atividades) {
    if (!map.has(a.projeto_id)) {
      map.set(a.projeto_id, { label: a.projeto_nome || "Projeto", items: [], color: a.projeto_cor || "#6366f1" });
    }
    map.get(a.projeto_id)!.items.push(a);
  }
  return Array.from(map.values());
}

interface Props {
  atividades: ProjetoAtividade[];
  isLoading: boolean;
  groupMode: GroupMode;
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
  onOpenDetail: (a: ProjetoAtividade) => void;
  onMarcarLida: (id: string) => void;
  onToggleFavorita: (id: string) => void;
  onArquivar: (id: string) => void;
  showArquivarRestore?: boolean;
  emptyTitle?: string;
  emptyDesc?: string;
}

export function ProjetoInboxFeed({
  atividades, isLoading, groupMode, selectedIds, onSelect, onOpenDetail,
  onMarcarLida, onToggleFavorita, onArquivar, showArquivarRestore, emptyTitle, emptyDesc,
}: Props) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (atividades.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title={emptyTitle || "Caixa de entrada vazia"}
        description={emptyDesc || "Novas atividades dos seus projetos aparecerão aqui"}
        className="py-20"
      />
    );
  }

  const groups = groupMode === "projeto" ? groupByProjeto(atividades) : groupByTime(atividades);

  return (
    <div>
      {groups.map(group => (
        <div key={group.label}>
          <div className="px-4 py-2 bg-muted/20 border-b border-border/30 flex items-center gap-2">
            {group.color && groupMode === "projeto" && (
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: group.color }} />
            )}
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{group.label}</span>
            <span className="text-[10px] text-muted-foreground/60 font-medium">{group.items.length}</span>
          </div>
          {group.items.map(a => (
            <ProjetoInboxCard
              key={a.id}
              atividade={a}
              selected={selectedIds.has(a.id)}
              onSelect={onSelect}
              onOpenDetail={onOpenDetail}
              onMarcarLida={() => onMarcarLida(a.id)}
              onToggleFavorita={() => onToggleFavorita(a.id)}
              onArquivar={() => onArquivar(a.id)}
              showArquivarRestore={showArquivarRestore}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
