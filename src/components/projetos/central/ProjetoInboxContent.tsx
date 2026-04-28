import { useMemo, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ProjetoInboxFeed } from "@/components/projetos/ProjetoInboxFeed";
import { ProjetoInboxDetail } from "@/components/projetos/ProjetoInboxDetail";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { KpiCard } from "@/components/ui/kpi-card";
import {
  CheckCheck, Star, Archive, MessageSquare, Search,
  Bell, CalendarDays, LayoutList, FolderOpen, ChevronDown,
  X, AtSign, CheckCircle2, FolderPlus, ArrowRight, Sparkles,
  ShieldCheck, AlertTriangle
} from "lucide-react";
import { useProjetoAtividades, type ProjetoAtividade, type InboxFilter } from "@/hooks/useProjetoAtividades";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useInboxScope } from "@/hooks/useInboxScope";
import { cn } from "@/lib/utils";
import {
  DEFAULTS,
  normalizeInboxGroup,
  normalizeInboxSubtab,
  normalizeInboxTipos,
  normalizeProjectIdList,
  normalizeSearch,
  sanitizeCentralSearchParams,
  VALID_INBOX_TIPOS,
  type CentralInboxGroup,
  type CentralInboxSubtab,
  type CentralInboxTipo,
} from "@/lib/centralUrlParams";

const TIPO_FILTERS = [
  { key: "criou_tarefa" as const, label: "Tarefas", icon: FolderPlus },
  { key: "completou" as const, label: "Concluídas", icon: CheckCircle2 },
  { key: "comentou" as const, label: "Comentários", icon: MessageSquare },
  { key: "moveu" as const, label: "Movidas", icon: ArrowRight },
];

