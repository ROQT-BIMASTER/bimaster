import { useChinaUnifiedTimeline } from "@/hooks/useChinaUnifiedTimeline";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Activity, FileText, Send, CheckCircle2, XCircle, Gavel,
  Ship, Package, AlertTriangle, MessageSquare, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { ChinaTimelineEvent } from "@/lib/china/timeline/types";

interface Props {
  submissaoId: string;
}

const KIND_ICON: Record<string, typeof Activity> = {
  submissao_criada: Sparkles,
  submissao_status: Activity,
  documento_anexado: FileText,
  documento_status: FileText,
  parecer_china: MessageSquare,
  waiver_aplicado: CheckCircle2,
  liberada_para_oc: Send,
  oc_emitida: Gavel,
  oc_status: Gavel,
  op_criada: Package,
  apontamento_producao: Package,
  pronto_embarque: Ship,
  embarque_criado: Ship,
  embarque_status: Ship,
  container_evento: Ship,
  recebimento_iniciado: Package,
  recebimento_status: Package,
  nc_aberta: AlertTriangle,
  nc_status: AlertTriangle,
  chat_mensagem: MessageSquare,
};

const ACTOR_LABEL: Record<string, string> = {
  china: "China",
  brasil: "Brasil",
  sistema: "Sistema",
};

const ACTOR_TONE: Record<string, string> = {
  china: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  brasil: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  sistema: "border-muted-foreground/30 bg-muted text-muted-foreground",
};

function EventItem({ ev, isLast }: { ev: ChinaTimelineEvent; isLast: boolean }) {
  const Icon = KIND_ICON[ev.kind] ?? Activity;
  const ts = ev.timestamp ? new Date(ev.timestamp) : null;
  return (
    <li className="relative flex gap-3 pb-4">
      {!isLast && (
        <span
          aria-hidden
          className="absolute left-[14px] top-7 h-[calc(100%-1.25rem)] w-px bg-border"
        />
      )}
      <div className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-card">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="text-xs font-medium text-foreground truncate">{ev.title}</p>
          <Badge
            variant="outline"
            className={cn("text-[9px] h-4 px-1.5 border", ACTOR_TONE[ev.actor] ?? ACTOR_TONE.sistema)}
          >
            {ev.actorLabel || ACTOR_LABEL[ev.actor] || "Sistema"}
          </Badge>
        </div>
        {ev.descricao && (
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{ev.descricao}</p>
        )}
        {ts && (
          <p className="mt-0.5 text-[10px] text-muted-foreground/80">
            {format(ts, "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        )}
      </div>
    </li>
  );
}

export function VincularReadingTimeline({ submissaoId }: Props) {
  const { data: events = [], isLoading, error } = useChinaUnifiedTimeline({ submissaoId });

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="px-4 py-6 text-xs text-destructive">
        Não foi possível carregar a timeline.
      </p>
    );
  }

  if (events.length === 0) {
    return (
      <div className="px-4 py-8 text-center">
        <Activity className="mx-auto mb-2 h-6 w-6 text-muted-foreground/60" />
        <p className="text-xs text-muted-foreground">
          Sem eventos registrados ainda. Toda nova ação aparecerá aqui automaticamente.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <ol className="px-4 py-3">
        {events.map((ev, idx) => (
          <EventItem key={ev.id} ev={ev} isLast={idx === events.length - 1} />
        ))}
      </ol>
    </ScrollArea>
  );
}
