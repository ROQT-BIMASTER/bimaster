import { useDispatchHistory, type ProcessEventRow } from "@/hooks/useDispatchHistory";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link as RouterLink } from "react-router-dom";
import {
  ArrowRightCircle, UserCircle2, Folder, ListChecks, Gavel, History, ExternalLink,
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

function EventCard({ ev }: { ev: ProcessEventRow }) {
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
    <li className="rounded-md border border-border bg-card/40 px-2.5 py-2">
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
  } = useDispatchHistory(submissaoId);
  const events = (data?.pages ?? []).flatMap((p) => p.rows);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-1.5">
        <History className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Histórico de despacho
        </span>
        {events.length > 0 && (
          <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
            {events.length}{hasNextPage ? "+" : ""}
          </Badge>
        )}
      </div>

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
            {events.map((ev) => <EventCard key={ev.id} ev={ev} />)}
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
