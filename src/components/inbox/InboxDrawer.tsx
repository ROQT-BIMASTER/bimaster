import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useInboxDrawer } from "@/contexts/InboxDrawerContext";
import { useInbox, type InboxCaixa, type InboxOrigem, type InboxItem } from "@/hooks/useInbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Inbox, Send, Eye, UserCheck, Search, Archive, Clock, Star,
  CheckCheck, ExternalLink, FolderKanban, Workflow, Palette,
  Globe2, ShieldCheck, FlaskConical, Package, Layers
} from "lucide-react";
import { useMemo, useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { useInboxScope, type InboxScope } from "@/hooks/useInboxScope";
import { useScreenPermissions } from "@/hooks/useScreenPermissions";
import { useInboxScopeAudit } from "@/hooks/useInboxScopeAudit";
import { getRichPreview, GenericPreview, type PreviewHandle } from "@/components/inbox/preview/previewRegistry";

// Origens visíveis por escopo. "produto" e "hibrido" veem todas;
// "generico" vê apenas Projetos (+ Aprovações se permitido).
const SCOPE_ORIGENS: Record<InboxScope, InboxOrigem[]> = {
  produto: ["projetos", "processos", "motor_artes", "china", "aprovacoes", "composicao", "embalagens", "amostras"],
  hibrido: ["projetos", "processos", "motor_artes", "china", "aprovacoes", "composicao", "embalagens", "amostras"],
  generico: ["projetos"],
};

const SCOPE_BADGE: Record<InboxScope, string> = {
  produto: "PMO Produto",
  generico: "Equipe",
  hibrido: "Tudo",
};

const CAIXAS: { key: InboxCaixa; label: string; icon: any; help: string }[] = [
  { key: "acao_minha", label: "Ação minha", icon: Inbox, help: "Itens que dependem de você" },
  { key: "atribuida_a_mim", label: "Atribuídas", icon: UserCheck, help: "Tarefas onde você é o responsável" },
  { key: "acompanho", label: "Acompanho", icon: Eye, help: "Você é observador/CC" },
  { key: "delegada_por_mim", label: "Delegadas", icon: Send, help: "Você delegou para outras pessoas" },
];

const ORIGEM_META: Record<InboxOrigem, { label: string; icon: any; color: string }> = {
  projetos:    { label: "Projetos",    icon: FolderKanban, color: "hsl(var(--primary))" },
  processos:   { label: "Processos",   icon: Workflow,     color: "hsl(217 91% 60%)" },
  motor_artes: { label: "Motor Artes", icon: Palette,      color: "hsl(280 80% 60%)" },
  china:       { label: "China",       icon: Globe2,       color: "hsl(0 78% 55%)" },
  aprovacoes:  { label: "Aprovações",  icon: ShieldCheck,  color: "hsl(142 70% 45%)" },
  composicao:  { label: "Composição",  icon: FlaskConical, color: "hsl(190 80% 50%)" },
  embalagens:  { label: "Embalagens",  icon: Package,      color: "hsl(35 90% 55%)" },
  amostras:    { label: "Amostras",    icon: Layers,       color: "hsl(320 70% 55%)" },
};

export function InboxDrawer() {
  const { open, setOpen } = useInboxDrawer();
  const navigate = useNavigate();
  const [caixa, setCaixa] = useState<InboxCaixa>("acao_minha");
  const [origemFilter, setOrigemFilter] = useState<InboxOrigem | "todas">("todas");
  const [tipoFilter, setTipoFilter] = useState<string>("todos");
  const [busca, setBusca] = useState("");
  const [somenteNaoLidas, setSomenteNaoLidas] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bulk, setBulk] = useState<Set<string>>(new Set());

  const { items: itemsRaw, counts, isLoading, marcarLido, arquivar, snooze, toggleFavorito } = useInbox({
    caixa, origem: origemFilter, busca, somenteNaoLidas,
  });

  const { scope: detectedScope } = useInboxScope();
  const { hasPermission } = useScreenPermissions();
  const canSeeAprovacoes = hasPermission("projetos_aprovacoes_central");

  // No modo híbrido o usuário pode alternar manualmente entre as duas visões.
  const [hybridView, setHybridViewState] = useState<"tudo" | "produto" | "generico">("tudo");
  const logScopeChange = useInboxScopeAudit();
  const setHybridView = (next: "tudo" | "produto" | "generico") => {
    if (next === hybridView) return;
    logScopeChange({ from: hybridView, to: next, surface: "drawer" });
    setHybridViewState(next);
  };
  const effectiveScope: InboxScope =
    detectedScope === "hibrido"
      ? hybridView === "tudo" ? "hibrido" : (hybridView as InboxScope)
      : detectedScope;

  const origensVisiveis = useMemo<InboxOrigem[]>(() => {
    const base = SCOPE_ORIGENS[effectiveScope];
    // Aprovações só aparece se a permissão da tela estiver liberada.
    return base.filter((o) => (o === "aprovacoes" ? canSeeAprovacoes : true));
  }, [effectiveScope, canSeeAprovacoes]);

  // Garante que o filtro de origem nunca aponte para uma origem fora do escopo.
  useEffect(() => {
    if (origemFilter !== "todas" && !origensVisiveis.includes(origemFilter as InboxOrigem)) {
      setOrigemFilter("todas");
    }
  }, [origensVisiveis, origemFilter]);

  // Tipos disponíveis na fila atual (calculado antes do filtro de tipo)
  const tiposDisponiveis = useMemo(() => {
    const map = new Map<string, number>();
    itemsRaw.forEach((i) => map.set(i.tipo, (map.get(i.tipo) ?? 0) + 1));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [itemsRaw]);

  // Aplica filtro por tipo
  const items = useMemo(
    () => (tipoFilter === "todos" ? itemsRaw : itemsRaw.filter((i) => i.tipo === tipoFilter)),
    [itemsRaw, tipoFilter],
  );

  // Reset bulk + tipo on caixa/origem change
  useEffect(() => { setBulk(new Set()); setSelectedId(null); setTipoFilter("todos"); }, [caixa, origemFilter]);

  const selectedItem = useMemo(
    () => items.find((i) => i.id === selectedId) ?? items[0] ?? null,
    [items, selectedId]
  );

  const previewHandleRef = useRef<PreviewHandle | null>(null);

  function avancarParaProximo(currentId: string) {
    const idx = items.findIndex((i) => i.id === currentId);
    const next = items[idx + 1] ?? items[idx - 1] ?? null;
    setSelectedId(next?.id ?? null);
  }

  // Atalhos j/k/e + a (ação primária) / r (rejeitar) / c (comentar)
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "j" || e.key === "k") {
        e.preventDefault();
        const idx = items.findIndex((i) => i.id === (selectedItem?.id ?? ""));
        const next = e.key === "j" ? Math.min(items.length - 1, idx + 1) : Math.max(0, idx - 1);
        if (items[next]) setSelectedId(items[next].id);
      }
      if (e.key === "e" && selectedItem) {
        e.preventDefault();
        arquivar([selectedItem.id]);
      }
      if (e.key === "a" && selectedItem) {
        e.preventDefault();
        previewHandleRef.current?.triggerPrimary();
      }
      if (e.key === "r" && selectedItem) {
        e.preventDefault();
        previewHandleRef.current?.triggerReject();
      }
      if (e.key === "c" && selectedItem) {
        e.preventDefault();
        previewHandleRef.current?.focusComment();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, items, selectedItem, arquivar]);

  function handleAbrirItem(item: InboxItem) {
    setSelectedId(item.id);
    if (item.modo_leitura === "auto" && !item.lido_em) {
      marcarLido([item.id]);
    }
  }

  function handleNavegar(item: InboxItem) {
    if (!item.action_url) return;
    if (item.modo_leitura === "auto" && !item.lido_em) marcarLido([item.id]);
    navigate(item.action_url);
    setOpen(false);
  }

  function toggleBulk(id: string) {
    setBulk((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const bulkIds = Array.from(bulk);
  const hasBulk = bulkIds.length > 0;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="right"
        className="p-0 w-full sm:max-w-[1100px] flex flex-col"
      >
        {/* Header */}
        <div className="border-b px-4 h-[56px] flex items-center justify-between bg-card">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Inbox className="h-4 w-4" />
            </div>
            <h2 className="font-display font-semibold text-base">Caixa de Entrada</h2>
            <Badge variant="secondary" className="text-[10px]">unificada</Badge>
            <Badge
              variant="outline"
              className="text-[10px] border-primary/30 text-primary bg-primary/5"
              title="Visão da inbox calibrada para o seu perfil de projetos"
            >
              {SCOPE_BADGE[effectiveScope]}
            </Badge>
            {detectedScope === "hibrido" && (
              <div className="ml-1 inline-flex rounded-md border bg-muted/30 p-0.5">
                {(["tudo", "produto", "generico"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setHybridView(v)}
                    className={cn(
                      "px-2 h-6 text-[10px] font-medium rounded capitalize transition-colors",
                      hybridView === v
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {v === "tudo" ? "Tudo" : v === "produto" ? "Produto" : "Genéricos"}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground">
            <kbd className="px-1.5 py-0.5 rounded border bg-muted font-mono text-[10px]">j</kbd>
            <kbd className="px-1.5 py-0.5 rounded border bg-muted font-mono text-[10px]">k</kbd>
            <span>navegar</span>
            <kbd className="px-1.5 py-0.5 rounded border bg-muted font-mono text-[10px] ml-1">e</kbd>
            <span>arquivar</span>
            <kbd className="px-1.5 py-0.5 rounded border bg-muted font-mono text-[10px] ml-1">a</kbd>
            <span>aprovar</span>
            <kbd className="px-1.5 py-0.5 rounded border bg-muted font-mono text-[10px] ml-1">r</kbd>
            <span>rejeitar</span>
            <kbd className="px-1.5 py-0.5 rounded border bg-muted font-mono text-[10px] ml-1">c</kbd>
            <span>comentar</span>
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Coluna 1 — Caixas */}
          <aside className="w-[210px] border-r bg-muted/20 p-2 flex flex-col gap-1">
            {CAIXAS.map(({ key, label, icon: Icon, help }) => {
              const count = counts[key as keyof typeof counts] ?? 0;
              const isActive = caixa === key;
              return (
                <button
                  key={key}
                  onClick={() => setCaixa(key)}
                  className={cn(
                    "relative flex items-center justify-between gap-2 px-2.5 py-2 rounded-md text-sm text-left transition-colors border-l-2",
                    isActive
                      ? "bg-primary/10 text-primary font-medium border-primary"
                      : "border-transparent hover:bg-accent/50"
                  )}
                  title={help}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{label}</span>
                  </div>
                  {count > 0 && (
                    <Badge
                      variant={isActive ? "default" : "secondary"}
                      className="h-5 min-w-5 px-1.5 text-[10px]"
                    >
                      {count}
                    </Badge>
                  )}
                </button>
              );
            })}
            <Separator className="my-2" />
            <div className="px-2 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
              Origens
            </div>
            <div className="px-1 flex flex-wrap gap-1">
              <button
                onClick={() => setOrigemFilter("todas")}
                className={cn(
                  "h-7 px-2.5 rounded-full text-[11px] font-medium border transition-all",
                  origemFilter === "todas"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-muted border-border text-muted-foreground"
                )}
              >
                Todas
              </button>
              {origensVisiveis.map((key) => {
                const meta = ORIGEM_META[key];
                if (!meta) return null;
                const Icon = meta.icon;
                const active = origemFilter === key;
                return (
                  <button
                    key={key}
                    onClick={() => setOrigemFilter(key as InboxOrigem)}
                    className={cn(
                      "h-7 px-2.5 rounded-full text-[11px] font-medium border transition-all flex items-center gap-1",
                      active ? "ring-1" : "hover:opacity-80"
                    )}
                    style={
                      active
                        ? {
                            backgroundColor: `${meta.color}26`,
                            color: meta.color,
                            borderColor: meta.color,
                          }
                        : {
                            backgroundColor: `${meta.color}10`,
                            color: meta.color,
                            borderColor: "transparent",
                          }
                    }
                    title={meta.label}
                  >
                    <Icon className="h-3 w-3" />
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Coluna 2 — Lista */}
          <section className="w-[400px] border-r flex flex-col min-h-0">
            <div className="p-2 border-b space-y-2">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar..."
                    className="h-8 pl-7 text-sm"
                  />
                </div>
                <Button
                  size="sm"
                  variant={somenteNaoLidas ? "default" : "outline"}
                  onClick={() => setSomenteNaoLidas((v) => !v)}
                  className="h-8 text-xs"
                >
                  Não lidas
                </Button>
              </div>
              {tiposDisponiveis.length > 0 && (
                <div className="flex items-center gap-1 overflow-x-auto pb-0.5 -mx-0.5 px-0.5">
                  <button
                    onClick={() => setTipoFilter("todos")}
                    className={cn(
                      "flex-shrink-0 h-6 px-2 rounded-full text-[10px] font-medium border transition-colors",
                      tipoFilter === "todos"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-muted border-border text-muted-foreground"
                    )}
                  >
                    Todos os tipos · {itemsRaw.length}
                  </button>
                  {tiposDisponiveis.map(([tipo, count]) => (
                    <button
                      key={tipo}
                      onClick={() => setTipoFilter(tipo)}
                      title={`Filtrar por ${tipo}`}
                      className={cn(
                        "flex-shrink-0 h-6 px-2 rounded-full text-[10px] font-medium border transition-colors capitalize",
                        tipoFilter === tipo
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background hover:bg-muted border-border text-muted-foreground"
                      )}
                    >
                      {tipo.replace(/_/g, " ")} · {count}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {hasBulk && (
              <div className="px-2 py-1.5 bg-primary/5 border-b flex items-center justify-between text-xs">
                <span className="font-medium">{bulkIds.length} selecionado(s)</span>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => marcarLido(bulkIds)}>
                    <CheckCheck className="h-3.5 w-3.5 mr-1" /> Lido
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="ghost" className="h-7 text-xs">
                        <Clock className="h-3.5 w-3.5 mr-1" /> Adiar
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => snooze({ ids: bulkIds, ate: new Date(Date.now() + 3 * 3600 * 1000) })}>3 horas</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => snooze({ ids: bulkIds, ate: new Date(Date.now() + 24 * 3600 * 1000) })}>Amanhã</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => snooze({ ids: bulkIds, ate: new Date(Date.now() + 7 * 24 * 3600 * 1000) })}>Próxima semana</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => arquivar(bulkIds)}>
                    <Archive className="h-3.5 w-3.5 mr-1" /> Arquivar
                  </Button>
                </div>
              </div>
            )}

            <ScrollArea className="flex-1">
              {isLoading ? (
                <DrawerListSkeleton />
              ) : items.length === 0 ? (
                <EmptyState
                  icon={Inbox}
                  title="Nenhum item nesta caixa"
                  description="Tudo em dia. Novos itens aparecerão aqui automaticamente."
                  className="py-12"
                />
              ) : (
                <ul>
                  {items.map((item) => {
                    const meta = ORIGEM_META[item.origem];
                    const Icon = meta?.icon ?? Inbox;
                    const isSel = selectedItem?.id === item.id;
                    const isChecked = bulk.has(item.id);
                    return (
                      <li
                        key={item.id}
                        className={cn(
                          "px-2.5 py-2.5 border-b border-border/40 cursor-pointer transition-colors flex gap-2 group relative",
                          isSel ? "bg-primary/10" : "hover:bg-muted/40",
                          !item.lido_em && "bg-primary/[0.03]"
                        )}
                        onClick={() => handleAbrirItem(item)}
                      >
                        <div
                          className="absolute left-0 top-0 bottom-0 w-[3px]"
                          style={{ backgroundColor: meta?.color ?? "hsl(var(--primary))" }}
                        />
                        <div onClick={(e) => e.stopPropagation()} className="pt-0.5">
                          <Checkbox checked={isChecked} onCheckedChange={() => toggleBulk(item.id)} className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <Icon className="h-3 w-3 flex-shrink-0" style={{ color: meta?.color }} />
                            <span className="text-[10px] uppercase font-semibold tracking-wider" style={{ color: meta?.color }}>
                              {meta?.label}
                            </span>
                            {item.modo_leitura === "acao" && (
                              <Badge variant="outline" className="h-4 text-[9px] px-1 border-warning/40 text-warning">
                                ação
                              </Badge>
                            )}
                            {!item.lido_em && <span className="ml-auto h-2 w-2 rounded-full bg-primary" />}
                          </div>
                          <p className={cn("text-sm leading-snug truncate", !item.lido_em && "font-semibold")}>
                            {item.titulo}
                          </p>
                          {item.resumo && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{item.resumo}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-muted-foreground">
                              {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ptBR })}
                            </span>
                            {item.favorito && <Star className="h-3 w-3 text-amber-400 fill-amber-400" />}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </ScrollArea>
          </section>

          {/* Coluna 3 — Preview */}
          <section className="flex-1 flex flex-col min-h-0 bg-background">
            {!selectedItem ? (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                Selecione um item para visualizar
              </div>
            ) : (
              <>
                <div className="border-b p-4 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      {(() => {
                        const meta = ORIGEM_META[selectedItem.origem];
                        const Icon = meta?.icon ?? Inbox;
                        return (
                          <Badge
                            variant="outline"
                            className="text-[10px] gap-1"
                            style={{ borderColor: meta?.color, color: meta?.color }}
                          >
                            <Icon className="h-3 w-3" />
                            {meta?.label}
                          </Badge>
                        );
                      })()}
                      {selectedItem.modo_leitura === "acao" && (
                        <Badge className="text-[10px] bg-warning/15 text-warning hover:bg-warning/20 border-0">
                          Requer ação
                        </Badge>
                      )}
                    </div>
                    <h3 className="font-semibold text-base leading-tight">{selectedItem.titulo}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(selectedItem.created_at), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleFavorito(selectedItem.id)} title="Favoritar">
                      <Star className={cn("h-4 w-4", selectedItem.favorito && "fill-warning text-warning")} />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Adiar">
                          <Clock className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => snooze({ ids: [selectedItem.id], ate: new Date(Date.now() + 3 * 3600 * 1000) })}>3 horas</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => snooze({ ids: [selectedItem.id], ate: new Date(Date.now() + 24 * 3600 * 1000) })}>Amanhã</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => snooze({ ids: [selectedItem.id], ate: new Date(Date.now() + 7 * 24 * 3600 * 1000) })}>Próxima semana</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => arquivar([selectedItem.id])} title="Arquivar (E)">
                      <Archive className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {(() => {
                  const Rich = getRichPreview(selectedItem);
                  const handleResolved = () => {
                    const id = selectedItem.id;
                    arquivar([id]);
                    avancarParaProximo(id);
                  };
                  if (Rich) {
                    return (
                      <Rich
                        key={selectedItem.id}
                        ref={previewHandleRef as any}
                        item={selectedItem}
                        onOpen={() => handleNavegar(selectedItem)}
                        onResolved={handleResolved}
                      />
                    );
                  }
                  return (
                    <GenericPreview
                      key={selectedItem.id}
                      item={selectedItem}
                      onOpen={() => handleNavegar(selectedItem)}
                    />
                  );
                })()}
              </>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Skeleton da lista do drawer — mesmo ritmo do FeedSkeleton de Projetos. */
function DrawerListSkeleton() {
  return (
    <ul className="divide-y divide-border/40">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <li key={i} className="px-2.5 py-2.5 flex gap-2">
          <Skeleton className="h-3.5 w-3.5 rounded mt-1" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-16 rounded-full" />
              <Skeleton className="h-2 w-2 rounded-full" />
            </div>
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </li>
      ))}
    </ul>
  );
}

