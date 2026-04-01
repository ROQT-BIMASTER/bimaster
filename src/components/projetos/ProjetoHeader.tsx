import { useState } from "react";
import { Projeto } from "@/hooks/useProjetos";
import { ProjetoTarefa } from "@/hooks/useProjetoTarefas";
import { Button } from "@/components/ui/button";
import { Plus, List, LayoutGrid, Calendar, CalendarDays, BarChart3, FileText, FileSpreadsheet, ShieldCheck, Sparkles, Users, UsersRound, Trash2 } from "lucide-react";
import { ColumnConfigPopover, ColumnConfig } from "./ColumnConfigPopover";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useProjetoIA } from "@/hooks/useProjetoIA";
import { ResumoIADialog } from "./ResumoIADialog";
import { ProjetoHealthPanel } from "./ProjetoHealthPanel";
import { ProjetoMembrosDialog } from "./ProjetoMembrosDialog";
import { FilterButton, SortButton, ProjetoFilters, ProjetoSort, EMPTY_FILTERS, DEFAULT_SORT } from "./ProjetoFilterSort";
import { QuickAddTaskDialog } from "./QuickAddTaskDialog";
import { ProjetoLixeiraDialog } from "./ProjetoLixeiraDialog";
import { Separator } from "@/components/ui/separator";

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
  onRestaurarTarefa?: (tarefaId: string) => void;
}

const WORK_TABS = [
  { value: "lista", icon: List, label: "Lista" },
  { value: "quadro", icon: LayoutGrid, label: "Quadro" },
  { value: "cronograma", icon: Calendar, label: "Cronograma" },
  { value: "calendario", icon: CalendarDays, label: "Calendário" },
];

const MANAGE_TABS = [
  { value: "painel", icon: BarChart3, label: "Painel" },
  { value: "briefings", icon: FileSpreadsheet, label: "Briefings" },
  { value: "equipe", icon: UsersRound, label: "Equipe" },
  { value: "arquivos", icon: FileText, label: "Arquivos" },
];

export function ProjetoHeader({
  projeto, activeTab, onTabChange, tarefas = [], customBg = false, darkBg = false,
  filters = EMPTY_FILTERS, onFiltersChange, sort = DEFAULT_SORT, onSortChange,
  teamMembers = [], secoes = [], onAddTarefa,
  tarefasExcluidas = [], tarefasExcluidasLoading, onRestaurarTarefa,
}: ProjetoHeaderProps) {
  const textColor = darkBg ? "text-white" : customBg ? "text-black" : "";
  const textMuted = darkBg ? "text-white/70" : customBg ? "text-black/70" : "text-muted-foreground";
  const btnHover = darkBg ? "text-white border-white/30 hover:bg-white/10" : customBg ? "text-black border-black/20 hover:bg-black/10" : "";
  const navigate = useNavigate();
  const { getProjectSummary, loading } = useProjetoIA();
  const [resumoOpen, setResumoOpen] = useState(false);
  const [membrosOpen, setMembrosOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [lixeiraOpen, setLixeiraOpen] = useState(false);

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
              className={cn("h-8 w-8 rounded-full relative", btnHover || "hover:bg-muted")}
              onClick={() => setLixeiraOpen(true)}
              title="Lixeira"
            >
              <Trash2 className="h-4 w-4" />
              {tarefasExcluidas.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full h-3.5 min-w-3.5 flex items-center justify-center px-0.5">
                  {tarefasExcluidas.length}
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* Health panel inside hero */}
        {tarefas.length > 0 && (
          <div className="mt-4">
            <ProjetoHealthPanel tarefas={tarefas} darkBg={darkBg} />
          </div>
        )}
      </div>

      {/* Tabs + toolbar */}
      <div className="flex items-center justify-between">
        <div className={cn(
          "flex items-center gap-1 rounded-lg p-1",
          darkBg ? "bg-white/10" : customBg ? "bg-black/10" : "bg-muted"
        )}>
          {/* Work tabs */}
          {WORK_TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.value} onClick={() => onTabChange(tab.value)} className={tabCls(activeTab === tab.value)}>
                <Icon className="h-3.5 w-3.5" /> {tab.label}
              </button>
            );
          })}

          {/* Separator */}
          <div className={cn("w-px h-5 mx-1", darkBg ? "bg-white/20" : customBg ? "bg-black/15" : "bg-border")} />

          {/* Management tabs */}
          {MANAGE_TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.value} onClick={() => onTabChange(tab.value)} className={tabCls(activeTab === tab.value)}>
                <Icon className="h-3.5 w-3.5" /> {tab.label}
              </button>
            );
          })}

          {/* External link: Aprovações */}
          <button
            onClick={() => navigate("/dashboard/projetos/aprovacoes")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors",
              darkBg ? "text-white/50 hover:text-white hover:bg-white/10" : customBg ? "text-black/40 hover:text-black hover:bg-black/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <ShieldCheck className="h-3.5 w-3.5" /> Aprovações
          </button>
        </div>

        <div className="flex items-center gap-2">
          <FilterButton
            filters={filters}
            onFiltersChange={onFiltersChange || (() => {})}
            teamMembers={teamMembers}
            btnClassName={btnHover}
          />
          <SortButton
            sort={sort}
            onSortChange={onSortChange || (() => {})}
            btnClassName={btnHover}
          />
          <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => setQuickAddOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Adicionar
          </Button>
        </div>
      </div>

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
    </div>
  );
}
