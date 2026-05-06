import { useEffect, useMemo, useRef } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Star, Paperclip, Clock, AlertTriangle, Link2, Link2Off, Package,
  CheckCircle2, FileText, Send, XCircle, Loader2, Globe, Maximize2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { MailboxRow, VincularFolder } from "@/hooks/useVincularChinaMailboxData";
import { VincularChinaRowAction } from "@/components/china/VincularChinaRowAction";

interface Props {
  items: MailboxRow[];
  folder: VincularFolder;
  selectedId: string | null;
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
  onFocus: (item: MailboxRow) => void;
  onToggleCheck: (id: string) => void;
  onToggleAllChecks: () => void;
  onToggleStar: (item: MailboxRow) => void;
  onLinkRow: (row: MailboxRow, projetoId: string) => void;
  projetos: Array<{ id: string; nome: string; cor?: string }>;
  search: string;
  onSearchChange: (v: string) => void;
  onBulkLink?: () => void;
  onBulkExport?: () => void;
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; icon: typeof Clock; cls: string }> = {
    rascunho: { label: "Rascunho", icon: FileText, cls: "bg-muted/40 text-muted-foreground border-border" },
    enviado: { label: "Enviado", icon: Send, cls: "bg-primary/15 text-primary border-primary/30" },
    em_revisao: { label: "Em revisão", icon: Loader2, cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
    aprovado: { label: "Aprovado", icon: CheckCircle2, cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
    enviado_brasil: { label: "Recebido da China", icon: Globe, cls: "bg-sky-500/15 text-sky-400 border-sky-500/30" },
    arte_enviada: { label: "Docs enviados", icon: Paperclip, cls: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
    rejeitado: { label: "Rejeitado", icon: XCircle, cls: "bg-rose-500/15 text-rose-400 border-rose-500/30" },
  };
  return map[status] || { label: status, icon: Clock, cls: "bg-muted text-muted-foreground border-border" };
}

function relativeAge(dateStr?: string) {
  if (!dateStr) return "—";
  try {
    return formatDistanceToNow(new Date(dateStr), { locale: ptBR, addSuffix: false });
  } catch {
    return "—";
  }
}

export function VincularMailboxList({
  items, folder, selectedId, selectedIds,
  onSelect, onFocus, onToggleCheck, onToggleAllChecks, onToggleStar, onLinkRow,
  projetos, search, onSearchChange, onBulkLink, onBulkExport,
}: Props) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => {
      const blob = `${i.produto_codigo} ${i.produto_nome} ${i.numero_ordem ?? ""} ${i.projetoNome ?? ""} ${i.observacoes_brasil ?? ""} ${i.observacoes_china ?? ""}`.toLowerCase();
      return blob.includes(q);
    });
  }, [items, search]);

  const allChecked = filtered.length > 0 && filtered.every((i) => selectedIds.has(i.id));
  const someChecked = selectedIds.size > 0;

  // Auto-scroll: mantém o item selecionado (j/k ou clique) visível na lista.
  const itemRefs = useRef<Map<string, HTMLLIElement>>(new Map());
  useEffect(() => {
    if (!selectedId) return;
    const el = itemRefs.current.get(selectedId);
    if (!el) return;
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedId]);

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Toolbar — alinhada à Caixa de Entrada */}
      <div className="flex items-center gap-2 border-b border-border bg-card/30 px-3 py-1.5">
        <Checkbox
          checked={allChecked}
          onCheckedChange={onToggleAllChecks}
          aria-label="Selecionar todos"
        />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar código, nome, OC, projeto..."
          className="h-7 text-xs flex-1 max-w-md"
        />
        {someChecked ? (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">{selectedIds.size} selecionados</span>
            {onBulkLink && (
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onBulkLink}>
                <Link2 className="h-3 w-3" /> Vincular
              </Button>
            )}
            {onBulkExport && (
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onBulkExport}>
                Exportar
              </Button>
            )}
          </div>
        ) : (
          <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
            {filtered.length} item{filtered.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {/* List */}
      <ul className="flex-1 overflow-y-auto" role="list">
        {filtered.length === 0 && (
          <li className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma submissão nesta pasta
          </li>
        )}
        {filtered.map((item) => {
          const checked = selectedIds.has(item.id);
          const active = selectedId === item.id;
          const sb = statusBadge(item.status);
          const SbIcon = sb.icon;
          const unread = !item.isLinked && folder !== "vinculadas";
          const dt = item.updated_at || item.created_at;
          return (
            <li
              key={item.id}
              ref={(el) => {
                if (el) itemRefs.current.set(item.id, el);
                else itemRefs.current.delete(item.id);
              }}
              onClick={() => onSelect(item.id)}
              className={cn(
                "group flex cursor-pointer items-start gap-2 border-b border-border/40 px-3 py-2 text-sm transition-colors",
                active ? "bg-primary/10" : "hover:bg-muted/30",
                unread && !active && "bg-card",
              )}
            >
              <div className="flex flex-col items-center pt-0.5">
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => onToggleCheck(item.id)}
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Selecionar"
                />
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleStar(item);
                }}
                className={cn(
                  "mt-0.5 transition-colors",
                  item.is_flagged ? "text-amber-400" : "text-muted-foreground/40 hover:text-amber-300",
                )}
                aria-label={item.is_flagged ? "Desmarcar estrela" : "Marcar com estrela"}
              >
                <Star className="h-3.5 w-3.5" fill={item.is_flagged ? "currentColor" : "none"} />
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[11px] font-semibold text-primary">
                    {item.produto_codigo}
                  </span>
                  <span
                    className={cn(
                      "truncate text-[13px]",
                      unread ? "font-semibold text-foreground" : "font-medium text-foreground/90",
                    )}
                  >
                    {item.produto_nome}
                  </span>
                  {item.numero_ordem && (
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      OC {item.numero_ordem}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 truncate text-[11.5px] text-muted-foreground">
                  {item.isLinked && item.projetoNome ? (
                    <span className="flex items-center gap-1.5 truncate">
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: item.projetoCor || "hsl(var(--primary))" }}
                      />
                      <span className="truncate">Encaminhado para {item.projetoNome}</span>
                      {(item.tarefasVinculadas ?? 0) > 0 && (
                        <span>· {item.tarefasVinculadas} tarefa{item.tarefasVinculadas === 1 ? "" : "s"}</span>
                      )}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 italic text-amber-400/80">
                      <Link2Off className="h-3 w-3" /> A encaminhar
                    </span>
                  )}
                  {(item.docCount ?? 0) > 0 && (
                    <span className="flex items-center gap-0.5">
                      <Paperclip className="h-3 w-3" /> {item.docCount}
                    </span>
                  )}
                  {(item.pendencias ?? 0) > 0 && (
                    <Badge variant="outline" className="h-3.5 px-1 text-[9px] gap-0.5 bg-rose-500/10 text-rose-400 border-rose-500/30">
                      {item.pendencias} pend.
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1">
                <Badge variant="outline" className={cn("h-4 px-1.5 text-[9.5px] gap-0.5 font-medium", sb.cls)}>
                  <SbIcon className="h-2.5 w-2.5" />
                  {sb.label}
                </Badge>
                {item.snooze_until && (
                  <Badge variant="outline" className="h-4 px-1.5 text-[9.5px] gap-0.5 bg-sky-500/15 text-sky-400 border-sky-500/30">
                    <Clock className="h-2.5 w-2.5" /> adiada
                  </Badge>
                )}
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  {relativeAge(dt)}
                </span>
              </div>

              <div
                className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                onClick={(e) => e.stopPropagation()}
              >
                <VincularChinaRowAction
                  rowId={item.id}
                  rowNome={item.produto_nome}
                  isLinked={!!item.isLinked}
                  projetos={projetos}
                  onLink={(pid) => onLinkRow(item, pid)}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={() => onFocus(item)}
                  title="Abrir em modo foco"
                >
                  <Maximize2 className="h-3 w-3" />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
