import { useMemo, useState } from "react";
import { useChinaUnifiedTimeline } from "@/hooks/useChinaUnifiedTimeline";
import type { ChinaTimelineScope } from "@/lib/china/timeline/types";
import { kindConfig } from "@/lib/china/timeline/kinds";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Search } from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Props {
  scope: ChinaTimelineScope;
}

const GROUP_LABELS: Record<string, string> = {
  submissao: "Submissão",
  documento: "Documentos",
  governanca: "Governança",
  oc: "Ordem de Compra",
  producao: "Produção",
  embarque: "Embarque",
  recebimento: "Recebimento",
  nc: "Não Conformidade",
  chat: "Chat",
};

function bucketLabel(d: Date): string {
  if (isToday(d)) return "Hoje";
  if (isYesterday(d)) return "Ontem";
  return format(d, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
}

export function ChinaUnifiedTimelineEventsBody({ scope }: Props) {
  const { data: events = [], isLoading } = useChinaUnifiedTimeline(scope);
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((e) => {
      const cfg = kindConfig(e.kind);
      if (groupFilter && cfg.group !== groupFilter) return false;
      if (!q) return true;
      const hay = `${e.title} ${e.descricao || ""} ${cfg.label}`.toLowerCase();
      return hay.includes(q);
    });
  }, [events, query, groupFilter]);

  const buckets = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const e of filtered) {
      const key = bucketLabel(new Date(e.timestamp));
      const arr = map.get(key) || [];
      arr.push(e);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const groups = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) set.add(kindConfig(e.kind).group);
    return Array.from(set);
  }, [events]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pb-2 space-y-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar evento..."
            className="h-8 pl-7 text-xs"
          />
        </div>
        {groups.length > 1 && (
          <div className="flex flex-wrap gap-1">
            <Badge
              variant={groupFilter === null ? "default" : "outline"}
              className="cursor-pointer text-[10px]"
              onClick={() => setGroupFilter(null)}
            >
              Todos
            </Badge>
            {groups.map((g) => (
              <Badge
                key={g}
                variant={groupFilter === g ? "default" : "outline"}
                className="cursor-pointer text-[10px]"
                onClick={() => setGroupFilter(groupFilter === g ? null : g)}
              >
                {GROUP_LABELS[g] || g}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <ScrollArea className="flex-1 px-4 pb-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : buckets.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-12">
            Nenhum evento encontrado.
          </p>
        ) : (
          <div className="space-y-4">
            {buckets.map(([day, items]) => (
              <div key={day}>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  {day}
                </div>
                <ol className="relative border-l border-border pl-4 space-y-2.5">
                  {items.map((e) => {
                    const cfg = kindConfig(e.kind);
                    const Icon = cfg.icon;
                    return (
                      <li key={e.id} className="relative">
                        <span
                          className={cn(
                            "absolute -left-[22px] top-0.5 w-4 h-4 rounded-full flex items-center justify-center",
                            cfg.tint,
                          )}
                        >
                          <Icon className="h-2.5 w-2.5" />
                        </span>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-medium text-foreground">
                                {e.title}
                              </span>
                              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                                {cfg.label}
                              </Badge>
                            </div>
                            {e.descricao && (
                              <p className="text-[11px] text-muted-foreground mt-0.5 break-words">
                                {e.descricao}
                              </p>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {format(new Date(e.timestamp), "HH:mm")}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
