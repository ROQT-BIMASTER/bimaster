import { useChinaTimeline } from "@/hooks/useChinaProjeto";
import { BilingualLabel } from "./BilingualLabel";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Ship, Briefcase, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  china: { icon: <Ship className="h-3 w-3" />, color: "bg-warning/20 text-warning", label: "China" },
  projeto: { icon: <Briefcase className="h-3 w-3" />, color: "bg-primary/20 text-primary", label: "Brasil" },
  documento: { icon: <FileText className="h-3 w-3" />, color: "bg-secondary text-secondary-foreground", label: "Doc" },
};

interface ChinaTimelineProps {
  submissaoId: string;
}

export function ChinaTimeline({ submissaoId }: ChinaTimelineProps) {
  const { data: entries = [], isLoading } = useChinaTimeline(submissaoId);

  if (isLoading) {
    return (
      <Card className="p-6">
        <BilingualLabel pt="Histórico" cn="历史" size="md" />
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </Card>
    );
  }

  if (entries.length === 0) {
    return (
      <Card className="p-6">
        <BilingualLabel pt="Histórico" cn="历史" size="md" />
        <p className="text-xs text-muted-foreground py-4 text-center">Nenhum evento registrado. 暂无事件记录。</p>
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-3">
      <BilingualLabel pt="Histórico Unificado" cn="统一历史" size="md" />

      <ScrollArea style={{ maxHeight: "400px" }}>
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />

          <div className="space-y-3">
            {entries.map((entry) => {
              const config = TYPE_CONFIG[entry.type] || TYPE_CONFIG.documento;
              return (
                <div key={entry.id} className="flex items-start gap-3 relative">
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10",
                    config.color
                  )}>
                    {config.icon}
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-foreground">{entry.description}</span>
                      <Badge variant="ghost" className="text-[9px] px-1">{config.label}</Badge>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(entry.timestamp), { locale: ptBR, addSuffix: true })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </ScrollArea>
    </Card>
  );
}