export function ProjetoInboxContent() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize state from normalized URL params (any garbage falls back to defaults).
  const [activeTab, setActiveTab] = useState<CentralInboxSubtab>(() =>
    normalizeInboxSubtab(searchParams.get("subtab")),
  );
  const [groupMode, setGroupMode] = useState<CentralInboxGroup>(() =>
    normalizeInboxGroup(searchParams.get("group")),
  );
  const [search, setSearch] = useState<string>(() => normalizeSearch(searchParams.get("q")));
  const [filterProjetoIds, setFilterProjetoIds] = useState<string[]>(() =>
    normalizeProjectIdList(searchParams.get("projetos")),
  );
  const [filterTipos, setFilterTipos] = useState<CentralInboxTipo[]>(() =>
    normalizeInboxTipos(searchParams.get("tipos")),
  );

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailAtividade, setDetailAtividade] = useState<ProjetoAtividade | null>(null);

  // Strip any garbage from inbox-related URL params on mount / when they change.
  // Delegates to the central sanitizer so dedup + encoding cleanup is consistent
  // with CentralTrabalho.
  useEffect(() => {
    if (searchParams.get("tab") !== "inbox") return;
    const sanitized = sanitizeCentralSearchParams(searchParams);
    if (sanitized.toString() !== searchParams.toString()) {
      setSearchParams(sanitized, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Reflect local UI state back into the URL. We build a fresh params object,
  // copy over keys we don't manage (e.g. "tab"), then run the central sanitizer
  // so duplicates / casing / control chars never leak into history.
  useEffect(() => {
    if (searchParams.get("tab") !== "inbox") return;
    const params = new URLSearchParams();
    params.set("tab", "inbox");
    if (activeTab !== DEFAULTS.inboxSubtab) params.set("subtab", activeTab);
    if (groupMode !== DEFAULTS.inboxGroup) params.set("group", groupMode);
    const cleanQ = normalizeSearch(search);
    if (cleanQ) params.set("q", cleanQ);
    if (filterTipos.length) params.set("tipos", filterTipos.join(","));
    if (filterProjetoIds.length) params.set("projetos", filterProjetoIds.join(","));

    const sanitized = sanitizeCentralSearchParams(params);
    if (sanitized.toString() !== searchParams.toString()) {
      setSearchParams(sanitized, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, groupMode, search, filterTipos, filterProjetoIds]);

  const filter: InboxFilter = useMemo(() => ({
    projetoIds: filterProjetoIds.length > 0 ? filterProjetoIds : undefined,
    tipos: filterTipos.length > 0 ? filterTipos : undefined,
    search: search || undefined,
  }), [filterProjetoIds, filterTipos, search]);

  const {
    atividades, arquivadas, favoritas, mencoes, isLoading,
    naoLidas, hoje, projetos,
    arquivar, desarquivar, toggleFavorita, marcarLidas,
  } = useProjetoAtividades(filter);

  const { scope } = useInboxScope();
  // Para a visão híbrida (admin/gerente geral) não diferenciamos rótulos —
  // tratamos como visão Produto, que é a mais completa.
  const isProdutoView = scope === "produto" || scope === "hibrido";
  const aprovacoesPendentes = useMemo(
    () => atividades.filter((a) => a.tipo === "completou" && !a.lida).length,
    [atividades],
  );
  const tarefasNovas = useMemo(
    () => atividades.filter((a) => a.tipo === "criou_tarefa" && !a.lida).length,
    [atividades],
  );

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
    if (selectedIds.size === currentList.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(currentList.map(a => a.id)));
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
    setFilterProjetoIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };
  const toggleFilterTipo = (tipo: CentralInboxTipo) => {
    if (!VALID_INBOX_TIPOS.includes(tipo)) return;
    setFilterTipos(prev => prev.includes(tipo) ? prev.filter(t => t !== tipo) : [...prev, tipo]);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end">
        {naoLidas > 0 && (
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleMarcarTodasLidas}>
            <CheckCheck className="h-3.5 w-3.5" /> Marcar todas como lidas
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard title="Não lidas" value={naoLidas} icon={Bell} variant="info" />
        <KpiCard title="Menções" value={mencoes.length} icon={AtSign} variant="warning" />
        <KpiCard title="Favoritas" value={favoritas.length} icon={Star} variant="accent" />
        <KpiCard title="Hoje" value={hoje} icon={CalendarDays} variant="success" />
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Tabs value={activeTab} onValueChange={v => { setActiveTab(normalizeInboxSubtab(v)); setSelectedIds(new Set()); }}>
          <TabsList className="bg-muted/30">
            <TabsTrigger value="atividade" className="gap-1.5">
              <LayoutList className="h-3.5 w-3.5" />
              Atividade
              {naoLidas > 0 && <Badge variant="secondary" className="text-[10px] h-4 px-1 ml-1">{naoLidas}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="mencoes" className="gap-1.5">
              <AtSign className="h-3.5 w-3.5" />
              Menções
              {mencoes.length > 0 && <Badge variant="secondary" className="text-[10px] h-4 px-1 ml-1">{mencoes.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="favoritas" className="gap-1.5">
              <Star className="h-3.5 w-3.5" />
              Favoritas
              {favoritas.length > 0 && <Badge variant="secondary" className="text-[10px] h-4 px-1 ml-1">{favoritas.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="arquivadas" className="gap-1.5">
              <Archive className="h-3.5 w-3.5" />
              Arquivadas
              {arquivadas.length > 0 && <Badge variant="secondary" className="text-[10px] h-4 px-1 ml-1">{arquivadas.length}</Badge>}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(normalizeSearch(e.target.value))}
              placeholder="Buscar..."
              className="h-8 w-48 pl-8 text-xs"
              maxLength={100}
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
            )}
          </div>

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

      {activeTab === "atividade" && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground font-medium">Tipo:</span>
          {TIPO_FILTERS.map(tf => {
            const TfIcon = tf.icon;
            const active = filterTipos.includes(tf.key);
            return (
              <button
                key={tf.key}
                onClick={() => toggleFilterTipo(tf.key)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
              >
                <TfIcon className="h-3 w-3" />
                {tf.label}
              </button>
            );
          })}
          {filterTipos.length > 0 && (
            <button onClick={() => setFilterTipos([])} className="text-xs text-primary hover:underline ml-1">
              Limpar
            </button>
          )}
        </div>
      )}

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
            activeTab === "arquivadas" ? "Nenhuma arquivada" :
            "Tudo em dia!"
          }
          emptyDesc={
            activeTab === "mencoes" ? "Quando alguém mencionar você com @, a notificação aparecerá aqui" :
            activeTab === "favoritas" ? "Marque notificações com ⭐ para acessá-las rapidamente" :
            activeTab === "arquivadas" ? "Arquive notificações antigas para manter sua caixa organizada" :
            "Nenhuma notificação pendente. Aproveite para focar no que importa!"
          }
          emptyIcon={
            activeTab === "mencoes" ? AtSign :
            activeTab === "favoritas" ? Star :
            activeTab === "arquivadas" ? Archive :
            Sparkles
          }
        />
      </div>

      <ProjetoInboxDetail
        atividade={detailAtividade}
        open={!!detailAtividade}
        onClose={() => setDetailAtividade(null)}
        onToggleFavorita={detailAtividade ? () => toggleFavorita(detailAtividade.id) : undefined}
        onArquivar={detailAtividade ? () => { arquivar([detailAtividade.id]); setDetailAtividade(null); } : undefined}
      />
    </div>
  );
}
