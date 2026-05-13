import { useState, useMemo, useEffect, useRef } from "react";
import { Projeto } from "@/hooks/useProjetos";
import { ProjetoTarefa } from "@/hooks/useProjetoTarefas";
import { Button } from "@/components/ui/button";
import { Plus, List, LayoutGrid, Calendar, CalendarDays, BarChart3, FileText, FileSpreadsheet, ShieldCheck, Sparkles, Users, UsersRound, Target, CalendarClock, Search, X, ChevronDown, MoreHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useProjetoIA } from "@/hooks/useProjetoIA";
import { ResumoIADialog } from "./ResumoIADialog";
import { ProjetoHealthPanel } from "./ProjetoHealthPanel";
import { ProjetoMembrosDialog } from "./ProjetoMembrosDialog";
import { FilterButton, SortButton, ProjetoFilters, ProjetoSort, EMPTY_FILTERS, DEFAULT_SORT } from "./ProjetoFilterSort";
import { QuickAddTaskDialog } from "./QuickAddTaskDialog";
import { ProjetoLixeiraDialog } from "./ProjetoLixeiraDialog";
import { SalvarComoModeloDialog } from "./SalvarComoModeloDialog";
import { ImpersonationSelector } from "@/components/admin/ImpersonationSelector";
import { ProjetoActiveFiltersBar } from "./ProjetoActiveFiltersBar";
import { ProjetoSettingsMenu } from "./ProjetoSettingsMenu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface ProjetoHeaderProps {
  projeto: Projeto;
  activeTab: string;
  onTabChange: (tab: string) => void;
  tarefas?: ProjetoTarefa[];
  customBg?: boolean;
  darkBg?: boolean;
  filters?: ProjetoFilters;
  onFiltersChange?: (filters: ProjetoFilters) => void;
  sort?: ProjetoSort;
  onSortChange?: (sort: ProjetoSort) => void;
  teamMembers?: { id: string; nome: string; avatar_url: string | null }[];
  secoes?: { id: string; nome: string }[];
  onAddTarefa?: (titulo: string, secaoId: string) => void;
  tarefasExcluidas?: { id: string; titulo: string; excluida_em: string }[];
  tarefasExcluidasLoading?: boolean;
  tarefasExcluidasCount?: number;
  lixeiraOpen?: boolean;
  onLixeiraOpenChange?: (open: boolean) => void;
  onRestaurarTarefa?: (tarefaId: string) => void;
  bgCor?: string | null;
  onBgCorChange?: (cor: string | null) => void;
}

const WORK_TABS = [
  { value: "lista", icon: List, label: "Lista" },
  { value: "quadro", icon: LayoutGrid, label: "Quadro" },
  { value: "cronograma", icon: Calendar, label: "Cronograma" },
  { value: "calendario", icon: CalendarDays, label: "Calendário" },
  { value: "prazos", icon: CalendarClock, label: "Prazos" },
];

const MANAGE_TABS = [
  { value: "painel", icon: BarChart3, label: "Painel" },
  { value: "metas", icon: Target, label: "Metas" },
  { value: "briefings", icon: FileSpreadsheet, label: "Briefings" },
  { value: "equipe", icon: UsersRound, label: "Equipe" },
  { value: "chat", icon: Sparkles, label: "Chat IA" },
  { value: "arquivos", icon: FileText, label: "Arquivos" },
];

