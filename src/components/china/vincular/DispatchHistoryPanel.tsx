import { useDispatchHistory, type ProcessEventRow, type DispatchFlushInfo } from "@/hooks/useDispatchHistory";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link as RouterLink } from "react-router-dom";
import {
  ArrowRightCircle, UserCircle2, Folder, ListChecks, Gavel, History, ExternalLink,
  RefreshCw, AlertTriangle, ArrowUpDown, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  submissaoId: string | null;
  className?: string;
}

const TYPE_META: Record<string, { label: string; icon: JSX.Element; tone: string }> = {
  encaminhamento_projeto: {
    label: "Encaminhado a projeto",
    icon: <Folder className="h-3.5 w-3.5" />,
    tone: "text-primary",
  },
  encaminhamento_responsavel: {
    label: "Encaminhado a responsável",
    icon: <UserCircle2 className="h-3.5 w-3.5" />,
    tone: "text-primary",
  },
  despacho_criado: {
    label: "Despacho aberto",
    icon: <Gavel className="h-3.5 w-3.5" />,
    tone: "text-warning",
  },
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit", month: "2-digit", year: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

function EventCard({ ev, highlighted }: { ev: ProcessEventRow; highlighted?: boolean }) {
  const meta = TYPE_META[ev.tipo_evento] ?? {
    label: ev.tipo_evento.replace(/_/g, " "),
    icon: <ArrowRightCircle className="h-3.5 w-3.5" />,
    tone: "text-muted-foreground",
  };
  const md = ev.metadata ?? {};
  const projetoId = md.projeto_id as string | undefined;
  const tarefaId = md.tarefa_id as string | undefined;
  const projetoNome = md.projeto_nome as string | undefined;
  const tarefaTitulo = md.tarefa_titulo as string | undefined;
  const observacao = (md.observacao as string | undefined) || null;

  const targetUrl = tarefaId && projetoId
    ? `/dashboard/projetos/${projetoId}?tarefa=${tarefaId}`
    : projetoId
      ? `/dashboard/projetos/${projetoId}`
      : null;

  return (
    <li
      className={cn(
        "rounded-md border px-2.5 py-2 transition-colors duration-700",
        highlighted
          ? "border-primary/60 bg-primary/10 ring-1 ring-primary/40 animate-in fade-in slide-in-from-top-1"
          : "border-border bg-card/40",
      )}
    >
      <div className="flex items-center gap-1.5 text-[11px]">
        <span className={cn("flex h-5 w-5 items-center justify-center rounded-full bg-muted", meta.tone)}>
          {meta.icon}
        </span>
        <span className="font-medium text-foreground">{meta.label}</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">{formatDate(ev.created_at)}</span>
        {ev.usuario_nome && (
          <>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground truncate">{ev.usuario_nome}</span>
          </>
        )}
        {highlighted && (
          <Badge variant="outline" className="ml-auto h-4 border-primary/40 px-1.5 text-[9px] text-primary">
            Novo
          </Badge>
        )}
      </div>

      {(projetoNome || tarefaTitulo) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
          {projetoNome && (
            <Badge variant="secondary" className="h-4 gap-1 px-1.5 text-[10px]">
              <Folder className="h-3 w-3" />{projetoNome}
            </Badge>
          )}
          {tarefaTitulo && (
            <Badge variant="outline" className="h-4 gap-1 px-1.5 text-[10px]">
              <ListChecks className="h-3 w-3" />{tarefaTitulo}
            </Badge>
          )}
        </div>
      )}

      {observacao && (
        <p className="mt-1.5 whitespace-pre-wrap text-[11px] leading-snug text-muted-foreground">
          {observacao}
        </p>
      )}

      {targetUrl && (
        <RouterLink
          to={targetUrl}
          className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-medium text-primary hover:underline"
        >
          Abrir destino <ExternalLink className="h-2.5 w-2.5" />
        </RouterLink>
      )}
    </li>
  );
}

export function DispatchHistoryPanel({ submissaoId, className }: Props) {
  const {
    data, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage,
    pendingCount, droppedCount, lastFlush, flushPending, clearLastFlush, bufferMax,
  } = useDispatchHistory(submissaoId) as ReturnType<typeof useDispatchHistory> & {
    pendingCount: number; droppedCount: number; lastFlush: DispatchFlushInfo | null;
    flushPending: () => void; clearLastFlush: () => void; bufferMax: number;
  };
  const events = (data?.pages ?? []).flatMap((p) => p.rows);
  const highlightSet = new Set(lastFlush?.insertedIds ?? []);
  const bufferFull = pendingCount >= bufferMax;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        <History className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Histórico de despacho
        </span>
        {events.length > 0 && (
          <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
            {events.length}{hasNextPage ? "+" : ""}
          </Badge>
        )}
        {pendingCount > 0 && (
          <button
            type="button"
            onClick={flushPending}
            className={cn(
              "ml-auto inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors",
              bufferFull
                ? "border-warning/40 bg-warning/15 text-warning hover:bg-warning/25"
                : "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20",
            )}
            title={bufferFull
              ? `Buffer cheio (limite ${bufferMax}). Eventos mais antigos serão descartados.`
              : "Novos eventos chegaram em tempo real"}
          >
            <RefreshCw className="h-2.5 w-2.5" />
            {pendingCount}{bufferFull ? "+" : ""} {pendingCount === 1 ? "novo evento" : "novos eventos"} · Atualizar
          </button>
        )}
      </div>

      {droppedCount > 0 && (
        <div className="flex items-center gap-1.5 rounded-md border border-warning/30 bg-warning/10 px-2 py-1 text-[10px] text-warning">
          <AlertTriangle className="h-3 w-3" />
          <span>
            {droppedCount} {droppedCount === 1 ? "evento foi descartado" : "eventos foram descartados"} do buffer (limite {bufferMax}). Recarregue para ver tudo.
          </span>
        </div>
      )}

      {lastFlush?.reordered && (
        <div className="flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] text-primary">
          <ArrowUpDown className="h-3 w-3" />
          <span className="flex-1">
            A ordenação por data/ID foi ajustada após o flush. Confira os itens destacados.
          </span>
          <button
            type="button"
            onClick={clearLastFlush}
            className="rounded p-0.5 hover:bg-primary/20"
            aria-label="Dispensar aviso de reordenação"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-1.5">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : events.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-2.5 py-3 text-center text-[11px] text-muted-foreground">
          Nenhum encaminhamento registrado ainda.
        </p>
      ) : (
        <>
          <ul className="space-y-1.5">
            {events.map((ev) => (
              <EventCard key={ev.id} ev={ev} highlighted={highlightSet.has(ev.id)} />
            ))}
          </ul>
          {hasNextPage && (
            <button
              type="button"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="w-full rounded-md border border-border bg-card/40 px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/40 disabled:opacity-60"
            >
              {isFetchingNextPage ? "Carregando..." : "Carregar mais"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
