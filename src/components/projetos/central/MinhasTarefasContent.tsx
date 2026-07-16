import { memo, useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useMinhasTarefas, groupTarefas, type MinaTarefa } from "@/hooks/useMinhasTarefas";
import { useMinhasTarefasStats } from "@/hooks/useMinhasTarefasStats";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useTarefaDensity } from "@/hooks/useTarefaDensity";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2, ChevronDown, ChevronRight, LayoutList, LayoutGrid,
  Search, Calendar, Filter, Plus, Flag, Clock, Zap, X, Eye, EyeOff, ListChecks,
  CalendarOff, Users, UserCheck, SlidersHorizontal, User as UserIcon, UserPlus,
  ArrowUpDown,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { STATUS_OPTIONS } from "@/lib/projetoConstants";
import { useSystemProfiles } from "@/hooks/useSystemProfiles";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow, isToday, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseLocalDate, nowSaoPauloISO, getToday } from "@/lib/utils/parseLocalDate";
import { isSemDatasPlanejadas } from "@/lib/utils/tarefaPlanejamento";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TarefaResponsavelAvatar } from "@/components/projetos/shared/TarefaResponsavelAvatar";
import { supabase } from "@/integrations/supabase/client";
import { makeOpenSubtarefaHandler } from "@/lib/tarefas/openSubtarefaHandler";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useBridgeSaveRetry } from "@/hooks/useBridgeSaveRetry";
import { useAuth } from "@/contexts/AuthContext";
import { useCentralPreferences } from "@/hooks/useCentralPreferences";
import {
  normalizeView,
  normalizePriority,
  normalizeProject,
  normalizeFilter,
  normalizeSearch,
  normalizeSort,
  normalizeRole,
  type CentralView,
  type CentralSort,
  type CentralRole,
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
import { PapelExplicativoBanner } from "@/components/projetos/central/PapelExplicativoBanner";
import { PapelChangeBanner } from "@/components/projetos/central/PapelChangeBanner";
import { RoleOverviewCard } from "@/components/projetos/central/RoleOverviewCard";
import { QuickCommentPopover } from "@/components/projetos/central/QuickCommentPopover";
import { useTarefaMessageCounts } from "@/hooks/useTarefaMessageCounts";
import { useManualPriorityOrder, applyManualOrder } from "@/hooks/useManualPriorityOrder";
import { ManualPrioritySortable } from "@/components/projetos/central/ManualPrioritySortable";
import { CentralToolbarPortal, CentralChipsPortal } from "@/components/projetos/central/CentralLayout";
import { CentralChip } from "@/components/projetos/central/CentralChips";

import { BarChart3, RotateCcw, Trash2 } from "lucide-react";
import type { ProjetoTarefa, ProjetoSecao } from "@/hooks/useProjetoTarefas";
import { registrarAuditoriaTarefa } from "@/lib/projetos/auditoriaTarefa";
import { acquireDetailGate, releaseDetailGate } from "@/hooks/projetoTarefasOpenGate";
import { createContext, useContext } from "react";
import {
  useProcessoOperacionalMap,
  type ProcessoOperacionalTag,
} from "@/hooks/suporte/useProcessoOperacionalMap";
import { ProcessoOperacionalBadge } from "@/components/suporte/ProcessoOperacionalBadge";
import { SLACountdownPill } from "@/components/projetos/SLACountdownPill";

const ProcessoTagMapCtx = createContext<Map<string, ProcessoOperacionalTag> | null>(null);
const useProcessoTag = (id: string) => useContext(ProcessoTagMapCtx)?.get(id) ?? null;

const ListRow = memo(function ListRow({
  tarefa, onToggle, onSelect, selected, onSelectToggle, messageCount,
}: {
  tarefa: MinaTarefa;
  onToggle: (id: string, done: boolean) => void;
  onSelect: (t: MinaTarefa) => void;
  selected: boolean;
  onSelectToggle: (id: string) => void;
  messageCount: number;
}) {
  const isDone = tarefa.status === "concluida";
  const isOverdue = !isDone && tarefa.data_prazo && new Date(tarefa.data_prazo) < new Date();
  const processoTag = useProcessoTag(tarefa.id);

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
        {processoTag && <ProcessoOperacionalBadge tag={processoTag} compact />}
        {tarefa.papel === "responsavel" && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className="shrink-0 gap-1 border-primary/40 bg-primary/5 text-primary text-[10px] h-5 px-1.5"
                >
                  <UserCheck className="h-3 w-3" />
                  Sou responsável
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                Você é o responsável por entregar esta tarefa.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {tarefa.papel === "colaborador" && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className="shrink-0 gap-1 border-info/40 bg-info/5 text-info text-[10px] h-5 px-1.5"
                >
                  <Users className="h-3 w-3" />
                  Colaborando
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                Você foi adicionado como colaborador. Outra pessoa é a
                responsável por entregar esta tarefa.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {tarefa.papel === "seguidor" && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className="shrink-0 gap-1 border-muted-foreground/40 bg-muted/40 text-muted-foreground text-[10px] h-5 px-1.5"
                >
                  <Eye className="h-3 w-3" />
                  Seguindo
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                Você acompanha esta tarefa como seguidor.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {/* "Criada por mim" removido: tarefas criadas sem envolvimento direto
            ficam agora na aba "Delegadas por mim" (padrão Asana/Jira). */}

        {tarefa.ticket_protocolo && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className="shrink-0 gap-1 text-[10px] h-5 px-1.5 font-mono border-border/60"
                >
                  {tarefa.ticket_protocolo}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                {tarefa.ticket_fila_nome ? `Fila: ${tarefa.ticket_fila_nome}` : "Ticket vinculado"}
                {tarefa.ticket_status ? ` · Etapa: ${tarefa.ticket_status.replace(/_/g, " ")}` : ""}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {tarefa.ticket_sla_status && tarefa.ticket_sla_status !== "dentro" && (
          <Badge
            variant="outline"
            className={
              "shrink-0 text-[10px] h-5 px-1.5 " +
              (tarefa.ticket_sla_status === "violado"
                ? "border-red-500/40 bg-red-500/10 text-red-700"
                : tarefa.ticket_sla_status === "em_risco"
                ? "border-orange-500/40 bg-orange-500/10 text-orange-700"
                : tarefa.ticket_sla_status === "cumprido"
                ? "border-green-500/40 bg-green-500/10 text-green-700"
                : "border-border/60 bg-muted text-muted-foreground")
            }
          >
            SLA {tarefa.ticket_sla_status === "em_risco" ? "em risco" : tarefa.ticket_sla_status}
          </Badge>
        )}
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
        {isSemDatasPlanejadas(tarefa) && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="shrink-0 gap-1 animate-pulse-slow border-warning/60 text-warning text-[10px] h-5 px-1.5">
                  <CalendarOff className="h-3 w-3" />
                  Sem datas
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="left">
                Defina data de início e prazo final para priorizar esta tarefa
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <TarefaResponsavelAvatar
          responsavelId={tarefa.responsavel_id}
          nome={tarefa.responsavel_nome}
          avatarUrl={tarefa.responsavel_avatar_url}
          size="xs"
        />
        {(processoTag?.sla_limite || tarefa.data_prazo) && (
          <SLACountdownPill
            deadline={processoTag?.sla_limite ?? tarefa.data_prazo}
            size="sm"
            frozen={isDone}
            completedAt={(tarefa as any).data_conclusao ?? null}
            sourceLabel={
              processoTag
                ? `Definido pelo processo: ${processoTag.processo_nome}`
                : "Prazo do projeto"
            }
          />
        )}
        <QuickCommentPopover tarefaId={tarefa.id} count={messageCount} />
      </div>
    </div>
  );
});

const ListSection = memo(function ListSection({
  group, onToggle, onSelect, selectedIds, onSelectToggle, messageCounts, splitByRole,
}: {
  group: { label: string; key: string; items: MinaTarefa[] };
  onToggle: (id: string, done: boolean) => void;
  onSelect: (t: MinaTarefa) => void;
  selectedIds: Set<string>;
  onSelectToggle: (id: string) => void;
  messageCounts: Record<string, number>;
  splitByRole: boolean;
}) {
  const [collapsed, setCollapsed] = useState(group.key === "concluidas");
  const [collapsedSub, setCollapsedSub] = useState<Record<string, boolean>>({});

  const sectionStyles: Record<string, string> = {
    atrasadas: "text-destructive",
    hoje: "text-primary",
    semana: "text-foreground",
    mais_tarde: "text-muted-foreground",
    sem_data: "text-warning",
    concluidas: "text-success",
  };

  const responsavelItems = useMemo(
    () => group.items.filter((t) => t.papel === "responsavel"),
    [group.items],
  );
  const colaboradorItems = useMemo(
    () => group.items.filter((t) => t.papel === "colaborador"),
    [group.items],
  );
  const seguidorItems = useMemo(
    () => group.items.filter((t) => t.papel === "seguidor"),
    [group.items],
  );



  const renderRow = (t: MinaTarefa) => (
    <ListRow
      key={t.id}
      tarefa={t}
      onToggle={onToggle}
      onSelect={onSelect}
      selected={selectedIds.has(t.id)}
      onSelectToggle={onSelectToggle}
      messageCount={messageCounts[t.id] || 0}
    />
  );

  const renderSubgroup = (
    key: "responsavel" | "colaborador" | "seguidor",
    label: string,
    icon: React.ReactNode,
    items: MinaTarefa[],
  ) => {
    if (items.length === 0) return null;
    const isCollapsed = collapsedSub[key] === true;
    return (
      <div>
        <button
          className="flex items-center gap-2 w-full px-6 py-1.5 bg-muted/10 border-b border-border/20 hover:bg-muted/30 transition-colors"
          onClick={() => setCollapsedSub((s) => ({ ...s, [key]: !isCollapsed }))}
        >
          {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {icon}
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
          <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 ml-1">
            {items.length}
          </Badge>
        </button>
        {!isCollapsed && items.map(renderRow)}
      </div>
    );
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
      {!collapsed && (
        splitByRole && [responsavelItems, colaboradorItems, seguidorItems].filter((items) => items.length > 0).length > 1 ? (
          <>
            {renderSubgroup(
              "responsavel",
              "Como responsável",
              <UserCheck className="h-3 w-3 text-primary" />,
              responsavelItems,
            )}
            {renderSubgroup(
              "colaborador",
              "Como colaborador",
              <Users className="h-3 w-3 text-info" />,
              colaboradorItems,
            )}
            {renderSubgroup(
              "seguidor",
              "Como seguidor",
              <Eye className="h-3 w-3 text-muted-foreground" />,
              seguidorItems,
            )}
          </>
        ) : (
          group.items.map(renderRow)
        )
      )}
    </div>
  );
});

interface Props {
  initialFilter?: "atrasadas" | "hoje" | "sem_data" | "concluidas_hoje" | null;
}

export function MinhasTarefasContent({ initialFilter = null }: Props) {
  const minhasTarefasQuery = useMinhasTarefas();
  const { data: tarefas = [], isLoading } = minhasTarefasQuery;
  const { carregarMaisConcluidas, concluidasExpandidas, isFetching } = minhasTarefasQuery as any;
  const { data: minhasStats } = useMinhasTarefasStats();
  const concluidasNaLista = (tarefas as MinaTarefa[]).filter((t) => t.status === "concluida").length;
  const truncadoConcluidas = !concluidasExpandidas && !!minhasStats && minhasStats.concluidas > concluidasNaLista;
  const { isCompact } = useTarefaDensity();
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
  // Sanitiza preferência salva: `sem_data` é um filtro de exceção e nunca
  // deve abrir a Central como padrão (faria a tela parecer vazia mesmo
  // havendo tarefas). URL/clique do usuário continuam tendo prioridade.
  const sanitizedPrefFilter =
    preferences.default_filter === "sem_data"
      ? "all"
      : normalizeFilter(preferences.default_filter, "all");
  const [filterTime, setFilterTime] = useState<string>(
    initialFilter ||
      normalizeFilter(searchParams.get("filter"), sanitizedPrefFilter)
  );
  // Sort param: only "default" or "urgent". Drives the urgency-grouped view
  // when the user enters via the "Atrasadas" KPI shortcut.
  const [sortMode, setSortMode] = useState<CentralSort>(
    normalizeSort(searchParams.get("sort"), "default"),
  );
  // Filter by user's role on each task.
  const [filterRole, setFilterRole] = useState<CentralRole>(
    normalizeRole(
      searchParams.get("role"),
      normalizeRole(preferences.default_role, "all"),
    ),
  );
  // Advanced filters (kept locally; not persisted to URL/preferences to keep
  // the URL contract stable). Status = projeto_tarefas.status enum subset;
  // responsável = filter by responsavel_id; period = custom prazo range.
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterResponsavel, setFilterResponsavel] = useState<string>("all");
  const [filterDateFrom, setFilterDateFrom] = useState<Date | undefined>(undefined);
  const [filterDateTo, setFilterDateTo] = useState<Date | undefined>(undefined);
  const [advOpen, setAdvOpen] = useState(false);
  const [showNewTask, setShowNewTask] = useState(false);
  const [detailTarefa, setDetailTarefa] = useState<MinaTarefa | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const { isSaving: isBridgeSaving, attemptSave } = useBridgeSaveRetry();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Tarefas com mutação em voo (concluir/reabrir/mudar prazo). Usado pelo Kanban
  // e listas para exibir spinner e desabilitar interação sem "engolir" o clique.
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const markPending = useCallback((ids: string[], on: boolean) => {
    setPendingIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) { if (on) next.add(id); else next.delete(id); }
      return next;
    });
  }, []);
  const [showWeeklySummary, setShowWeeklySummary] = useState<boolean>(
    preferences.show_weekly_summary ?? true,
  );
  const [showRoleOverview, setShowRoleOverview] = useState<boolean>(
    preferences.show_role_overview ?? true,
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
      const pref = normalizeFilter(preferences.default_filter, "all");
      setFilterTime(pref === "sem_data" ? "all" : pref);
    }
    if (!searchParams.get("role")) {
      setFilterRole(normalizeRole(preferences.default_role, "all"));
    }
    if (typeof preferences.show_weekly_summary === "boolean") {
      setShowWeeklySummary(preferences.show_weekly_summary);
    }
    if (typeof preferences.show_role_overview === "boolean") {
      setShowRoleOverview(preferences.show_role_overview);
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
    setOrDelete("role", normalizeRole(filterRole, "all"), "all");
    if (params.toString() !== searchParams.toString()) {
      setSearchParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, search, filterPriority, filterProject, filterTime, sortMode, filterRole]);

  // Persist preferences (debounced) when they change
  useEffect(() => {
    const timer = setTimeout(() => {
      const updates: Record<string, string | boolean> = {};
      const changed: Array<
        "default_view" | "default_filter" | "default_priority" | "default_project" | "default_role"
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
      if (filterRole !== preferences.default_role) {
        updates.default_role = filterRole;
        changed.push("default_role");
      }
      if (showWeeklySummary !== (preferences.show_weekly_summary ?? true)) {
        updates.show_weekly_summary = showWeeklySummary;
      }
      if (showRoleOverview !== (preferences.show_role_overview ?? true)) {
        updates.show_role_overview = showRoleOverview;
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
  }, [view, filterPriority, filterProject, filterTime, filterRole, showWeeklySummary, showRoleOverview]);

  // Last-save reason cache for the audit indicator. Re-reads from storage
  // whenever `updated_at` changes (i.e., when a save round-trip completes).
  const [lastReason, setLastReason] = useState<CentralSaveReason | null>(() =>
    readReason(user?.id)
  );
  useEffect(() => {
    setLastReason(readReason(user?.id));
  }, [preferences.updated_at, user?.id]);

  const selectedProjetoId = detailTarefa?.projeto_id;
  const detailTarefaId = detailTarefa?.id;

  // Gate: enquanto a tarefa estiver aberta na Central, evita refetch ativo
  // de `projeto-tarefas-v2` causando piscar e fechamento colateral do foco.
  useEffect(() => {
    if (!detailOpen || !selectedProjetoId) return;
    acquireDetailGate(selectedProjetoId);
    return () => releaseDetailGate(selectedProjetoId);
  }, [detailOpen, selectedProjetoId]);

  // Reconciliação silenciosa: ao fechar o painel, refaz o fetch da lista
  // uma única vez para alinhar com o servidor sem piscar durante a edição
  // (invalidations dos bridges são `refetchType:"none"` enquanto o painel
  // está aberto).
  const wasDetailOpenRef = useRef(false);
  useEffect(() => {
    if (wasDetailOpenRef.current && !detailOpen) {
      queryClient.refetchQueries({ queryKey: ["minhas-tarefas"], type: "active" });
    }
    wasDetailOpenRef.current = detailOpen;
  }, [detailOpen, queryClient]);



  // Subtarefas ao vivo da tarefa aberta — alimenta o Focus Mode sem precisar
  // fechar/reabrir o modal a cada nova subtarefa.
  const { data: bridgedSubtarefas = [] } = useQuery({
    queryKey: ["projeto-tarefas-subtarefas-bridge", detailTarefaId],
    queryFn: async () => {
      if (!detailTarefaId) return [];
      const { fetchHydratedSubtarefas } = await import("@/lib/projetos/fetchHydratedSubtarefas");
      return fetchHydratedSubtarefas(detailTarefaId);
    },
    enabled: !!detailTarefaId && detailOpen,
    staleTime: 30_000,
  });

  // Junções responsáveis+seguidores da tarefa aberta.
  // A view MinaTarefa só carrega o principal (`responsavel_nome/avatar`), então
  // sem esta consulta o drawer da Central de Trabalho renderiza os arrays
  // vazios e o editor mostra apenas o CTA "Atribuir responsável"/"Adicionar
  // seguidor" (avatares não aparecem). As mutações em `useProjetoTarefas`
  // atualizam esta chave (`tarefa-junctions`) otimisticamente, evitando refetch
  // e o "piscar" ao adicionar/remover pessoa.
  const { data: bridgedJunctions } = useQuery({
    queryKey: ["tarefa-junctions", detailTarefaId],
    queryFn: async () => {
      if (!detailTarefaId) return { responsaveis: [], colaboradores: [] };
      const [respRes, colabRes] = await Promise.all([
        supabase
          .from("projeto_tarefa_responsaveis" as any)
          .select("user_id, papel")
          .eq("tarefa_id", detailTarefaId),
        supabase
          .from("projeto_tarefa_colaboradores")
          .select("user_id")
          .eq("tarefa_id", detailTarefaId),
      ]);
      const respRows = ((respRes as any).data || []) as Array<{ user_id: string; papel: string | null }>;
      const colabRows = ((colabRes as any).data || []) as Array<{ user_id: string }>;
      const ids = Array.from(new Set([
        ...respRows.map(r => r.user_id),
        ...colabRows.map(c => c.user_id),
      ]));
      const profileMap = new Map<string, { nome: string | null; avatar_url: string | null }>();
      if (ids.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, nome, avatar_url")
          .in("id", ids);
        for (const p of (profiles || []) as Array<{ id: string; nome: string | null; avatar_url: string | null }>) {
          profileMap.set(p.id, { nome: p.nome, avatar_url: p.avatar_url });
        }
      }
      return {
        responsaveis: respRows.map(r => ({
          user_id: r.user_id,
          nome: profileMap.get(r.user_id)?.nome || "Membro",
          avatar_url: profileMap.get(r.user_id)?.avatar_url || null,
          papel: r.papel || "responsavel",
        })),
        colaboradores: colabRows.map(c => ({
          user_id: c.user_id,
          nome: profileMap.get(c.user_id)?.nome || "Membro",
          avatar_url: profileMap.get(c.user_id)?.avatar_url || null,
        })),
      };
    },
    enabled: !!detailTarefaId && detailOpen,
    staleTime: 30_000,
  });

  // Campos de planejamento não expostos pela RPC `get_minhas_tarefas_central`
  // (dias_alerta_antes, data_proxima_acao). Sem esta consulta o Select
  // "Alertar antes" cai no default 2 mesmo quando o DB tem outro valor,
  // e o Popover "Próxima ação" abre sempre vazio. Chave separada permite
  // patch otimista sem invalidar a lista principal (evita piscar a tela).
  const { data: bridgedPlanning } = useQuery({
    queryKey: ["tarefa-planning", detailTarefaId],
    queryFn: async () => {
      if (!detailTarefaId) return null;
      const { data } = await supabase
        .from("projeto_tarefas")
        .select("dias_alerta_antes, data_proxima_acao, data_inicio_planejada")
        .eq("id", detailTarefaId)
        .maybeSingle();
      return (data as { dias_alerta_antes: number | null; data_proxima_acao: string | null; data_inicio_planejada: string | null } | null) ?? null;
    },
    enabled: !!detailTarefaId && detailOpen,
    staleTime: 30_000,
  });

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
      responsavel: detailTarefa.responsavel_id
        ? {
            id: detailTarefa.responsavel_id,
            nome: detailTarefa.responsavel_nome || "Membro",
            avatar_url: detailTarefa.responsavel_avatar_url || null,
          }
        : null,
      responsaveis: bridgedJunctions?.responsaveis || [],
      colaboradores: bridgedJunctions?.colaboradores || [],
      criador_id: detailTarefa.criador_id,
      status: detailTarefa.status,
      prioridade: detailTarefa.prioridade || "media",
      data_prazo: detailTarefa.data_prazo,
      // Campos de planejamento também exibidos/editáveis pelo drawer.
      // Sem esses fallbacks o Popover de "Início planejado" nunca reflete o
      // valor após seleção — o DB salva mas a UI mostra placeholder.
      // `dias_alerta_antes` e `data_proxima_acao` vêm de bridgedPlanning
      // (a RPC da lista não os traz) e são sobrescritos otimisticamente
      // por handleBridgeUpdate para eliminar o "travado em 2 dias".
      data_inicio_planejada:
        (detailTarefa as any).data_inicio_planejada
        ?? bridgedPlanning?.data_inicio_planejada
        ?? null,
      data_proxima_acao:
        (detailTarefa as any).data_proxima_acao
        ?? bridgedPlanning?.data_proxima_acao
        ?? null,
      dias_alerta_antes:
        (detailTarefa as any).dias_alerta_antes
        ?? bridgedPlanning?.dias_alerta_antes
        ?? null,
      data_conclusao: detailTarefa.data_conclusao,
      codigo: detailTarefa.codigo,
      estagio: detailTarefa.estagio,
      visibilidade: detailTarefa.visibilidade || "equipe",
      ordem: detailTarefa.ordem,
      created_at: detailTarefa.created_at,
      updated_at: detailTarefa.updated_at,
      produto_id: detailTarefa.produto_id,
      ticket_id: detailTarefa.ticket_id,
      ticket_protocolo: detailTarefa.ticket_protocolo,
      ticket_conversa_id: detailTarefa.ticket_conversa_id,
      subtarefas: bridgedSubtarefas,
    } as ProjetoTarefa;
  }, [detailTarefa, bridgedSubtarefas, bridgedJunctions, bridgedPlanning]);

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
    const isConclusao = (updates as any).status === "concluida";
    const isReabertura = (updates as any).status === "pendente";
    if (isConclusao) {
      const { confirmConclusaoTarefa } = await import("@/lib/projetos/confirmConclusao");
      const ok = await confirmConclusaoTarefa({});
      if (!ok) return;
    }
    // Patch otimista ANTES do await para eliminar o "travado" no Select
    // "Alertar antes" e no Popover "Próxima ação" — o valor selecionado
    // aparece no mesmo frame, sem esperar o round-trip da rede.
    const prevDetail = detailTarefa;
    if (detailTarefa && detailTarefa.id === id) {
      setDetailTarefa({ ...detailTarefa, ...updates } as MinaTarefa);
    }
    if (detailTarefaId === id) {
      queryClient.setQueryData<{ dias_alerta_antes: number | null; data_proxima_acao: string | null; data_inicio_planejada: string | null } | null>(
        ["tarefa-planning", id],
        (old) => ({
          dias_alerta_antes: (updates as any).dias_alerta_antes ?? old?.dias_alerta_antes ?? null,
          data_proxima_acao: (updates as any).data_proxima_acao ?? old?.data_proxima_acao ?? null,
          data_inicio_planejada: (updates as any).data_inicio_planejada ?? old?.data_inicio_planejada ?? null,
        }),
      );
    }
    if (detailTarefaId) {
      queryClient.setQueryData<ProjetoTarefa[]>(["projeto-tarefas-subtarefas-bridge", detailTarefaId], (old = []) =>
        old.map((st) => st.id === id ? ({ ...st, ...updates } as ProjetoTarefa) : st),
      );
    }
    // Também refletimos no cache da Central para o cartão migrar de coluna
    // imediatamente quando a alteração for status (conclusão/reabertura).
    const centralKey = ["minhas-tarefas", user?.id] as const;
    const prevCentral = queryClient.getQueryData<MinaTarefa[]>(centralKey);
    if (prevCentral && (isConclusao || isReabertura)) {
      queryClient.setQueryData<MinaTarefa[]>(centralKey, prevCentral.map((row) =>
        row.id === id
          ? {
              ...row,
              status: (updates as any).status,
              data_conclusao: isConclusao ? nowSaoPauloISO() : null,
            }
          : row,
      ));
    }
    const result = await attemptSave("Salvar tarefa", () =>
      supabase.from("projeto_tarefas").update(updates as any).eq("id", id),
    );
    if (!result.ok) {
      // rollback do estado local se a persistência falhou
      if (prevDetail && prevDetail.id === id) setDetailTarefa(prevDetail);
      if (prevCentral && (isConclusao || isReabertura)) queryClient.setQueryData(centralKey, prevCentral);
      queryClient.invalidateQueries({ queryKey: ["tarefa-planning", id], refetchType: "active" });
      return;
    }
    // Em mudanças de status, dispara refetch efetivo do quadro para reconciliar
    // com o backend (ordenação da coluna "Concluídas", data_conclusao canônica).
    // Nos demais casos mantém o comportamento silencioso original.
    queryClient.invalidateQueries({
      queryKey: ["minhas-tarefas"],
      refetchType: (isConclusao || isReabertura) ? "active" : "none",
    });
  }, [queryClient, detailTarefa, detailTarefaId, attemptSave, user?.id]);


  const handleBridgeToggle = useCallback(async (t: ProjetoTarefa) => {
    const done = t.status !== "concluida";
    if (done) {
      const { confirmConclusaoTarefa } = await import("@/lib/projetos/confirmConclusao");
      const ok = await confirmConclusaoTarefa({
        titulo: t.titulo,
        isSubtarefa: !!t.parent_tarefa_id,
      });
      if (!ok) return;
    }
    const update: Record<string, any> = { status: done ? "concluida" : "pendente" };
    update.data_conclusao = done ? nowSaoPauloISO() : null;

    // Patch otimista no cache da Central (minhas-tarefas) para o cartão migrar
    // imediatamente entre as colunas do Kanban sem depender do refetch.
    const centralKey = ["minhas-tarefas", user?.id] as const;
    const prevCentral = queryClient.getQueryData<MinaTarefa[]>(centralKey);
    if (prevCentral) {
      queryClient.setQueryData<MinaTarefa[]>(centralKey, prevCentral.map((row) =>
        row.id === t.id
          ? { ...row, status: update.status, data_conclusao: update.data_conclusao }
          : row,
      ));
    }

    const result = await attemptSave(done ? "Concluir tarefa" : "Reabrir tarefa", () =>
      supabase.from("projeto_tarefas").update(update as never).eq("id", t.id),
    );
    if (!result.ok) {
      if (prevCentral) queryClient.setQueryData(centralKey, prevCentral);
      return;
    }
    // Refetch efetivo do quadro para reconciliar com o backend (data_conclusao
    // canônica, ordenação da coluna "Concluídas", etc.) sem esperar o usuário
    // fechar o painel ou dar F5.
    queryClient.invalidateQueries({ queryKey: ["minhas-tarefas"], refetchType: "active" });
    queryClient.invalidateQueries({ queryKey: ["projeto-tarefas-v2"], refetchType: "none" });
    queryClient.invalidateQueries({ queryKey: ["projeto-tarefas-subtarefas-bridge"], refetchType: "none" });
    if (detailTarefa && detailTarefa.id === t.id) {
      setDetailTarefa({ ...detailTarefa, ...update } as MinaTarefa);
    }
    if (detailTarefaId) {
      queryClient.setQueryData<ProjetoTarefa[]>(["projeto-tarefas-subtarefas-bridge", detailTarefaId], (old = []) =>
        old.map((st) => st.id === t.id ? ({ ...st, ...update } as ProjetoTarefa) : st),
      );
    }
    toast.success(done ? "Tarefa concluida" : "Tarefa reaberta");
  }, [queryClient, detailTarefa, detailTarefaId, attemptSave, user?.id]);


  const handleBridgeAddSubtarefa = useCallback(async (titulo: string, parentId: string, secaoId: string) => {
    if (!user?.id || !selectedProjetoId) return;
    const tempId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
          (Number(c) ^ (Math.random() * 16 >> Number(c) / 4)).toString(16),
        );
    const clientKey = `sub:${parentId}:${titulo.trim().toLowerCase()}:${tempId}`;
    const nowIso = new Date().toISOString();
    const optimistic = {
      id: tempId,
      titulo,
      parent_tarefa_id: parentId,
      secao_id: secaoId,
      projeto_id: selectedProjetoId,
      responsavel_id: user.id,
      criador_id: user.id,
      status: "pendente",
      prioridade: "media",
      ordem: 999,
      descricao: null,
      data_prazo: null,
      data_conclusao: null,
      codigo: null,
      estagio: null,
      visibilidade: "equipe",
      produto_id: null,
      created_at: nowIso,
      updated_at: nowIso,
      __clientKey: clientKey,
      subtarefas: [],
    } as ProjetoTarefa;

    // Insere otimista no ramo correto — recursivo para suportar subitens
    // profundos (nível ≥ 2) sem depender de refetch.
    const insertInBranch = (list: ProjetoTarefa[]): ProjetoTarefa[] => {
      if (parentId === detailTarefaId) {
        if (list.some((st) => st.id === tempId || (st as any).__clientKey === clientKey)) return list;
        return [...list, optimistic];
      }
      return list.map((st) => {
        if (st.id === parentId) {
          const children = ((st as any).subtarefas ?? []) as ProjetoTarefa[];
          if (children.some((c) => c.id === tempId || (c as any).__clientKey === clientKey)) return st;
          return { ...st, subtarefas: [...children, optimistic] } as ProjetoTarefa;
        }
        const children = ((st as any).subtarefas ?? []) as ProjetoTarefa[];
        if (children.length === 0) return st;
        const nextChildren = insertInBranch(children);
        return nextChildren === children ? st : ({ ...st, subtarefas: nextChildren } as ProjetoTarefa);
      });
    };

    if (detailTarefaId) {
      queryClient.setQueryData<ProjetoTarefa[]>(["projeto-tarefas-subtarefas-bridge", detailTarefaId], (old = []) =>
        insertInBranch(old),
      );
    }

    const result = await attemptSave("Criar subtarefa", () =>
      supabase.from("projeto_tarefas").insert({
        id: tempId, titulo, parent_tarefa_id: parentId, secao_id: secaoId,
        projeto_id: selectedProjetoId, responsavel_id: user.id,
        status: "pendente", prioridade: "media", ordem: 999,
      }).select("*").single(),
    );
    if (!result.ok) {
      // Rollback recursivo do nó otimista.
      const removeFromBranch = (list: ProjetoTarefa[]): ProjetoTarefa[] =>
        list
          .filter((st) => st.id !== tempId)
          .map((st) => {
            const children = ((st as any).subtarefas ?? []) as ProjetoTarefa[];
            if (children.length === 0) return st;
            const nextChildren = removeFromBranch(children);
            return nextChildren === children ? st : ({ ...st, subtarefas: nextChildren } as ProjetoTarefa);
          });
      if (detailTarefaId) {
        queryClient.setQueryData<ProjetoTarefa[]>(["projeto-tarefas-subtarefas-bridge", detailTarefaId], (old = []) =>
          removeFromBranch(old),
        );
      }
      throw new Error("Não foi possível criar a subtarefa.");
    }

    // Swap tempId → id real no ramo correspondente. Sem invalidações extras
    // aqui: o SubtarefasSection emite o toast único de sucesso.
    const data = (result.data as any)?.data;
    if (data && detailTarefaId) {
      const swapInBranch = (list: ProjetoTarefa[]): ProjetoTarefa[] =>
        list.map((st) => {
          if (st.id === tempId) {
            return { ...st, ...(data as ProjetoTarefa), __clientKey: clientKey, subtarefas: (st as any).subtarefas ?? [] } as ProjetoTarefa;
          }
          const children = ((st as any).subtarefas ?? []) as ProjetoTarefa[];
          if (children.length === 0) return st;
          const nextChildren = swapInBranch(children);
          return nextChildren === children ? st : ({ ...st, subtarefas: nextChildren } as ProjetoTarefa);
        });
      queryClient.setQueryData<ProjetoTarefa[]>(["projeto-tarefas-subtarefas-bridge", detailTarefaId], (old = []) =>
        swapInBranch(old),
      );
    }
  }, [queryClient, user?.id, selectedProjetoId, detailTarefaId, attemptSave]);

  const handleBridgeMoveTarefa = useCallback(async (tarefaId: string, _o: string, secaoDestinoId: string) => {
    // Patch otimista ANTES do await — sem isso o Select "Mover para" fica
    // exibindo a seção antiga (o `value` lê `bridgedTarefa.secao_id`) até o
    // usuário fechar/reabrir o drawer, dando a impressão de que a ação
    // falhou. Também evita o "piscar" causado por refetch da lista.
    const destino = bridgedSecoes.find((s) => s.id === secaoDestinoId);
    const prevDetail = detailTarefa;
    if (detailTarefa && detailTarefa.id === tarefaId) {
      setDetailTarefa({
        ...detailTarefa,
        secao_id: secaoDestinoId,
        secao_nome: destino?.nome ?? detailTarefa.secao_nome,
      } as MinaTarefa);
    }
    queryClient.setQueryData<MinaTarefa[]>(["minhas-tarefas", user?.id], (old = []) =>
      old.map((t) => t.id === tarefaId ? { ...t, secao_id: secaoDestinoId, secao_nome: destino?.nome ?? t.secao_nome } : t),
    );
    const { error } = await supabase.from("projeto_tarefas").update({ secao_id: secaoDestinoId }).eq("id", tarefaId);
    if (error) {
      // rollback
      if (prevDetail && prevDetail.id === tarefaId) setDetailTarefa(prevDetail);
      queryClient.invalidateQueries({ queryKey: ["minhas-tarefas"], refetchType: "active" });
      toast.error("Erro ao mover tarefa");
      return;
    }
    // Silencioso: refetchType none preserva o estado atual sem piscar.
    queryClient.invalidateQueries({ queryKey: ["minhas-tarefas"], refetchType: "none" });
    queryClient.invalidateQueries({ queryKey: ["projeto-tarefas-v2"], refetchType: "none" });
    toast.success("Tarefa movida");
  }, [queryClient, bridgedSecoes, detailTarefa, user?.id]);

  const handleBridgeDelete = useCallback(async (tarefaId: string) => {
    const live = bridgedTarefa?.id === tarefaId
      ? bridgedTarefa
      : (bridgedTarefa?.subtarefas?.find((s) => s.id === tarefaId) ?? null);
    const { confirmExclusaoTarefa } = await import("@/lib/projetos/confirmConclusao");
    const ok = await confirmExclusaoTarefa({
      titulo: live?.titulo,
      isSubtarefa: !!live?.parent_tarefa_id,
    });
    if (!ok) return;
    const { error } = await supabase
      .from("projeto_tarefas")
      .update({ excluida_em: nowSaoPauloISO() } as any)
      .eq("id", tarefaId);
    if (error) { toast.error(error.message); return; }
    toast.success(live?.parent_tarefa_id ? "Subtarefa movida para a lixeira" : "Tarefa movida para a lixeira");
    queryClient.invalidateQueries({ queryKey: ["minhas-tarefas"] });
    queryClient.invalidateQueries({ queryKey: ["projeto-tarefas-v2"] });
  }, [bridgedTarefa, queryClient]);

  const projects = useMemo(() => {
    const map = new Map<string, { id: string; nome: string; cor: string }>();
    tarefas.forEach((t) => map.set(t.projeto_id, { id: t.projeto_id, nome: t.projeto_nome, cor: t.projeto_cor }));
    return Array.from(map.values());
  }, [tarefas]);

  // Profiles loaded only to label the "Responsável" select in the advanced
  // filters popover; the underlying filter compares by responsavel_id.
  const { data: systemProfiles = [] } = useSystemProfiles();
  const responsavelOptions = useMemo(() => {
    const ids = new Set<string>();
    tarefas.forEach((t) => { if (t.responsavel_id) ids.add(t.responsavel_id); });
    return systemProfiles
      .filter((p) => ids.has(p.id))
      .sort((a, b) => (a.nome || a.email || "").localeCompare(b.nome || b.email || ""));
  }, [tarefas, systemProfiles]);

  const filtered = useMemo(() => {
    let result = tarefas;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((t) => t.titulo.toLowerCase().includes(q) || t.projeto_nome.toLowerCase().includes(q) || ((t as any).descricao || "").toLowerCase().includes(q));
    }
    if (filterPriority !== "all") result = result.filter((t) => t.prioridade === filterPriority);
    if (filterRole !== "all") result = result.filter((t) => t.papel === filterRole);
    if (filterProject !== "all") result = result.filter((t) => t.projeto_id === filterProject);
    if (filterStatus.length > 0) result = result.filter((t) => filterStatus.includes(t.status));
    if (filterResponsavel !== "all") {
      result = result.filter((t) => t.responsavel_id === filterResponsavel);
    }
    if (filterDateFrom || filterDateTo) {
      const fromMs = filterDateFrom ? new Date(filterDateFrom).setHours(0, 0, 0, 0) : null;
      const toMs = filterDateTo ? new Date(filterDateTo).setHours(23, 59, 59, 999) : null;
      result = result.filter((t) => {
        const parsed = parseLocalDate(t.data_prazo);
        if (!parsed) return false;
        const d = parsed.getTime();
        if (fromMs !== null && d < fromMs) return false;
        if (toMs !== null && d > toMs) return false;
        return true;
      });
    }
    if (filterTime === "atrasadas") {
      // Comparar apenas DATA (início do dia local), consistente com groupTarefas.
      // Sem isso, tarefas com prazo HOJE caem como "atrasadas" porque
      // `hoje 00:00 < new Date()` (hora atual) é sempre verdadeiro.
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      result = result.filter(t => {
        if (t.status === "concluida") return false;
        const p = parseLocalDate(t.data_prazo);
        if (!p) return false;
        const pStart = new Date(p);
        pStart.setHours(0, 0, 0, 0);
        return pStart.getTime() < todayStart.getTime();
      });
    } else if (filterTime === "hoje") {
      // "Tarefas do dia" = tarefas ativas hoje. Inclui:
      //   (a) prazo === hoje
      //   (b) tarefas em andamento (início <= hoje <= prazo)
      //   (c) atrasadas não concluídas (carryover — ainda precisam de ação hoje)
      // Antes o filtro só considerava (a), o que deixava de fora tarefas que
      // o usuário esperava ver na visão "do dia".
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      result = result.filter(t => {
        if (t.status === "concluida") return false;
        const prazo = parseLocalDate(t.data_prazo);
        const inicio = parseLocalDate(t.data_inicio_planejada);
        if (prazo) {
          const prazoStart = new Date(prazo);
          prazoStart.setHours(0, 0, 0, 0);
          // (a) prazo hoje OR (c) prazo no passado e ainda aberta
          if (prazoStart.getTime() <= todayEnd.getTime()) return true;
          // (b) em janela [início, prazo] cobrindo hoje
          if (inicio && inicio.getTime() <= todayEnd.getTime() && prazoStart.getTime() >= todayStart.getTime()) {
            return true;
          }
        }
        return false;
      });
    } else if (filterTime === "sem_data") {
      result = result.filter(t => isSemDatasPlanejadas(t));
    } else if (filterTime === "concluidas_hoje") {
      result = result.filter(t => {
        if (t.status !== "concluida") return false;
        const c = parseLocalDate(t.data_conclusao);
        return c && isToday(c);
      });
    }
    return result;
  }, [tarefas, search, filterPriority, filterProject, filterTime, filterRole, filterStatus, filterResponsavel, filterDateFrom, filterDateTo]);

  const advancedActiveCount = (filterStatus.length > 0 ? 1 : 0)
    + (filterResponsavel !== "all" ? 1 : 0)
    + (filterDateFrom || filterDateTo ? 1 : 0);

  const clearAdvancedFilters = () => {
    setFilterStatus([]);
    setFilterResponsavel("all");
    setFilterDateFrom(undefined);
    setFilterDateTo(undefined);
  };

  // Counts of comments per task — used to render the QuickCommentPopover badge
  // without one query per row. Re-fetches when the filtered list changes.
  const tarefaIdsForCounts = useMemo(() => filtered.map((t) => t.id), [filtered]);
  const { data: messageCounts = {} } = useTarefaMessageCounts(tarefaIdsForCounts);

  // Manual override for the "prioridade" sort: persisted per user in
  // localStorage, applied on top of the automatic priority order.
  const { order: manualOrder, setOrder: setManualOrder, clear: clearManualOrder } =
    useManualPriorityOrder(user?.id);

  // Priority weight: higher = more urgent. Drives the "Próxima ação" sort.
  const PRIORITY_WEIGHT: Record<string, number> = {
    urgente: 4,
    alta: 3,
    media: 2,
    baixa: 1,
  };

  // Status sort weight: open work first, blocked next, done last.
  const STATUS_WEIGHT: Record<string, number> = {
    em_andamento: 1,
    pendente: 2,
    nao_iniciado: 2,
    bloqueada: 3,
    cancelada: 4,
    concluida: 5,
  };

  const groups = useMemo(() => {
    const buildFlat = (label: string, items: MinaTarefa[], key = "sorted") =>
      items.length > 0 ? [{ label, key, items }] : [];

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
      return buildFlat(label, sorted, "urgent");
    }
    if (sortMode === "prazo") {
      const sorted = [...filtered].sort((a, b) => {
        const aD = a.data_prazo ? new Date(a.data_prazo).getTime() : Number.POSITIVE_INFINITY;
        const bD = b.data_prazo ? new Date(b.data_prazo).getTime() : Number.POSITIVE_INFINITY;
        if (aD !== bD) return aD - bD;
        return a.titulo.localeCompare(b.titulo);
      });
      return buildFlat("Ordenado por prazo (mais próximo primeiro)", sorted, "prazo");
    }
    if (sortMode === "status") {
      const sorted = [...filtered].sort((a, b) => {
        const aS = STATUS_WEIGHT[a.status] ?? 99;
        const bS = STATUS_WEIGHT[b.status] ?? 99;
        if (aS !== bS) return aS - bS;
        const aD = a.data_prazo ? new Date(a.data_prazo).getTime() : Number.POSITIVE_INFINITY;
        const bD = b.data_prazo ? new Date(b.data_prazo).getTime() : Number.POSITIVE_INFINITY;
        return aD - bD;
      });
      return buildFlat("Ordenado por status", sorted, "status");
    }
    if (sortMode === "prioridade") {
      const sorted = [...filtered].sort((a, b) => {
        const aDone = a.status === "concluida" ? 1 : 0;
        const bDone = b.status === "concluida" ? 1 : 0;
        if (aDone !== bDone) return aDone - bDone;
        const aP = PRIORITY_WEIGHT[a.prioridade || "media"] ?? 2;
        const bP = PRIORITY_WEIGHT[b.prioridade || "media"] ?? 2;
        if (aP !== bP) return bP - aP;
        const aD = parseLocalDate(a.data_prazo)?.getTime() ?? Number.POSITIVE_INFINITY;
        const bD = parseLocalDate(b.data_prazo)?.getTime() ?? Number.POSITIVE_INFINITY;
        return aD - bD;
      });
      const finalSorted = applyManualOrder(sorted, manualOrder);
      return buildFlat("Ordenado por prioridade", finalSorted, "prioridade");
    }
    return groupTarefas(filtered);
  }, [filtered, sortMode, filterTime, manualOrder]);

  const handleToggle = useCallback(async (tarefaId: string, done: boolean) => {
    if (done) {
      const { confirmConclusaoTarefa } = await import("@/lib/projetos/confirmConclusao");
      const titulo = tarefas.find((t) => t.id === tarefaId)?.titulo;
      const ok = await confirmConclusaoTarefa({ titulo });
      if (!ok) return;
    }
    const update: Record<string, any> = { status: done ? "concluida" : "pendente" };
    update.data_conclusao = done ? nowSaoPauloISO() : null;

    // Optimistic update: reflete no cache antes do round-trip para o Kanban
    // migrar o cartão de coluna imediatamente. Snapshot para rollback em erro.
    const cacheKey = ["minhas-tarefas", user?.id] as const;
    const previous = queryClient.getQueryData<MinaTarefa[]>(cacheKey);
    if (previous) {
      queryClient.setQueryData<MinaTarefa[]>(cacheKey, previous.map((t) =>
        t.id === tarefaId
          ? { ...t, status: update.status, data_conclusao: update.data_conclusao }
          : t,
      ));
    }

    const toastId = `tarefa-toggle-${tarefaId}`;
    markPending([tarefaId], true);
    toast.loading(done ? "Concluindo tarefa..." : "Reabrindo tarefa...", { id: toastId });

    const { data: fresh, error } = await supabase
      .from("projeto_tarefas")
      .update(update as never)
      .eq("id", tarefaId)
      .select("id, status, data_conclusao, data_prazo, updated_at")
      .maybeSingle();
    if (error) {
      if (previous) queryClient.setQueryData(cacheKey, previous);
      markPending([tarefaId], false);
      toast.error(done ? "Não foi possível concluir a tarefa" : "Não foi possível reabrir a tarefa", {
        id: toastId,
        description: error.message,
        action: { label: "Tentar novamente", onClick: () => handleToggle(tarefaId, done) },
      });
      return;
    }
    // RLS pode filtrar a linha silenciosamente (sem erro, sem retorno).
    // Nesses casos o usuário não tem permissão de atualização e precisamos
    // reverter a UI e avisar em vez de mostrar "sucesso" mentiroso.
    if (!fresh) {
      if (previous) queryClient.setQueryData(cacheKey, previous);
      markPending([tarefaId], false);
      toast.error("Você não tem permissão para alterar esta tarefa", {
        id: toastId,
        description: "Peça ao responsável ou ao criador para conceder acesso.",
      });
      return;
    }
    // Reconciliação: aplica o estado canônico devolvido pelo backend no cache
    // antes de disparar o refetch, garantindo que o Kanban migre o cartão
    // imediatamente mesmo se o refetch em background demorar.
    queryClient.setQueryData<MinaTarefa[]>(cacheKey, (curr = []) =>
      curr.map((t) => (t.id === tarefaId ? { ...t, ...(fresh as Partial<MinaTarefa>) } : t)),
    );
    await queryClient.invalidateQueries({ queryKey: ["minhas-tarefas"], refetchType: "active" });
    queryClient.invalidateQueries({ queryKey: ["projeto-tarefas-v2"] });
    queryClient.invalidateQueries({ queryKey: ["projeto-tarefas-subtarefas-bridge"] });
    markPending([tarefaId], false);
    toast.success(done ? "Tarefa concluída" : "Tarefa reaberta", { id: toastId });

  }, [queryClient, tarefas, user?.id, markPending]);

  const handleChangePrazo = useCallback(async (tarefaId: string, novaData: string | null) => {
    const cacheKey = ["minhas-tarefas", user?.id] as const;
    const previous = queryClient.getQueryData<MinaTarefa[]>(cacheKey);
    if (previous) {
      queryClient.setQueryData<MinaTarefa[]>(cacheKey, previous.map((t) =>
        t.id === tarefaId ? { ...t, data_prazo: novaData } : t,
      ));
    }
    const toastId = `tarefa-prazo-${tarefaId}`;
    markPending([tarefaId], true);
    toast.loading("Atualizando prazo...", { id: toastId });
    const { data: fresh, error } = await supabase
      .from("projeto_tarefas")
      .update({ data_prazo: novaData } as never)
      .eq("id", tarefaId)
      .select("id, data_prazo, updated_at")
      .maybeSingle();
    if (error) {
      if (previous) queryClient.setQueryData(cacheKey, previous);
      markPending([tarefaId], false);
      toast.error("Não foi possível atualizar o prazo", {
        id: toastId,
        description: error.message,
        action: { label: "Tentar novamente", onClick: () => handleChangePrazo(tarefaId, novaData) },
      });
      return;
    }
    if (fresh) {
      queryClient.setQueryData<MinaTarefa[]>(cacheKey, (curr = []) =>
        curr.map((t) => (t.id === tarefaId ? { ...t, ...(fresh as Partial<MinaTarefa>) } : t)),
      );
    }
    await queryClient.invalidateQueries({ queryKey: ["minhas-tarefas"], refetchType: "active" });
    queryClient.invalidateQueries({ queryKey: ["projeto-tarefas-v2"] });
    queryClient.invalidateQueries({ queryKey: ["projeto-tarefas-subtarefas-bridge"] });
    markPending([tarefaId], false);
    toast.success("Prazo atualizado", { id: toastId });
  }, [queryClient, user?.id, markPending]);

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
    const { confirmConclusaoTarefa } = await import("@/lib/projetos/confirmConclusao");
    const ok = await confirmConclusaoTarefa({ quantidade: ids.length });
    if (!ok) return;

    const nowIso = nowSaoPauloISO();
    const cacheKey = ["minhas-tarefas", user?.id] as const;
    const previous = queryClient.getQueryData<MinaTarefa[]>(cacheKey);
    if (previous) {
      const idSet = new Set(ids);
      queryClient.setQueryData<MinaTarefa[]>(cacheKey, previous.map((t) =>
        idSet.has(t.id) ? { ...t, status: "concluida", data_conclusao: nowIso } : t,
      ));
    }

    const toastId = `tarefa-bulk-${ids.join(",").slice(0, 40)}`;
    markPending(ids, true);
    toast.loading(`Concluindo ${ids.length} tarefa${ids.length > 1 ? "s" : ""}...`, { id: toastId });

    const { data: freshRows, error } = await supabase
      .from("projeto_tarefas")
      .update({ status: "concluida", data_conclusao: nowIso })
      .in("id", ids)
      .select("id, status, data_conclusao, updated_at");
    if (error) {
      if (previous) queryClient.setQueryData(cacheKey, previous);
      markPending(ids, false);
      toast.error("Não foi possível concluir as tarefas", {
        id: toastId,
        description: error.message,
        action: { label: "Tentar novamente", onClick: () => handleBulkComplete() },
      });
      return;
    }

    // Se o backend não retornou linhas (RLS filtrou tudo), reverte e avisa.
    if (!freshRows || freshRows.length === 0) {
      if (previous) queryClient.setQueryData(cacheKey, previous);
      markPending(ids, false);
      toast.error("Você não tem permissão para concluir estas tarefas", {
        id: toastId,
        description: "Peça ao responsável ou ao criador para conceder acesso.",
      });
      return;
    }

    // Reconciliação em lote: aplica o estado retornado pelo backend antes do refetch.
    const byId = new Map(freshRows.map((r: any) => [r.id, r]));
    queryClient.setQueryData<MinaTarefa[]>(cacheKey, (curr = []) =>
      curr.map((t) => (byId.has(t.id) ? { ...t, ...(byId.get(t.id) as Partial<MinaTarefa>) } : t)),
    );

    // Se algumas linhas foram filtradas pelo RLS, marca-pending nelas de volta ao normal.
    if (freshRows.length < ids.length) {
      const okIds = new Set(freshRows.map((r: any) => r.id));
      const blockedIds = ids.filter((id) => !okIds.has(id));
      markPending(blockedIds, false);
      toast.warning(`${blockedIds.length} tarefa${blockedIds.length > 1 ? "s" : ""} não p${blockedIds.length > 1 ? "u" : "ô"}de ser concluída (sem permissão)`);
    }


    // Auditoria em lote (best-effort, não bloqueia UI).
    const selecionadas = tarefas.filter((t: any) => ids.includes(t.id));
    Promise.all(
      selecionadas.map((t: any) =>
        registrarAuditoriaTarefa({
          tarefaId: t.id,
          projetoId: t.projeto_id ?? null,
          parentTarefaId: t.parent_tarefa_id ?? null,
          isSubtarefa: !!t.parent_tarefa_id,
          tituloSnapshot: t.titulo ?? null,
          action: "concluida",
          metadata: { source: "handleBulkComplete" },
        }),
      ),
    ).catch(() => {});

    await queryClient.invalidateQueries({ queryKey: ["minhas-tarefas"], refetchType: "active" });
    queryClient.invalidateQueries({ queryKey: ["projeto-tarefas-v2"] });
    queryClient.invalidateQueries({ queryKey: ["projeto-tarefas-subtarefas-bridge"] });
    markPending(ids, false);
    toast.success(`${ids.length} tarefa${ids.length > 1 ? "s concluídas" : " concluída"}`, { id: toastId });
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    const { confirmExclusaoTarefa } = await import("@/lib/projetos/confirmConclusao");
    const ok = await confirmExclusaoTarefa({ quantidade: ids.length });
    if (!ok) return;
    const { data: authData } = await supabase.auth.getUser();
    const uid = authData.user?.id ?? null;
    const { error } = await supabase
      .from("projeto_tarefas")
      .update({ excluida_em: nowSaoPauloISO(), excluida_por: uid } as any)
      .in("id", ids);
    if (error) { toast.error("Erro ao excluir tarefas"); return; }

    const selecionadas = tarefas.filter((t: any) => ids.includes(t.id));
    Promise.all(
      selecionadas.map((t: any) =>
        registrarAuditoriaTarefa({
          tarefaId: t.id,
          projetoId: t.projeto_id ?? null,
          parentTarefaId: t.parent_tarefa_id ?? null,
          isSubtarefa: !!t.parent_tarefa_id,
          tituloSnapshot: t.titulo ?? null,
          action: "excluida",
          metadata: { source: "handleBulkDelete" },
        }),
      ),
    ).catch(() => {});

    queryClient.invalidateQueries({ queryKey: ["minhas-tarefas"] });
    toast.success(`${ids.length} tarefas movidas para a lixeira`);
    setSelectedIds(new Set());
  };

  // Contadores para os chips de filtro (sobre o dataset completo, sem busca
  // nem filtros opcionais; replicam a base que o antigo CentralKPIs usava).
  const chipCounts = useMemo(() => {
    const now = getToday();
    const pendentes = tarefas.filter((t) => t.status !== "concluida");
    return {
      todas: pendentes.length,
      semPrazo: pendentes.filter((t) => isSemDatasPlanejadas(t)).length,
      hoje: pendentes.filter((t) => {
        const p = parseLocalDate(t.data_prazo);
        return p && isToday(p);
      }).length,
      atrasadas: pendentes.filter((t) => {
        const p = parseLocalDate(t.data_prazo);
        return p && isBefore(startOfDay(p), now);
      }).length,
      concluidasHoje: tarefas.filter((t) => {
        if (t.status !== "concluida") return false;
        const c = parseLocalDate(t.data_conclusao);
        return c && isToday(c);
      }).length,
    };
  }, [tarefas]);

  const tarefaIdList = useMemo(() => tarefas.map((t) => t.id), [tarefas]);
  const { data: processoTagMap } = useProcessoOperacionalMap(tarefaIdList);

  return (
    <ProcessoTagMapCtx.Provider value={processoTagMap ?? null}>
    <div className="space-y-4">
      <PapelExplicativoBanner />
      <PapelChangeBanner />

      {showRoleOverview && tarefas.length > 0 && (
        <RoleOverviewCard
          tarefas={tarefas}
          currentRole={filterRole}
          onSelectRole={(r) => setFilterRole(r)}
          onHide={() => setShowRoleOverview(false)}
        />
      )}
      {/* Chips de filtro de prazo (substituem CentralKPIs) */}
      <CentralChipsPortal>
        <CentralChip
          label="Todas"
          count={chipCounts.todas}
          active={filterTime === "all"}
          onClick={() => setFilterTime("all")}
        />
        <CentralChip
          label="Sem prazo"
          count={chipCounts.semPrazo}
          active={filterTime === "sem_data"}
          onClick={() => setFilterTime("sem_data")}
        />
        <CentralChip
          label="Para hoje"
          count={chipCounts.hoje}
          active={filterTime === "hoje"}
          onClick={() => setFilterTime("hoje")}
        />
        <CentralChip
          label="Atrasadas"
          count={chipCounts.atrasadas}
          countVariant={
            chipCounts.atrasadas > 0 && filterTime !== "atrasadas" ? "destructive" : undefined
          }
          active={filterTime === "atrasadas"}
          onClick={() => setFilterTime("atrasadas")}
        />
        <CentralChip
          label="Concluídas hoje"
          count={chipCounts.concluidasHoje}
          active={filterTime === "concluidas_hoje"}
          onClick={() => setFilterTime("concluidas_hoje")}
        />
      </CentralChipsPortal>
      {/* Toolbar contextual portada para o slot do CentralLayout */}
      <CentralToolbarPortal>
      {/* Action bar */}
      <div className="w-full flex items-center justify-end gap-2 flex-wrap min-h-[36px]">
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

      <div className="w-full flex flex-wrap items-center gap-2">
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
            <SelectItem value="concluidas_hoje">Concluídas hoje</SelectItem>
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
        <Select value={filterRole} onValueChange={(v) => setFilterRole(v as CentralRole)}>
          <SelectTrigger className="w-[160px] h-9 text-xs" aria-label="Filtrar por meu papel">
            <UserCheck className="h-3.5 w-3.5 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os papéis</SelectItem>
            <SelectItem value="responsavel">
              <div className="flex items-center gap-2">
                <UserCheck className="h-3.5 w-3.5 text-primary" />
                Sou responsável
              </div>
            </SelectItem>
            <SelectItem value="colaborador">
              <div className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-info" />
                Sou colaborador
              </div>
            </SelectItem>
            <SelectItem value="seguidor">
              <div className="flex items-center gap-2">
                <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                Estou seguindo
              </div>
            </SelectItem>
            <SelectItem value="criador">
              <div className="flex items-center gap-2">
                <UserPlus className="h-3.5 w-3.5 text-warning" />
                Criadas por mim
              </div>
            </SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortMode} onValueChange={(v) => setSortMode(v as CentralSort)}>
          <SelectTrigger className="w-[170px] h-9 text-xs" aria-label="Ordenar tarefas">
            <ArrowUpDown className="h-3.5 w-3.5 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Agrupado por prazo</SelectItem>
            <SelectItem value="prazo">Prazo (mais próximo)</SelectItem>
            <SelectItem value="prioridade">Prioridade (maior)</SelectItem>
            <SelectItem value="status">Status</SelectItem>
            <SelectItem value="urgent">Urgência + prazo</SelectItem>
          </SelectContent>
        </Select>
        <Popover open={advOpen} onOpenChange={setAdvOpen}>
          <PopoverTrigger asChild>
            <Button
              size="sm"
              variant={advancedActiveCount > 0 ? "default" : "outline"}
              className="gap-1.5 h-9 text-xs"
              aria-label="Filtros avançados"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filtros avançados
              {advancedActiveCount > 0 && (
                <Badge variant="secondary" className="h-4 px-1.5 text-[10px] ml-0.5">
                  {advancedActiveCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[340px] p-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Filtros avançados</p>
              {advancedActiveCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1 text-muted-foreground"
                  onClick={clearAdvancedFilters}
                >
                  <X className="h-3 w-3" /> Limpar
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Status
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {STATUS_OPTIONS.map((opt) => {
                  const checked = filterStatus.includes(opt.value);
                  return (
                    <label
                      key={opt.value}
                      className={cn(
                        "flex items-center gap-2 px-2 py-1.5 rounded-md border text-xs cursor-pointer transition-colors",
                        checked ? "border-primary/50 bg-primary/5" : "border-border hover:bg-muted/40",
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(c) =>
                          setFilterStatus((prev) =>
                            c ? [...prev, opt.value] : prev.filter((s) => s !== opt.value),
                          )
                        }
                        className="h-3.5 w-3.5"
                      />
                      <span className="truncate">{opt.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Responsável
              </Label>
              <Select value={filterResponsavel} onValueChange={setFilterResponsavel}>
                <SelectTrigger className="h-9 text-xs">
                  <UserIcon className="h-3.5 w-3.5 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os responsáveis</SelectItem>
                  {user?.id && <SelectItem value={user.id}>Apenas eu</SelectItem>}
                  {responsavelOptions
                    .filter((p) => p.id !== user?.id)
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome || p.email}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {responsavelOptions.length === 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Nenhum responsável encontrado nas tarefas atuais.
                </p>
              )}
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Período (prazo)
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        "h-9 text-xs justify-start gap-1.5",
                        !filterDateFrom && "text-muted-foreground",
                      )}
                    >
                      <Calendar className="h-3.5 w-3.5" />
                      {filterDateFrom ? format(filterDateFrom, "dd/MM/yy", { locale: ptBR }) : "De"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarPicker
                      mode="single"
                      selected={filterDateFrom}
                      onSelect={setFilterDateFrom}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        "h-9 text-xs justify-start gap-1.5",
                        !filterDateTo && "text-muted-foreground",
                      )}
                    >
                      <Calendar className="h-3.5 w-3.5" />
                      {filterDateTo ? format(filterDateTo, "dd/MM/yy", { locale: ptBR }) : "Até"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarPicker
                      mode="single"
                      selected={filterDateTo}
                      onSelect={setFilterDateTo}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Filtra pelo prazo final. Tarefas sem prazo são excluídas.
              </p>
            </div>

            <div className="flex justify-end pt-1">
              <Button size="sm" className="h-8 text-xs" onClick={() => setAdvOpen(false)}>
                Aplicar
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {advancedActiveCount > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap basis-full">
            {filterStatus.map((s) => {
              const opt = STATUS_OPTIONS.find((o) => o.value === s);
              return (
                <Badge key={s} variant="secondary" className="h-6 gap-1 text-[10px] pl-2 pr-1">
                  {opt?.label || s}
                  <button
                    type="button"
                    aria-label={`Remover status ${opt?.label || s}`}
                    onClick={() => setFilterStatus((prev) => prev.filter((v) => v !== s))}
                    className="rounded-sm hover:bg-muted-foreground/20 p-0.5"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              );
            })}
            {filterResponsavel !== "all" && (
              <Badge variant="secondary" className="h-6 gap-1 text-[10px] pl-2 pr-1">
                <UserIcon className="h-3 w-3" />
                {filterResponsavel === user?.id
                  ? "Eu"
                  : responsavelOptions.find((p) => p.id === filterResponsavel)?.nome || "Responsável"}
                <button
                  type="button"
                  aria-label="Limpar responsável"
                  onClick={() => setFilterResponsavel("all")}
                  className="rounded-sm hover:bg-muted-foreground/20 p-0.5"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            )}
            {(filterDateFrom || filterDateTo) && (
              <Badge variant="secondary" className="h-6 gap-1 text-[10px] pl-2 pr-1">
                <Calendar className="h-3 w-3" />
                {filterDateFrom ? format(filterDateFrom, "dd/MM/yy", { locale: ptBR }) : "—"}
                {" → "}
                {filterDateTo ? format(filterDateTo, "dd/MM/yy", { locale: ptBR }) : "—"}
                <button
                  type="button"
                  aria-label="Limpar período"
                  onClick={() => { setFilterDateFrom(undefined); setFilterDateTo(undefined); }}
                  className="rounded-sm hover:bg-muted-foreground/20 p-0.5"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            )}
          </div>
        )}

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
      </CentralToolbarPortal>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-primary/5 border border-primary/20 rounded-lg animate-in fade-in slide-in-from-bottom-2">
          <Badge variant="secondary" className="text-xs">{selectedIds.size} selecionadas</Badge>
          <Button size="sm" variant="default" className="h-7 text-xs gap-1" onClick={handleBulkComplete}>
            <CheckCircle2 className="h-3.5 w-3.5" /> Concluir
          </Button>
          <Button size="sm" variant="destructive" className="h-7 text-xs gap-1" onClick={handleBulkDelete}>
            <Trash2 className="h-3.5 w-3.5" /> Excluir
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

      {sortMode === "prioridade" && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-primary/5 border border-primary/20 rounded-lg animate-in fade-in slide-in-from-top-1">
          <Flag className="h-4 w-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              Ordenado por prioridade
              {manualOrder.length > 0 && (
                <Badge variant="outline" className="ml-2 text-[10px] h-4 border-primary/40 text-primary">
                  ordem manual ativa
                </Badge>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {manualOrder.length > 0
                ? "Sua ordem personalizada está salva. Arraste novamente para ajustar ou limpe para voltar à ordem automática."
                : "Arraste pelo ícone à esquerda de cada tarefa para definir uma ordem manual sobre a prioridade."}
            </p>
          </div>
          {manualOrder.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs gap-1"
              onClick={() => {
                clearManualOrder();
                toast.success("Ordem manual removida");
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Limpar ordem manual
            </Button>
          )}
        </div>
      )}

      <div>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className={cn("w-full rounded-lg", isCompact ? "h-11" : "h-14")} />
            ))}
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
                (() => {
                  // Detecta filtros ativos para diferenciar "tudo em dia" real
                  // de "filtro zerou o resultado". Sem isso, combinar projeto +
                  // papel + período salvo nas preferências mostra uma tela
                  // vazia sem indicar a causa — falha silenciosa.
                  const hasActiveFilters =
                    !!search ||
                    filterPriority !== "all" ||
                    filterProject !== "all" ||
                    filterTime !== "all" ||
                    filterRole !== "all" ||
                    advancedActiveCount > 0;
                  const totalNoFilters = tarefas.length;
                  const clearAllFilters = () => {
                    setSearch("");
                    setFilterPriority("all");
                    setFilterProject("all");
                    setFilterTime("all");
                    setFilterRole("all");
                    clearAdvancedFilters();
                  };
                  return (
                <EmptyState
                  icon={hasActiveFilters ? Filter : ListChecks}
                  title={hasActiveFilters ? "Nenhuma tarefa corresponde aos filtros" : "Nada por aqui ainda"}
                  description={
                    hasActiveFilters
                      ? `Você tem ${totalNoFilters} ${totalNoFilters === 1 ? "tarefa" : "tarefas"} ocultas pelos filtros atuais.`
                      : "Você não tem tarefas atribuídas no momento."
                  }
                >
                  {filterRole === "colaborador" && (
                    <p className="text-xs mt-3 text-muted-foreground">
                      Procurando tarefas que você delegou?{" "}
                      <button
                        type="button"
                        className="underline underline-offset-2 text-primary hover:text-primary/80"
                        onClick={() => {
                          const params = new URLSearchParams(searchParams);
                          params.set("tab", "delegadas");
                          ["filter", "priority", "project", "role", "view", "sort", "q"].forEach((k) => params.delete(k));
                          setSearchParams(params);
                        }}
                      >
                        Veja a aba Delegadas
                      </button>
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-4 flex-wrap justify-center">
                    {hasActiveFilters && (
                      <Button variant="default" size="sm" className="gap-1.5" onClick={clearAllFilters}>
                        <X className="h-4 w-4" /> Limpar todos os filtros
                      </Button>
                    )}
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowNewTask(true)}>
                      <Plus className="h-4 w-4" /> Criar nova tarefa
                    </Button>
                    <a
                      href="/dashboard/ajuda/projetos-visibilidade"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                    >
                      Por que não vejo outras tarefas?
                    </a>
                  </div>
                </EmptyState>
                  );
                })()
              ) : sortMode === "prioridade" && groups[0] ? (
                <div>
                  <div className="flex items-center gap-2 px-4 py-2 bg-muted/30 border-b border-border/30">
                    <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                      {groups[0].label}
                    </span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 ml-1">
                      {groups[0].items.length}
                    </Badge>
                    <span className="ml-auto text-[11px] text-muted-foreground hidden sm:inline">
                      Arraste pelo ícone à esquerda para reordenar manualmente
                    </span>
                  </div>
                  <ManualPrioritySortable
                    items={groups[0].items}
                    onReorder={setManualOrder}
                    renderRow={(t) => (
                      <ListRow
                        tarefa={t}
                        onToggle={handleToggle}
                        onSelect={handleSelectTask}
                        selected={selectedIds.has(t.id)}
                        onSelectToggle={handleSelectToggle}
                        messageCount={messageCounts[t.id] || 0}
                      />
                    )}
                  />
                </div>
              ) : (
                <>
                  {groups.map((g) => (
                    <ListSection
                      key={g.key}
                      group={g}
                      onToggle={handleToggle}
                      onSelect={handleSelectTask}
                      selectedIds={selectedIds}
                      onSelectToggle={handleSelectToggle}
                      messageCounts={messageCounts}
                      splitByRole={filterRole === "all" && sortMode !== "urgent"}
                    />
                  ))}
                  {truncadoConcluidas && (
                    <div className="flex items-center justify-center py-3 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isFetching}
                        onClick={() => carregarMaisConcluidas?.()}
                        className="text-xs text-muted-foreground"
                      >
                        Mostrando {concluidasNaLista} de {minhasStats?.concluidas ?? 0} concluídas · Carregar todas
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
            </Card>
          </div>
        ) : view === "board" ? (
          <MinhasTarefasBoard tarefas={filtered} onToggle={handleToggle} onChangePrazo={handleChangePrazo} onSelect={handleSelectTask} pendingIds={pendingIds} />
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
        onDelete={handleBridgeDelete}
        secoes={bridgedSecoes}
        onMoveTarefa={handleBridgeMoveTarefa}
        projetoIdOverride={selectedProjetoId}
        externalSaving={isBridgeSaving}
        onOpenSubtarefa={makeOpenSubtarefaHandler<MinaTarefa>({
          supabase,
          getCurrent: () => detailTarefa,
          setCurrent: (next) => setDetailTarefa(next),
        })}
      />
    </div>
    </ProcessoTagMapCtx.Provider>
  );
}
