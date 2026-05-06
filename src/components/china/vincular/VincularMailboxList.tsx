import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Star, Paperclip, Clock, AlertTriangle, Link2, Link2Off, Package,
  CheckCircle2, FileText, Send, XCircle, Loader2, Globe, Maximize2,
  MousePointerClick, Zap, MoveVertical, X,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

  // Auto-scroll: mantém o item selecionado visível (j/k, clique, busca/filtros).
  // Aplica offset para não encostar na toolbar fixa do topo nem no rodapé.
  const SCROLL_OFFSET_TOP = 48;
  const SCROLL_OFFSET_BOTTOM = 16;
  const listRef = useRef<HTMLUListElement>(null);
  const itemRefs = useRef<Map<string, HTMLLIElement>>(new Map());

  // Preserva o item selecionado mesmo quando ele sai da lista filtrada.
  // `lastSelectedSnapshot` guarda a última versão conhecida do item selecionado
  // a partir da lista completa, para podermos exibir um banner persistente.
  const lastSelectedSnapshotRef = useRef<MailboxRow | null>(null);
  const fullSelected = useMemo(
    () => (selectedId ? items.find((i) => i.id === selectedId) ?? null : null),
    [items, selectedId],
  );
  useEffect(() => {
    if (fullSelected) lastSelectedSnapshotRef.current = fullSelected;
  }, [fullSelected]);
  const pinnedItem: MailboxRow | null =
    fullSelected ?? (selectedId ? lastSelectedSnapshotRef.current : null);
  const selectedStillVisible = !!selectedId && filtered.some((i) => i.id === selectedId);
  const selectedHiddenByFilter = !!selectedId && !selectedStillVisible && !!pinnedItem;

  // Comportamento de rolagem ao navegar com j/k (configurável pelo usuário).
  type ScrollPref = "smooth" | "auto" | "none";
  const SCROLL_PREF_KEY = "china:vincular:list:scrollBehavior";
  const [scrollPref, setScrollPref] = useState<ScrollPref>(() => {
    if (typeof window === "undefined") return "smooth";
    const v = window.localStorage.getItem(SCROLL_PREF_KEY) as ScrollPref | null;
    return v === "smooth" || v === "auto" || v === "none" ? v : "smooth";
  });
  const updateScrollPref = useCallback((v: ScrollPref) => {
    setScrollPref(v);
    try { window.localStorage.setItem(SCROLL_PREF_KEY, v); } catch { /* noop */ }
  }, []);

  const scrollSelectedIntoView = useCallback((forceBehavior?: ScrollBehavior) => {
    if (!selectedId) return;
    const list = listRef.current;
    const el = itemRefs.current.get(selectedId);
    if (!list || !el) return;
    const listRect = list.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const topGap = elRect.top - listRect.top;
    const bottomGap = listRect.bottom - elRect.bottom;
    const behavior: ScrollBehavior =
      forceBehavior ?? (scrollPref === "auto" ? "auto" : "smooth");
    if (topGap < SCROLL_OFFSET_TOP) {
      list.scrollBy({ top: topGap - SCROLL_OFFSET_TOP, behavior });
    } else if (bottomGap < SCROLL_OFFSET_BOTTOM) {
      list.scrollBy({ top: SCROLL_OFFSET_BOTTOM - bottomGap, behavior });
    }
  }, [selectedId, scrollPref]);

  useEffect(() => {
    if (!selectedId || !selectedStillVisible) return;
    if (scrollPref === "none") return;
    scrollSelectedIntoView();
  }, [selectedId, selectedStillVisible, filtered.length, search, scrollPref, scrollSelectedIntoView]);

  // Atalhos: Esc limpa busca quando o item selecionado está escondido pelo filtro;
  // "/" foca o campo de busca (ou limpa, se já estiver com algo digitado e item escondido).
  const searchInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const inField =
        tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable;

      if (e.key === "Escape" && selectedHiddenByFilter) {
        e.preventDefault();
        onSearchChange("");
        return;
      }
      if (e.key === "/" && !inField) {
        e.preventDefault();
        if (selectedHiddenByFilter && search) {
          onSearchChange("");
        } else {
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedHiddenByFilter, search, onSearchChange]);


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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-1.5 text-[11px] gap-1 text-muted-foreground"
              title="Comportamento de rolagem ao navegar com j/k"
            >
              {scrollPref === "smooth" && <MoveVertical className="h-3 w-3" />}
              {scrollPref === "auto" && <Zap className="h-3 w-3" />}
              {scrollPref === "none" && <MousePointerClick className="h-3 w-3" />}
              <span className="hidden sm:inline">
                {scrollPref === "smooth" ? "Suave" : scrollPref === "auto" ? "Instantâneo" : "Sem rolar"}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-[11px]">Rolagem ao navegar (j/k)</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => updateScrollPref("smooth")} className="text-xs gap-2">
              <MoveVertical className="h-3.5 w-3.5" /> Suave (padrão)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => updateScrollPref("auto")} className="text-xs gap-2">
              <Zap className="h-3.5 w-3.5" /> Instantâneo
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => updateScrollPref("none")} className="text-xs gap-2">
              <MousePointerClick className="h-3.5 w-3.5" /> Desativada
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Aviso quando o item selecionado foi escondido por filtros/busca */}
      {selectedHiddenByFilter && pinnedItem && (
        <div className="flex items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-300">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          <span className="truncate">
            Item selecionado fora do filtro:{" "}
            <span className="font-mono font-semibold">{pinnedItem.produto_codigo}</span>{" "}
            <span className="text-amber-200/80">{pinnedItem.produto_nome}</span>
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto h-5 px-1.5 text-[10px] text-amber-200 hover:text-amber-100"
            onClick={() => onSearchChange("")}
          >
            Limpar busca
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-5 w-5 p-0 text-amber-200 hover:text-amber-100"
            onClick={() => onSelect("")}
            title="Desmarcar"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* List */}
      <ul ref={listRef} className="flex-1 overflow-y-auto scroll-pt-12" role="list">
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
