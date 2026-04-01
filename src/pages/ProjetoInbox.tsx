import { useState, useMemo, useCallback } from "react";
import { ProjetoInboxFeed } from "@/components/projetos/ProjetoInboxFeed";
import { ProjetoInboxDetail } from "@/components/projetos/ProjetoInboxDetail";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/AppSidebar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Inbox, CheckCheck, Star, Archive, MessageSquare, Search,
  Bell, CalendarDays, LayoutList, FolderOpen, ChevronDown,
  SquareCheckBig, X
} from "lucide-react";
import { useProjetoAtividades, type ProjetoAtividade, type InboxFilter } from "@/hooks/useProjetoAtividades";
import { toast } from "sonner";

type TabKey = "atividade" | "mencoes" | "favoritas" | "arquivadas";
type GroupMode = "tempo" | "projeto";

export default function ProjetoInbox() {
  const [activeTab, setActiveTab] = useState<TabKey>("atividade");
  const [groupMode, setGroupMode] = useState<GroupMode>("tempo");
  const [search, setSearch] = useState("");
  const [filterProjetoIds, setFilterProjetoIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailAtividade, setDetailAtividade] = useState<ProjetoAtividade | null>(null);

  const filter: InboxFilter = useMemo(() => ({
    projetoIds: filterProjetoIds.length > 0 ? filterProjetoIds : undefined,
    search: search || undefined,
  }), [filterProjetoIds, search]);

  const {
    atividades, arquivadas, favoritas, mencoes, isLoading,
    naoLidas, hoje, projetos,
    arquivar, desarquivar, toggleFavorita, marcarLidas,
  } = useProjetoAtividades(filter);

  const currentList = useMemo(() => {
    switch (activeTab) {
      case "mencoes": return mencoes;
      case "favoritas": return favoritas;
      case "arquivadas": return arquivadas;
      default: return atividades;
    }
  }, [activeTab, atividades, mencoes, favoritas, arquivadas]);

  const handleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === currentList.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(currentList.map(a => a.id)));
    }
  }, [currentList, selectedIds]);

  const handleBulkLidas = useCallback(async () => {
    const ids = Array.from(selectedIds);
    await marcarLidas(ids);
    setSelectedIds(new Set());
    toast.success(`${ids.length} marcadas como lidas`);
  }, [selectedIds, marcarLidas]);

  const handleBulkArquivar = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (activeTab === "arquivadas") {
      await desarquivar(ids);
      toast.success(`${ids.length} desarquivadas`);
    } else {
      await arquivar(ids);
      toast.success(`${ids.length} arquivadas`);
    }
    setSelectedIds(new Set());
  }, [selectedIds, activeTab, arquivar, desarquivar]);

  const handleMarcarTodasLidas = useCallback(async () => {
    const ids = atividades.filter(a => !a.lida).map(a => a.id);
    if (ids.length === 0) return;
    await marcarLidas(ids);
    toast.success(`${ids.length} notificações marcadas como lidas`);
  }, [atividades, marcarLidas]);

  const toggleFilterProjeto = (id: string) => {
    setFilterProjetoIds(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <div className="p-6 max-w-5xl mx-auto space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <SidebarTrigger />
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Inbox className="h-5 w-5 text-primary" />
                  </div>
                  <h1 className="text-2xl font-bold text-foreground">Caixa de Entrada</h1>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {naoLidas > 0 && (
                  <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={handleMarcarTodasLidas}>
                    <CheckCheck className="h-3.5 w-3.5" /> Marcar todas como lidas
                  </Button>
                )}
              </div>
            </div>

            {/* KPI Strip */}
            <div className="grid grid-cols-3 gap-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border/50">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Bell className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{naoLidas}</p>
                  <p className="text-[11px] text-muted-foreground">Não lidas</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border/50">
                <div className="h-9 w-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <MessageSquare className="h-4 w-4 text-amber-500" />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{mencoes.length}</p>
                  <p className="text-[11px] text-muted-foreground">Menções</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border/50">
                <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <CalendarDays className="h-4 w-4 text-emerald-500" />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{hoje}</p>
                  <p className="text-[11px] text-muted-foreground">Hoje</p>
                </div>
              </div>
            </div>

            {/* Toolbar: Tabs + Filters */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <Tabs value={activeTab} onValueChange={v => { setActiveTab(v as TabKey); setSelectedIds(new Set()); }}>
                <TabsList className="bg-muted/30">
                  <TabsTrigger value="atividade" className="gap-1.5">
                    <LayoutList className="h-3.5 w-3.5" />
                    Atividade
                    {naoLidas > 0 && <Badge variant="secondary" className="text-[10px] h-4 px-1 ml-1">{naoLidas}</Badge>}
                  </TabsTrigger>
                  <TabsTrigger value="mencoes" className="gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5" />
                    @Menções
                  </TabsTrigger>
                  <TabsTrigger value="favoritas" className="gap-1.5">
                    <Star className="h-3.5 w-3.5" />
                    Favoritas
                  </TabsTrigger>
                  <TabsTrigger value="arquivadas" className="gap-1.5">
                    <Archive className="h-3.5 w-3.5" />
                    Arquivadas
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="flex items-center gap-2">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar..."
                    className="h-8 w-48 pl-8 text-xs"
                  />
                  {search && (
                    <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                      <X className="h-3 w-3 text-muted-foreground" />
                    </button>
                  )}
                </div>

                {/* Project filter */}
                {projetos.length > 0 && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                        <FolderOpen className="h-3.5 w-3.5" />
                        Projeto
                        {filterProjetoIds.length > 0 && (
                          <Badge variant="secondary" className="text-[10px] h-4 px-1">{filterProjetoIds.length}</Badge>
                        )}
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-2" align="end">
                      <p className="text-xs font-semibold text-muted-foreground px-2 py-1">Filtrar por projeto</p>
                      {projetos.map(p => (
                        <button
                          key={p.id}
                          className="flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-muted/50 transition-colors text-sm"
                          onClick={() => toggleFilterProjeto(p.id)}
                        >
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: p.cor }} />
                          <span className="flex-1 text-left truncate">{p.nome}</span>
                          {filterProjetoIds.includes(p.id) && <CheckCheck className="h-3.5 w-3.5 text-primary" />}
                        </button>
                      ))}
                      {filterProjetoIds.length > 0 && (
                        <button
                          className="text-xs text-primary px-2 py-1 mt-1 hover:underline"
                          onClick={() => setFilterProjetoIds([])}
                        >
                          Limpar filtros
                        </button>
                      )}
                    </PopoverContent>
                  </Popover>
                )}

                {/* Group toggle */}
                <Button
                  variant={groupMode === "projeto" ? "secondary" : "outline"}
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => setGroupMode(g => g === "tempo" ? "projeto" : "tempo")}
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  {groupMode === "tempo" ? "Por tempo" : "Por projeto"}
                </Button>
              </div>
            </div>

            {/* Bulk actions bar */}
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-primary/5 border border-primary/20 animate-fade-in">
                <Checkbox
                  checked={selectedIds.size === currentList.length}
                  onCheckedChange={handleSelectAll}
                  className="h-4 w-4"
                />
                <span className="text-sm font-medium text-foreground">{selectedIds.size} selecionadas</span>
                <div className="flex items-center gap-1.5 ml-auto">
                  <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={handleBulkLidas}>
                    <CheckCheck className="h-3.5 w-3.5" /> Marcar como lidas
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={handleBulkArquivar}>
                    <Archive className="h-3.5 w-3.5" /> {activeTab === "arquivadas" ? "Desarquivar" : "Arquivar"}
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedIds(new Set())}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}

            {/* Feed */}
            <div className="border border-border/50 rounded-lg overflow-hidden bg-card">
              <ProjetoInboxFeed
                atividades={currentList}
                isLoading={isLoading}
                groupMode={groupMode}
                selectedIds={selectedIds}
                onSelect={handleSelect}
                onOpenDetail={setDetailAtividade}
                onMarcarLida={id => marcarLidas([id])}
                onToggleFavorita={id => toggleFavorita(id)}
                onArquivar={id => activeTab === "arquivadas" ? desarquivar([id]) : arquivar([id])}
                showArquivarRestore={activeTab === "arquivadas"}
                emptyTitle={
                  activeTab === "mencoes" ? "Nenhuma menção ainda" :
                  activeTab === "favoritas" ? "Nenhuma favorita" :
                  activeTab === "arquivadas" ? "Nenhuma arquivada" : undefined
                }
                emptyDesc={
                  activeTab === "mencoes" ? "Quando alguém mencionar você em um comentário, aparecerá aqui" :
                  activeTab === "favoritas" ? "Marque notificações com estrela para acessá-las rapidamente" :
                  activeTab === "arquivadas" ? "Arquive notificações para limpá-las da caixa de entrada" : undefined
                }
              />
            </div>
          </div>
        </main>
      </div>

      {/* Detail panel */}
      <ProjetoInboxDetail
        atividade={detailAtividade}
        open={!!detailAtividade}
        onClose={() => setDetailAtividade(null)}
        onToggleFavorita={detailAtividade ? () => toggleFavorita(detailAtividade.id) : undefined}
        onArquivar={detailAtividade ? () => { arquivar([detailAtividade.id]); setDetailAtividade(null); } : undefined}
      />
    </SidebarProvider>
  );
}
