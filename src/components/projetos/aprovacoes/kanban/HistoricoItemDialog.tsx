import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowRightLeft,
  UserCog,
  ShieldCheck,
  Undo2,
  Clock,
  History,
  CheckCircle2,
  XCircle,
  Activity,
  MessageSquare,
  Send,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  useItemHistorico,
  useComentarItem,
  type HistoricoEntry,
} from "@/hooks/useItemHistorico";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const ACAO_META: Record<
  string,
  { label: string; icon: typeof History; color: string }
> = {
  movimento: { label: "Movimentação", icon: ArrowRightLeft, color: "text-blue-500" },
  delegacao: { label: "Delegação", icon: UserCog, color: "text-purple-500" },
  oficializacao: { label: "Oficialização", icon: ShieldCheck, color: "text-emerald-500" },
  revogacao_oficializacao: {
    label: "Revogação",
    icon: Undo2,
    color: "text-amber-500",
  },
  prazo: { label: "Prazo", icon: Clock, color: "text-orange-500" },
  aprovacao: { label: "Aprovação", icon: CheckCircle2, color: "text-emerald-500" },
  rejeicao: { label: "Rejeição", icon: XCircle, color: "text-destructive" },
  comentario: { label: "Comentário", icon: MessageSquare, color: "text-sky-500" },
};

const FILTROS = [
  { key: "todos", label: "Todos" },
  { key: "comentario", label: "Comentários" },
  { key: "movimento", label: "Movimentos" },
  { key: "delegacao", label: "Delegações" },
  { key: "oficializacao", label: "Oficializações" },
  { key: "revogacao_oficializacao", label: "Revogações" },
  { key: "prazo", label: "Prazos" },
] as const;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  itemId: string | null;
  itemTitulo?: string;
}

