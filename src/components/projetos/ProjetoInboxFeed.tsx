import { ProjetoAtividade } from "@/hooks/useProjetoAtividades";
import { ProjetoInboxCard } from "./ProjetoInboxCard";
import { Inbox, LucideIcon } from "lucide-react";
import { isToday, isYesterday, subDays, isAfter } from "date-fns";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

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

function FeedSkeleton() {
  return (
    <div className="divide-y divide-border/30">
      {/* Group header skeleton */}
      <div className="px-4 py-2 bg-muted/20">
        <Skeleton className="h-3 w-20" />
      </div>
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="flex items-start gap-3 px-4 py-3">
          <Skeleton className="h-4 w-4 rounded mt-1" />
          <Skeleton className="h-2 w-2 rounded-full mt-2" />
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <div className="flex gap-2">
              <Skeleton className="h-3 w-16 rounded-md" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <Skeleton className="h-7 w-7 rounded-full" />
        </div>
      ))}
    </div>
  );
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
  emptyIcon?: LucideIcon;
}

export function ProjetoInboxFeed({
  atividades, isLoading, groupMode, selectedIds, onSelect, onOpenDetail,
  onMarcarLida, onToggleFavorita, onArquivar, showArquivarRestore, emptyTitle, emptyDesc, emptyIcon,
}: Props) {
  if (isLoading) {
    return <FeedSkeleton />;
  }

  if (atividades.length === 0) {
    return (
      <EmptyState
        icon={emptyIcon || Inbox}
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
          {group.items.map((a, idx) => (
            <div
              key={a.id}
              className="animate-fade-in"
              style={{ animationDelay: `${idx * 30}ms` }}
            >
              <ProjetoInboxCard
                atividade={a}
                selected={selectedIds.has(a.id)}
                onSelect={onSelect}
                onOpenDetail={onOpenDetail}
                onMarcarLida={() => onMarcarLida(a.id)}
                onToggleFavorita={() => onToggleFavorita(a.id)}
                onArquivar={() => onArquivar(a.id)}
                showArquivarRestore={showArquivarRestore}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
