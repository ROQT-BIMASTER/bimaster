import { memo, useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useMinhasTarefas, groupTarefas, type MinaTarefa } from "@/hooks/useMinhasTarefas";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2, ChevronDown, ChevronRight, LayoutList, LayoutGrid,
  Search, Calendar, Filter, Plus, Flag, Clock, Zap, X, Eye, EyeOff,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useCentralPreferences } from "@/hooks/useCentralPreferences";
import {
  normalizeView,
  normalizePriority,
  normalizeProject,
  normalizeFilter,
  normalizeSearch,
  normalizeSort,
  type CentralView,
  type CentralSort,
} from "@/lib/centralUrlParams";
import { NovaTarefaMinhasDialog } from "@/components/projetos/NovaTarefaMinhasDialog";
import {
  reasonFromChangedFields,
  rememberReason,
  readReason,
  type CentralSaveReason,
} from "@/lib/centralSaveReason";
import { ProjetoTarefaDetalhe } from "@/components/projetos/ProjetoTarefaDetalhe";
import { MinhasTarefasBoard } from "@/components/minhas-tarefas/MinhasTarefasBoard";
import { MinhasTarefasCalendar } from "@/components/minhas-tarefas/MinhasTarefasCalendar";
import { CustomDashboardBuilder } from "@/components/minhas-tarefas/CustomDashboardBuilder";
import { ResumoSemanal } from "@/components/projetos/central/ResumoSemanal";

import { BarChart3 } from "lucide-react";
import type { ProjetoTarefa, ProjetoSecao } from "@/hooks/useProjetoTarefas";

const ListRow = memo(function ListRow({
  tarefa, onToggle, onSelect, selected, onSelectToggle,
}: {
  tarefa: MinaTarefa;
  onToggle: (id: string, done: boolean) => void;
  onSelect: (t: MinaTarefa) => void;
  selected: boolean;
  onSelectToggle: (id: string) => void;
}) {
  const isDone = tarefa.status === "concluida";
  const isOverdue = !isDone && tarefa.data_prazo && new Date(tarefa.data_prazo) < new Date();

  return (
    <div
      className={`flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors cursor-pointer border-b border-border/20 last:border-b-0 group ${selected ? "bg-primary/5" : ""}`}
      onClick={() => onSelect(tarefa)}
    >
      <Checkbox
        checked={selected}
        onCheckedChange={() => onSelectToggle(tarefa.id)}
        onClick={(e) => e.stopPropagation()}
        className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity data-[state=checked]:opacity-100"
      />
      <Checkbox
        checked={isDone}
        onCheckedChange={(checked) => onToggle(tarefa.id, !!checked)}
        onClick={(e) => e.stopPropagation()}
        className="rounded-full h-4 w-4"
      />
      <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: tarefa.projeto_cor }} />
      <div className="flex-1 min-w-0 flex items-center gap-4">
        <span className={`text-sm truncate ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>
          {tarefa.titulo}
        </span>
        <span
          className="text-xs hidden lg:inline-flex items-center min-w-0 max-w-[45%] truncate"
          title={tarefa.secao_nome ? `${tarefa.secao_nome} · ${tarefa.projeto_nome}` : tarefa.projeto_nome}
        >
          {tarefa.secao_nome && (
            <>
              <span className="text-foreground/80 font-medium truncate">{tarefa.secao_nome}</span>
              <span className="text-muted-foreground px-1">·</span>
            </>
          )}
          <span className="text-muted-foreground truncate">{tarefa.projeto_nome}</span>
        </span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {tarefa.prioridade && tarefa.prioridade !== "media" && (
          <Badge
            variant={tarefa.prioridade === "alta" || tarefa.prioridade === "urgente" ? "destructive" : "outline"}
            className="text-[10px] h-4 hidden sm:flex"
          >
            {tarefa.prioridade === "alta" ? "Alta" : tarefa.prioridade === "urgente" ? "Urgente" : "Baixa"}
          </Badge>
        )}
        {tarefa.data_prazo && (
          <span className={`text-xs ${isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
            {format(new Date(tarefa.data_prazo), "d MMM", { locale: ptBR })}
          </span>
        )}
      </div>
    </div>
  );
});