export function HistoricoItemDialog({ open, onOpenChange, itemId, itemTitulo }: Props) {
  const { data, isLoading } = useItemHistorico(open ? itemId : null);
  const comentar = useComentarItem();
  const [filtro, setFiltro] = useState<string>("todos");
  const [busca, setBusca] = useState("");
  const [dataDe, setDataDe] = useState("");
  const [dataAte, setDataAte] = useState("");
  const [novoComentario, setNovoComentario] = useState("");

  const entradas = useMemo(() => {
    let all = data ?? [];
    if (filtro !== "todos") all = all.filter((e) => e.acao === filtro);
    if (busca.trim()) {
      const q = busca.trim().toLowerCase();
      all = all.filter((e) =>
        [
          e.comentario,
          e.user_nome,
          e.etapa_anterior_nome,
          e.etapa_atual_nome,
          e.coluna_origem,
          e.coluna_destino,
          e.acao,
        ]
          .filter(Boolean)
          .some((s) => String(s).toLowerCase().includes(q)),
      );
    }
    if (dataDe) {
      const de = new Date(dataDe + "T00:00:00").getTime();
      all = all.filter((e) => new Date(e.created_at).getTime() >= de);
    }
    if (dataAte) {
      const ate = new Date(dataAte + "T23:59:59").getTime();
      all = all.filter((e) => new Date(e.created_at).getTime() <= ate);
    }
    return all;
  }, [data, filtro, busca, dataDe, dataAte]);

  const limparFiltros = () => {
    setFiltro("todos");
    setBusca("");
    setDataDe("");
    setDataAte("");
  };

  const handleEnviarComentario = async () => {
    if (!itemId || !novoComentario.trim()) return;
    try {
      await comentar.mutateAsync({ itemId, comentario: novoComentario.trim() });
      setNovoComentario("");
      toast.success("Comentário registrado no histórico.");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao registrar comentário.");
    }
  };

  const filtrosAtivos =
    filtro !== "todos" || !!busca || !!dataDe || !!dataAte;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4 text-primary" />
            Histórico do item
          </DialogTitle>
          <DialogDescription className="text-xs">
            {itemTitulo
              ? `Todas as movimentações de "${itemTitulo}"`
              : "Movimentações, delegações, oficializações, revogações e comentários."}
          </DialogDescription>
        </DialogHeader>

        {/* Filtros */}
        <div className="space-y-2 border-b pb-3">
          <div className="flex flex-wrap gap-1.5">
            {FILTROS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFiltro(f.key)}
                className={cn(
                  "text-[10px] px-2 py-0.5 rounded-full border transition",
                  filtro === f.key
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:border-primary/40",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-2 items-end">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar comentário, usuário, etapa…"
                className="h-7 text-xs pl-7"
              />
            </div>
            <div className="space-y-0.5">
              <Label className="text-[10px] text-muted-foreground">De</Label>
              <Input
                type="date"
                value={dataDe}
                onChange={(e) => setDataDe(e.target.value)}
                className="h-7 text-xs w-[140px]"
              />
            </div>
            <div className="space-y-0.5">
              <Label className="text-[10px] text-muted-foreground">Até</Label>
              <Input
                type="date"
                value={dataAte}
                onChange={(e) => setDataAte(e.target.value)}
                className="h-7 text-xs w-[140px]"
              />
            </div>
            {filtrosAtivos && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[10px] px-2"
                onClick={limparFiltros}
              >
                <X className="h-3 w-3 mr-1" /> Limpar
              </Button>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {isLoading ? (
            <p className="text-xs text-muted-foreground py-8 text-center">
              Carregando histórico…
            </p>
          ) : entradas.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center">
              Nenhum evento para os filtros selecionados.
            </p>
          ) : (
            <ol className="relative border-l border-border ml-3 space-y-3 py-2">
              {entradas.map((e) => (
                <TimelineRow key={e.id} entry={e} />
              ))}
            </ol>
          )}
        </ScrollArea>

        {/* Adicionar comentário */}
        {itemId && (
          <div className="border-t pt-3 space-y-2">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5 text-primary" />
              Adicionar comentário
            </Label>
            <Textarea
              value={novoComentario}
              onChange={(e) => setNovoComentario(e.target.value)}
              placeholder="Escreva uma observação que ficará registrada na timeline…"
              className="text-xs min-h-[64px]"
              maxLength={4000}
              disabled={comentar.isPending}
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-muted-foreground">
                {novoComentario.length}/4000
              </span>
              <Button
                size="sm"
                onClick={handleEnviarComentario}
                disabled={comentar.isPending || !novoComentario.trim()}
                className="h-7 text-xs"
              >
                {comentar.isPending ? (
                  <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                ) : (
                  <Send className="h-3 w-3 mr-1.5" />
                )}
                Comentar
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TimelineRow({ entry }: { entry: HistoricoEntry }) {
  const meta = ACAO_META[entry.acao] ?? {
    label: entry.acao,
    icon: Activity,
    color: "text-muted-foreground",
  };
  const Icon = meta.icon;
  const date = new Date(entry.created_at);

  return (
    <li className="ml-4">
      <span
        className={cn(
          "absolute -left-[7px] flex h-3.5 w-3.5 items-center justify-center rounded-full bg-background border border-border",
          meta.color,
        )}
      >
        <Icon className="h-2.5 w-2.5" />
      </span>
      <div className="rounded-md border border-border bg-card p-2.5 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
            {meta.label}
          </Badge>
          {entry.user_nome && (
            <span className="text-xs font-medium">{entry.user_nome}</span>
          )}
          <span className="text-[10px] text-muted-foreground ml-auto">
            {format(date, "dd/MM/yyyy HH:mm", { locale: ptBR })}
          </span>
        </div>

        <DetalheEvento entry={entry} />

        {entry.comentario && (
          <p
            className={cn(
              "text-[11px] border-l-2 border-border pl-2",
              entry.acao === "comentario"
                ? "text-foreground whitespace-pre-wrap"
                : "text-muted-foreground italic",
            )}
          >
            {entry.acao === "comentario" ? entry.comentario : `"${entry.comentario}"`}
          </p>
        )}
      </div>
    </li>
  );
}

function DetalheEvento({ entry }: { entry: HistoricoEntry }) {
  if (entry.acao === "movimento") {
    const ant = entry.etapa_anterior_nome || entry.coluna_origem || "—";
    const nov = entry.etapa_atual_nome || entry.coluna_destino || "—";
    return (
      <p className="text-[11px] text-muted-foreground">
        <span className="font-medium text-foreground/70">{ant}</span>
        <span className="mx-1">→</span>
        <span className="font-medium text-foreground/70">{nov}</span>
      </p>
    );
  }
  if (entry.acao === "delegacao") {
    return (
      <p className="text-[11px] text-muted-foreground">
        Item transferido para outro responsável.
      </p>
    );
  }
  if (entry.acao === "oficializacao") {
    const destino =
      entry.metadata?.destino === "produto"
        ? "Cofre do Produto"
        : entry.metadata?.destino === "generico"
          ? "Cofre Genérico"
          : "Cofre";
    return (
      <p className="text-[11px] text-muted-foreground">
        Documento oficializado em <span className="font-medium">{destino}</span>.
      </p>
    );
  }
  if (entry.acao === "revogacao_oficializacao") {
    return (
      <p className="text-[11px] text-muted-foreground">
        Oficialização revogada{entry.metadata?.motivo ? `: ${entry.metadata.motivo}` : "."}
      </p>
    );
  }
  if (entry.acao === "prazo") {
    const ant = entry.metadata?.prazo_anterior
      ? format(new Date(entry.metadata.prazo_anterior), "dd/MM/yyyy HH:mm", { locale: ptBR })
      : "sem prazo";
    const nov = entry.metadata?.prazo_novo
      ? format(new Date(entry.metadata.prazo_novo), "dd/MM/yyyy HH:mm", { locale: ptBR })
      : "sem prazo";
    return (
      <p className="text-[11px] text-muted-foreground">
        Prazo: <span className="font-medium">{ant}</span>
        <span className="mx-1">→</span>
        <span className="font-medium">{nov}</span>
      </p>
    );
  }
  return null;
}