export function ProjetoHeader({
  projeto, activeTab, onTabChange, tarefas = [], customBg = false, darkBg = false,
  filters = EMPTY_FILTERS, onFiltersChange, sort = DEFAULT_SORT, onSortChange,
  teamMembers = [], secoes = [], onAddTarefa,
  tarefasExcluidas = [], tarefasExcluidasLoading, tarefasExcluidasCount,
  lixeiraOpen: lixeiraOpenProp, onLixeiraOpenChange, onRestaurarTarefa,
  bgCor = null, onBgCorChange,
}: ProjetoHeaderProps) {
  const textColor = darkBg ? "text-white" : customBg ? "text-black" : "";
  const textMuted = darkBg ? "text-white/70" : customBg ? "text-black/70" : "text-muted-foreground";
  const btnHover = darkBg ? "text-white border-white/30 hover:bg-white/10" : customBg ? "text-black border-black/20 hover:bg-black/10" : "";
  const navigate = useNavigate();
  const { getProjectSummary, loading } = useProjetoIA();
  const [resumoOpen, setResumoOpen] = useState(false);
  const [membrosOpen, setMembrosOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [lixeiraOpenLocal, setLixeiraOpenLocal] = useState(false);
  // Lixeira: controlado externamente (Fase 2 — lazy load) ou estado local legacy.
  const lixeiraOpen = lixeiraOpenProp ?? lixeiraOpenLocal;
  const setLixeiraOpen = (v: boolean) => {
    if (onLixeiraOpenChange) onLixeiraOpenChange(v); else setLixeiraOpenLocal(v);
  };
  const lixeiraBadgeCount = typeof tarefasExcluidasCount === "number"
    ? tarefasExcluidasCount
    : tarefasExcluidas.length;
  const [salvarModeloOpen, setSalvarModeloOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement | null>(null);

  // Atalho "/" foca a busca rápida (sem conflitar com inputs/textareas existentes)
  useEffect(() => {
    if (!filters || !onFiltersChange) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || (target as HTMLElement).isContentEditable)) return;
      e.preventDefault();
      searchRef.current?.focus();
      searchRef.current?.select();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [filters, onFiltersChange]);

  // Canais de criação distintos presentes nas tarefas atuais (origem Asana ou manual)
  const canaisDisponiveis = useMemo(() => {
    const set = new Set<string>();
    for (const t of tarefas as any[]) {
      const c = (t?.canal_criacao || "").trim();
      if (c) set.add(c);
    }
    return Array.from(set).sort();
  }, [tarefas]);

  const tabCls = (isActive: boolean) => cn(
    "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all cursor-pointer",
    isActive
      ? darkBg
        ? "bg-white/15 text-white shadow-sm"
        : customBg
          ? "bg-white/80 text-black shadow-sm"
          : "bg-background text-foreground shadow-sm"
      : darkBg
        ? "text-white/60 hover:text-white hover:bg-white/10"
        : customBg
          ? "text-black/50 hover:text-black hover:bg-black/10"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
  );

  return (
    <div className="space-y-5">
      {/* Hero banner */}
      <div
        className="relative rounded-xl overflow-hidden px-6 py-5"
        style={{
          background: `linear-gradient(135deg, ${projeto.cor}22 0%, ${projeto.cor}08 100%)`,
        }}
      >
        <div className="flex items-center gap-4">
          {/* Icon */}
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shadow-md"
            style={{ backgroundColor: projeto.cor }}
          >
            <span className="text-white text-xl font-bold">{projeto.nome.charAt(0)}</span>
          </div>
          {/* Title + description */}
          <div className="flex-1 min-w-0">
            <h1 className={cn("text-2xl font-bold tracking-tight", textColor || "text-foreground")}>{projeto.nome}</h1>
            {projeto.descricao && <p className={cn("text-sm mt-0.5 truncate", textMuted)}>{projeto.descricao}</p>}
          </div>
          {/* Action pill */}
          <div className={cn(
            "flex items-center gap-1 rounded-full p-1",
            darkBg ? "bg-white/10" : customBg ? "bg-black/5" : "bg-muted/80"
          )}>
            <Button
              variant="ghost" size="icon"
              className={cn("h-8 w-8 rounded-full", btnHover || "hover:bg-muted")}
              onClick={() => setMembrosOpen(true)}
              title="Membros"
            >
              <Users className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost" size="icon"
              className={cn("h-8 w-8 rounded-full", btnHover || "hover:bg-muted")}
              onClick={() => setResumoOpen(true)}
              title="Resumo IA"
            >
              <Sparkles className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost" size="icon"
              className={cn("h-8 w-8 rounded-full", btnHover || "hover:bg-muted")}
              onClick={() => navigate(`/dashboard/projetos/${projeto.id}/produtividade`)}
              title="Produtividade e custos"
            >
              <BarChart3 className="h-4 w-4" />
            </Button>
            <ProjetoSettingsMenu
              projetoId={projeto.id}
              bgCor={bgCor}
              onBgCorChange={(c) => onBgCorChange?.(c)}
              onAbrirMembros={() => setMembrosOpen(true)}
              onAbrirLixeira={() => setLixeiraOpen(true)}
              onSalvarComoModelo={() => setSalvarModeloOpen(true)}
              lixeiraBadgeCount={lixeiraBadgeCount}
              triggerClassName={btnHover || "hover:bg-muted"}
            />
          </div>
        </div>

        {/* Health panel inside hero */}
        {tarefas.length > 0 && (
          <div className="mt-4">
            <ProjetoHealthPanel tarefas={tarefas} darkBg={darkBg} />
          </div>
        )}
      </div>

      {/* Tabs row — full width para evitar corte das abas finais */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <div className={cn(
            "flex items-center gap-1 rounded-lg p-1 overflow-x-auto scrollbar-hide",
            darkBg ? "bg-white/10" : customBg ? "bg-black/10" : "bg-muted"
          )}>
            {/* Work tabs */}
            {WORK_TABS.map(tab => {
              const Icon = tab.icon;
              return (
                <button key={tab.value} onClick={() => onTabChange(tab.value)} className={cn(tabCls(activeTab === tab.value), "flex-shrink-0")}>
                  <Icon className="h-3.5 w-3.5" /> {tab.label}
                </button>
              );
            })}

            {/* Separator */}
            <div className={cn("w-px h-5 mx-1 flex-shrink-0", darkBg ? "bg-white/20" : customBg ? "bg-black/15" : "bg-border")} />

            {/* Management tabs */}
            {MANAGE_TABS.map(tab => {
              const Icon = tab.icon;
              return (
                <button key={tab.value} onClick={() => onTabChange(tab.value)} className={cn(tabCls(activeTab === tab.value), "flex-shrink-0")}>
                  <Icon className="h-3.5 w-3.5" /> {tab.label}
                </button>
              );
            })}

            {/* Aprovações */}
            <button
              onClick={() => navigate(`/dashboard/projetos/${projeto.id}/aprovacoes`)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors flex-shrink-0",
                darkBg ? "text-white/60 hover:text-white hover:bg-white/10" : customBg ? "text-black/50 hover:text-black hover:bg-black/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
              title="Kanban de aprovações deste projeto"
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Aprovações
            </button>
          </div>
          {/* Fade gradients para indicar scroll */}
          <div className={cn(
            "pointer-events-none absolute right-0 top-0 h-full w-8 rounded-r-lg",
            darkBg
              ? "bg-gradient-to-l from-background/80 to-transparent"
              : customBg
                ? "bg-gradient-to-l from-background/60 to-transparent"
                : "bg-gradient-to-l from-muted to-transparent"
          )} />
        </div>

        {/* Botão "Mais" — Popover com lista completa de abas para acesso garantido */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn("h-8 gap-1 text-xs flex-shrink-0", btnHover)}
              title="Todas as abas"
            >
              <MoreHorizontal className="h-3.5 w-3.5" /> Mais
              <ChevronDown className="h-3 w-3 opacity-60" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56 p-1.5">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">
              Trabalho
            </p>
            {WORK_TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.value;
              return (
                <button
                  key={tab.value}
                  onClick={() => onTabChange(tab.value)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-muted transition-colors",
                    isActive && "bg-muted font-medium text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1 mt-1">
              Gestão
            </p>
            {MANAGE_TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.value;
              return (
                <button
                  key={tab.value}
                  onClick={() => onTabChange(tab.value)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-muted transition-colors",
                    isActive && "bg-muted font-medium text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
            <button
              onClick={() => navigate(`/dashboard/projetos/${projeto.id}/aprovacoes`)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-muted transition-colors"
            >
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              <span>Aprovações</span>
            </button>
          </PopoverContent>
        </Popover>
        <Button size="sm" className="h-8 text-xs gap-1.5 flex-shrink-0" onClick={() => setQuickAddOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Adicionar
        </Button>
      </div>

      {/* Toolbar row — busca, filtros, ordenação (separado para não cortar abas) */}
      <div className="flex items-center gap-2 flex-wrap">
        <ImpersonationSelector />
        {filters && onFiltersChange && (
          <div className="relative flex-1 min-w-[200px] max-w-[360px]">
            <Search className={cn(
              "absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5",
              darkBg ? "text-white/50" : customBg ? "text-black/40" : "text-muted-foreground"
            )} />
            <Input
              ref={searchRef}
              value={filters.searchTerm || ""}
              onChange={(e) => onFiltersChange({ ...filters, searchTerm: e.target.value })}
              placeholder="Buscar (/) tarefa ou anotação…"
              className={cn(
                "h-8 w-full pl-7 pr-7 text-xs",
                darkBg && "bg-white/10 border-white/20 text-white placeholder:text-white/40",
                customBg && "bg-black/5 border-black/15 text-black placeholder:text-black/40"
              )}
            />
            {filters.searchTerm && (
              <button
                type="button"
                onClick={() => onFiltersChange({ ...filters, searchTerm: "" })}
                className={cn(
                  "absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted",
                  darkBg && "hover:bg-white/15"
                )}
                aria-label="Limpar busca"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
        <FilterButton
          filters={filters}
          onFiltersChange={onFiltersChange || (() => {})}
          teamMembers={teamMembers}
          canaisDisponiveis={canaisDisponiveis}
          btnClassName={btnHover}
        />
        <SortButton
          sort={sort}
          onSortChange={onSortChange || (() => {})}
          btnClassName={btnHover}
        />
      </div>

      {/* Chips de filtros ativos */}
      {filters && onFiltersChange && (
        <ProjetoActiveFiltersBar
          filters={filters}
          onFiltersChange={onFiltersChange}
          teamMembers={teamMembers}
        />
      )}

      <ResumoIADialog
        open={resumoOpen}
        onOpenChange={setResumoOpen}
        projetoId={projeto.id}
        getProjectSummary={getProjectSummary}
        loading={loading === "project_summary"}
      />

      <ProjetoMembrosDialog
        open={membrosOpen}
        onOpenChange={setMembrosOpen}
        projetoId={projeto.id}
        projetoTipo={projeto.tipo || undefined}
      />

      {secoes.length > 0 && onAddTarefa && (
        <QuickAddTaskDialog
          open={quickAddOpen}
          onOpenChange={setQuickAddOpen}
          secoes={secoes}
          onAddTarefa={onAddTarefa}
        />
      )}

      <ProjetoLixeiraDialog
        open={lixeiraOpen}
        onOpenChange={setLixeiraOpen}
        tarefas={tarefasExcluidas}
        loading={tarefasExcluidasLoading}
        onRestaurar={(id) => onRestaurarTarefa?.(id)}
      />

      <SalvarComoModeloDialog
        open={salvarModeloOpen}
        onOpenChange={setSalvarModeloOpen}
        projetoId={projeto.id}
        projetoNome={projeto.nome}
        projetoCor={projeto.cor}
        projetoTipo={projeto.tipo}
      />
    </div>
  );
}