const ListSection = memo(function ListSection({
  group, onToggle, onSelect, selectedIds, onSelectToggle,
}: {
  group: { label: string; key: string; items: MinaTarefa[] };
  onToggle: (id: string, done: boolean) => void;
  onSelect: (t: MinaTarefa) => void;
  selectedIds: Set<string>;
  onSelectToggle: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(group.key === "concluidas");

  const sectionStyles: Record<string, string> = {
    atrasadas: "text-destructive",
    hoje: "text-primary",
    semana: "text-foreground",
    mais_tarde: "text-muted-foreground",
    sem_data: "text-muted-foreground",
    concluidas: "text-success",
  };

  return (
    <div>
      <button
        className="flex items-center gap-2 w-full px-4 py-2 bg-muted/30 border-b border-border/30 hover:bg-muted/50 transition-colors"
        onClick={() => setCollapsed(!collapsed)}
      >
        {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        <span className={`text-xs font-semibold uppercase tracking-wider ${sectionStyles[group.key] || ""}`}>
          {group.label}
        </span>
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 ml-1">
          {group.items.length}
        </Badge>
      </button>
      {!collapsed &&
        group.items.map((t) => (
          <ListRow
            key={t.id}
            tarefa={t}
            onToggle={onToggle}
            onSelect={onSelect}
            selected={selectedIds.has(t.id)}
            onSelectToggle={onSelectToggle}
          />
        ))}
    </div>
  );
});

interface Props {
  initialFilter?: "atrasadas" | "hoje" | "sem_data" | null;
}

export function MinhasTarefasContent({ initialFilter = null }: Props) {
  const { data: tarefas = [], isLoading } = useMinhasTarefas();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { preferences, save: savePrefs, isSaving } = useCentralPreferences();

  // Normalize all incoming params; invalid values fall back to defaults.
  const initialView: CentralView = normalizeView(
    searchParams.get("view"),
    normalizeView(preferences.default_view, "list")
  );

  const [view, setView] = useState<CentralView>(initialView);
  const [search, setSearch] = useState(normalizeSearch(searchParams.get("q")));
  const [filterPriority, setFilterPriority] = useState<string>(
    normalizePriority(
      searchParams.get("priority"),
      normalizePriority(preferences.default_priority, "all")
    )
  );
  const [filterProject, setFilterProject] = useState<string>(
    normalizeProject(
      searchParams.get("project"),
      normalizeProject(preferences.default_project, "all")
    )
  );
  const [filterTime, setFilterTime] = useState<string>(
    initialFilter ||
      normalizeFilter(
        searchParams.get("filter"),
        normalizeFilter(preferences.default_filter, "all")
      )
  );
  // Sort param: only "default" or "urgent". Drives the urgency-grouped view
  // when the user enters via the "Atrasadas" KPI shortcut.
  const [sortMode, setSortMode] = useState<CentralSort>(
    normalizeSort(searchParams.get("sort"), "default"),
  );
  const [showNewTask, setShowNewTask] = useState(false);
  const [detailTarefa, setDetailTarefa] = useState<MinaTarefa | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showWeeklySummary, setShowWeeklySummary] = useState<boolean>(
    preferences.show_weekly_summary ?? true,
  );
  const queryClient = useQueryClient();

  // Re-hydrate state from preferences when they (re)load — covers account switch
  // and realtime updates from other devices. URL params always win over prefs.
  useEffect(() => {
    if (!preferences.updated_at) return;
    if (!searchParams.get("view")) {
      setView(normalizeView(preferences.default_view, "list"));
    }
    if (!searchParams.get("priority")) {
      setFilterPriority(normalizePriority(preferences.default_priority, "all"));
    }
    if (!searchParams.get("project")) {
      setFilterProject(normalizeProject(preferences.default_project, "all"));
    }
    if (!searchParams.get("filter") && !initialFilter) {
      setFilterTime(normalizeFilter(preferences.default_filter, "all"));
    }
    if (typeof preferences.show_weekly_summary === "boolean") {
      setShowWeeklySummary(preferences.show_weekly_summary);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferences.updated_at, user?.id]);

  // React to URL changes for params we don't drive locally on every render
  // (e.g. when CentralKPIs navigates with `?sort=urgent`).
  useEffect(() => {
    const urlSort = normalizeSort(searchParams.get("sort"), "default");
    if (urlSort !== sortMode) setSortMode(urlSort);
    const urlFilter = normalizeFilter(searchParams.get("filter"), "all");
    if (urlFilter !== filterTime) setFilterTime(urlFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Sync state to URL (preserves tab and other params), always normalized.
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    const setOrDelete = (key: string, value: string, defaultValue: string) => {
      if (value && value !== defaultValue) params.set(key, value);
      else params.delete(key);
    };
    setOrDelete("view", normalizeView(view, "list"), "list");
    setOrDelete("q", normalizeSearch(search), "");
    setOrDelete("priority", normalizePriority(filterPriority, "all"), "all");
    setOrDelete("project", normalizeProject(filterProject, "all"), "all");
    setOrDelete("filter", normalizeFilter(filterTime, "all"), "all");
    setOrDelete("sort", normalizeSort(sortMode, "default"), "default");
    if (params.toString() !== searchParams.toString()) {
      setSearchParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, search, filterPriority, filterProject, filterTime, sortMode]);

  // Persist preferences (debounced) when they change
  useEffect(() => {
    const timer = setTimeout(() => {
      const updates: Record<string, string | boolean> = {};
      const changed: Array<
        "default_view" | "default_filter" | "default_priority" | "default_project"
      > = [];
      if (view !== preferences.default_view) {
        updates.default_view = view;
        changed.push("default_view");
      }
      if (filterPriority !== preferences.default_priority) {
        updates.default_priority = filterPriority;
        changed.push("default_priority");
      }
      if (filterProject !== preferences.default_project) {
        updates.default_project = filterProject;
        changed.push("default_project");
      }
      if (filterTime !== preferences.default_filter) {
        updates.default_filter = filterTime;
        changed.push("default_filter");
      }
      if (showWeeklySummary !== (preferences.show_weekly_summary ?? true)) {
        updates.show_weekly_summary = showWeeklySummary;
      }
      if (Object.keys(updates).length > 0) {
        // Tag the cause BEFORE the save fires so the indicator can reflect
        // the real reason as soon as updated_at lands from the server.
        rememberReason(user?.id, reasonFromChangedFields(changed));
        savePrefs(updates as any);
      }
    }, 800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, filterPriority, filterProject, filterTime, showWeeklySummary]);

  // Last-save reason cache for the audit indicator. Re-reads from storage
  // whenever `updated_at` changes (i.e., when a save round-trip completes).
  const [lastReason, setLastReason] = useState<CentralSaveReason | null>(() =>
    readReason(user?.id)
  );
  useEffect(() => {
    setLastReason(readReason(user?.id));
  }, [preferences.updated_at, user?.id]);

  const bridgedTarefa: ProjetoTarefa | null = useMemo(() => {
    if (!detailTarefa) return null;
    return {
      id: detailTarefa.id,
      projeto_id: detailTarefa.projeto_id,
      secao_id: detailTarefa.secao_id || "",
      parent_tarefa_id: detailTarefa.parent_tarefa_id,
      titulo: detailTarefa.titulo,
      descricao: detailTarefa.descricao,
      responsavel_id: detailTarefa.responsavel_id,
      criador_id: detailTarefa.criador_id,
      status: detailTarefa.status,
      prioridade: detailTarefa.prioridade || "media",
      data_prazo: detailTarefa.data_prazo,
      data_conclusao: detailTarefa.data_conclusao,
      codigo: detailTarefa.codigo,
      estagio: detailTarefa.estagio,
      visibilidade: detailTarefa.visibilidade || "equipe",
      ordem: detailTarefa.ordem,
      created_at: detailTarefa.created_at,
      updated_at: detailTarefa.updated_at,
      produto_id: detailTarefa.produto_id,
    };
  }, [detailTarefa]);

  const selectedProjetoId = detailTarefa?.projeto_id;
  const { data: bridgedSecoes = [] } = useQuery({
    queryKey: ["projeto-secoes-bridge", selectedProjetoId],
    queryFn: async () => {
      const { data } = await supabase
        .from("projeto_secoes")
        .select("*")
        .eq("projeto_id", selectedProjetoId!)
        .order("ordem");
      return (data || []) as ProjetoSecao[];
    },
    enabled: !!selectedProjetoId && detailOpen,
    staleTime: 60_000,
  });

  const handleBridgeUpdate = useCallback(async (id: string, updates: Partial<ProjetoTarefa>) => {
    const { error } = await supabase.from("projeto_tarefas").update(updates as any).eq("id", id);
    if (error) { toast.error("Erro ao atualizar"); return; }
    queryClient.invalidateQueries({ queryKey: ["minhas-tarefas"] });
    if (detailTarefa) setDetailTarefa({ ...detailTarefa, ...updates } as MinaTarefa);
  }, [queryClient, detailTarefa]);

  const handleBridgeToggle = useCallback(async (t: ProjetoTarefa) => {
    const done = t.status !== "concluida";
    const update: Record<string, any> = { status: done ? "concluida" : "pendente" };
    update.data_conclusao = done ? new Date().toISOString() : null;
    const { error } = await supabase.from("projeto_tarefas").update(update).eq("id", t.id);
    if (error) { toast.error("Erro ao atualizar"); return; }
    queryClient.invalidateQueries({ queryKey: ["minhas-tarefas"] });
    toast.success(done ? "Tarefa concluida" : "Tarefa reaberta");
  }, [queryClient]);

  const handleBridgeAddSubtarefa = useCallback(async (titulo: string, parentId: string, secaoId: string) => {
    if (!user?.id || !selectedProjetoId) return;
    const { error } = await supabase.from("projeto_tarefas").insert({
      titulo, parent_tarefa_id: parentId, secao_id: secaoId,
      projeto_id: selectedProjetoId, responsavel_id: user.id,
      status: "pendente", prioridade: "media", ordem: 999,
    });
    if (error) { toast.error("Erro ao criar subtarefa"); return; }
    queryClient.invalidateQueries({ queryKey: ["minhas-tarefas"] });
    toast.success("Subtarefa criada");
  }, [queryClient, user?.id, selectedProjetoId]);

  const handleBridgeMoveTarefa = useCallback(async (tarefaId: string, _o: string, secaoDestinoId: string) => {
    const { error } = await supabase.from("projeto_tarefas").update({ secao_id: secaoDestinoId }).eq("id", tarefaId);
    if (error) { toast.error("Erro ao mover tarefa"); return; }
    queryClient.invalidateQueries({ queryKey: ["minhas-tarefas"] });
    toast.success("Tarefa movida");
  }, [queryClient]);

  const projects = useMemo(() => {
    const map = new Map<string, { id: string; nome: string; cor: string }>();
    tarefas.forEach((t) => map.set(t.projeto_id, { id: t.projeto_id, nome: t.projeto_nome, cor: t.projeto_cor }));
    return Array.from(map.values());
  }, [tarefas]);

  const filtered = useMemo(() => {
    let result = tarefas;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((t) => t.titulo.toLowerCase().includes(q) || t.projeto_nome.toLowerCase().includes(q));
    }
    if (filterPriority !== "all") result = result.filter((t) => t.prioridade === filterPriority);
    if (filterProject !== "all") result = result.filter((t) => t.projeto_id === filterProject);
    if (filterTime === "atrasadas") {
      const now = new Date();
      result = result.filter(t => t.status !== "concluida" && t.data_prazo && new Date(t.data_prazo) < now);
    } else if (filterTime === "hoje") {
      result = result.filter(t => {
        if (t.status === "concluida" || !t.data_prazo) return false;
        return new Date(t.data_prazo).toDateString() === new Date().toDateString();
      });
    } else if (filterTime === "sem_data") {
      result = result.filter(t => t.status !== "concluida" && !t.data_prazo);
    }
    return result;
  }, [tarefas, search, filterPriority, filterProject, filterTime]);

  // Priority weight: higher = more urgent. Drives the "Próxima ação" sort.
  const PRIORITY_WEIGHT: Record<string, number> = {
    urgente: 4,
    alta: 3,
    media: 2,
    baixa: 1,
  };

  const groups = useMemo(() => {
    if (sortMode === "urgent") {
      // Single flat section ordered by priority desc, then by oldest prazo first
      // (most overdue), then by created_at as a stable tiebreaker. Pendentes first;
      // concluídas (caso filtros permitam) ficam ao final.
      const sorted = [...filtered].sort((a, b) => {
        const aDone = a.status === "concluida" ? 1 : 0;
        const bDone = b.status === "concluida" ? 1 : 0;
        if (aDone !== bDone) return aDone - bDone;
        const aP = PRIORITY_WEIGHT[a.prioridade || "media"] ?? 2;
        const bP = PRIORITY_WEIGHT[b.prioridade || "media"] ?? 2;
        if (aP !== bP) return bP - aP;
        const aD = a.data_prazo ? new Date(a.data_prazo).getTime() : Number.POSITIVE_INFINITY;
        const bD = b.data_prazo ? new Date(b.data_prazo).getTime() : Number.POSITIVE_INFINITY;
        if (aD !== bD) return aD - bD;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
      const label =
        filterTime === "atrasadas"
          ? "Atrasadas — por urgência e prazo"
          : "Próxima ação — por urgência e prazo";
      return sorted.length > 0 ? [{ label, key: "urgent", items: sorted }] : [];
    }
    return groupTarefas(filtered);
  }, [filtered, sortMode, filterTime]);

  const handleToggle = useCallback(async (tarefaId: string, done: boolean) => {
    const update: Record<string, any> = { status: done ? "concluida" : "pendente" };
    update.data_conclusao = done ? new Date().toISOString() : null;
    const { error } = await supabase.from("projeto_tarefas").update(update).eq("id", tarefaId);
    if (error) { toast.error("Erro ao atualizar tarefa"); return; }
    queryClient.invalidateQueries({ queryKey: ["minhas-tarefas"] });
    toast.success(done ? "Tarefa concluída! ✓" : "Tarefa reaberta");
  }, [queryClient]);

  const handleSelectTask = useCallback((t: MinaTarefa) => {
    setDetailTarefa(t);
    setDetailOpen(true);
  }, []);

  const handleSelectToggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleBulkComplete = async () => {
    const ids = Array.from(selectedIds);
    const { error } = await supabase
      .from("projeto_tarefas")
      .update({ status: "concluida", data_conclusao: new Date().toISOString() })
      .in("id", ids);
    if (error) { toast.error("Erro ao concluir tarefas"); return; }
    queryClient.invalidateQueries({ queryKey: ["minhas-tarefas"] });
    toast.success(`${ids.length} tarefas concluídas!`);
    setSelectedIds(new Set());
  };

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex items-center justify-end gap-2 flex-wrap min-h-[36px]">
        <Button size="sm" className="gap-1.5 h-9" onClick={() => setShowNewTask(true)}>
          <Plus className="h-4 w-4" /> Nova Tarefa
        </Button>
        {view === "list" && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 h-9 text-xs"
            onClick={() => setShowWeeklySummary((v) => !v)}
            title={showWeeklySummary ? "Ocultar resumo semanal" : "Mostrar resumo semanal"}
          >
            {showWeeklySummary ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {showWeeklySummary ? "Ocultar resumo" : "Mostrar resumo"}
          </Button>
        )}
        <Tabs value={view} onValueChange={(v) => setView(v as any)} className="max-w-full">
          <TabsList className="h-9 overflow-x-auto max-w-full justify-start [&::-webkit-scrollbar]:hidden">
            <TabsTrigger value="list" className="text-xs gap-1 px-2.5 h-7 shrink-0">
              <LayoutList className="h-3.5 w-3.5" /> Lista
            </TabsTrigger>
            <TabsTrigger value="board" className="text-xs gap-1 px-2.5 h-7 shrink-0">
              <LayoutGrid className="h-3.5 w-3.5" /> Quadro
            </TabsTrigger>
            <TabsTrigger value="calendar" className="text-xs gap-1 px-2.5 h-7 shrink-0">
              <Calendar className="h-3.5 w-3.5" /> Calendário
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="text-xs gap-1 px-2.5 h-7 shrink-0">
              <BarChart3 className="h-3.5 w-3.5" /> Dashboard
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar tarefas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
        <Select value={filterTime} onValueChange={setFilterTime}>
          <SelectTrigger className="w-[140px] h-9 text-xs">
            <Calendar className="h-3.5 w-3.5 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os prazos</SelectItem>
            <SelectItem value="atrasadas">Atrasadas</SelectItem>
            <SelectItem value="hoje">Hoje</SelectItem>
            <SelectItem value="sem_data">Sem prazo</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-[140px] h-9 text-xs">
            <Flag className="h-3.5 w-3.5 mr-1" />
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="urgente">Urgente</SelectItem>
            <SelectItem value="alta">Alta</SelectItem>
            <SelectItem value="media">Média</SelectItem>
            <SelectItem value="baixa">Baixa</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="w-[170px] h-9 text-xs">
            <Filter className="h-3.5 w-3.5 mr-1" />
            <SelectValue placeholder="Projeto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os projetos</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: p.cor }} />
                  {p.nome}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(preferences.updated_at || isSaving) && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="ml-auto flex max-w-[320px] items-center gap-1.5 truncate text-[11px] text-muted-foreground px-2 py-1 rounded-md border border-border/40 bg-muted/20 transition-opacity duration-700 ease-in-out"
                  style={
                    isSaving
                      ? { animation: "pulse 3.5s cubic-bezier(0.4, 0, 0.6, 1) infinite" }
                      : undefined
                  }
                  aria-live="polite"
                >
                  <Clock className="h-3 w-3 shrink-0" />
                  {isSaving ? (
                    <span className="truncate">Salvando preferências...</span>
                  ) : (
                    <span className="truncate">
                      Preferências atualizadas{" "}
                      {formatDistanceToNow(new Date(preferences.updated_at!), {
                        locale: ptBR,
                        addSuffix: true,
                      })}
                      {lastReason ? ` — ${lastReason.label}` : ""}
                    </span>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs space-y-1">
                <div className="font-medium">
                  {preferences.updated_at
                    ? format(new Date(preferences.updated_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })
                    : "Salvamento em andamento"}
                </div>
                {lastReason && (
                  <div className="text-xs text-muted-foreground">
                    Causa: {lastReason.label}
                  </div>
                )}
                {lastReason && (
                  <div className="text-[10px] text-muted-foreground/80">
                    Disparado em{" "}
                    {format(new Date(lastReason.at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                  </div>
                )}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-primary/5 border border-primary/20 rounded-lg animate-in fade-in slide-in-from-bottom-2">
          <Badge variant="secondary" className="text-xs">{selectedIds.size} selecionadas</Badge>
          <Button size="sm" variant="default" className="h-7 text-xs gap-1" onClick={handleBulkComplete}>
            <CheckCircle2 className="h-3.5 w-3.5" /> Concluir
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedIds(new Set())}>
            Limpar seleção
          </Button>
        </div>
      )}

      {sortMode === "urgent" && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-destructive/5 border border-destructive/30 rounded-lg animate-in fade-in slide-in-from-top-1">
          <Zap className="h-4 w-4 text-destructive shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              Ordenado por urgência e prazo
            </p>
            <p className="text-xs text-muted-foreground">
              {filterTime === "atrasadas"
                ? "Tarefas atrasadas das mais críticas (urgente + prazo mais antigo) para as menos críticas."
                : "Lista plana ordenada por prioridade e data de prazo — use para focar na próxima ação."}
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs gap-1"
            onClick={() => setSortMode("default")}
          >
            <X className="h-3.5 w-3.5" /> Limpar ordenação
          </Button>
        </div>
      )}

      <div>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
          </div>
        ) : view === "list" ? (
          <div className="space-y-4">
            {showWeeklySummary && (
              <ResumoSemanal
                tarefas={filtered}
                loading={isLoading}
                onHide={() => setShowWeeklySummary(false)}
              />
            )}
            <Card className="overflow-hidden">
            <CardContent className="p-0">
              {groups.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mb-4">
                    <CheckCircle2 className="h-8 w-8 text-success" />
                  </div>
                  <p className="font-semibold text-foreground">Tudo em dia! 🎉</p>
                  <p className="text-sm mt-1">Nenhuma tarefa encontrada com os filtros atuais.</p>
                  <Button variant="outline" className="mt-4 gap-1.5" onClick={() => setShowNewTask(true)}>
                    <Plus className="h-4 w-4" /> Criar nova tarefa
                  </Button>
                </div>
              ) : (
                groups.map((g) => (
                  <ListSection
                    key={g.key}
                    group={g}
                    onToggle={handleToggle}
                    onSelect={handleSelectTask}
                    selectedIds={selectedIds}
                    onSelectToggle={handleSelectToggle}
                  />
                ))
              )}
            </CardContent>
            </Card>
          </div>
        ) : view === "board" ? (
          <MinhasTarefasBoard tarefas={filtered} onToggle={handleToggle} onSelect={handleSelectTask} />
        ) : view === "calendar" ? (
          <MinhasTarefasCalendar tarefas={filtered} onSelect={handleSelectTask} />
        ) : (
          <CustomDashboardBuilder tarefas={filtered} />
        )}
      </div>

      <NovaTarefaMinhasDialog open={showNewTask} onOpenChange={setShowNewTask} />
      <ProjetoTarefaDetalhe
        tarefa={bridgedTarefa}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onUpdate={handleBridgeUpdate}
        onToggle={handleBridgeToggle}
        onAddSubtarefa={handleBridgeAddSubtarefa}
        secoes={bridgedSecoes}
        onMoveTarefa={handleBridgeMoveTarefa}
        projetoIdOverride={selectedProjetoId}
      />
    </div>
  );
}
