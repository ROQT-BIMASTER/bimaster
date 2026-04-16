import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useMinhasTarefas, groupTarefas, type MinaTarefa } from "@/hooks/useMinhasTarefas";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/AppSidebar";
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
  Search, Calendar, AlertTriangle, Clock, Filter, Plus, Trash2, Flag,
} from "lucide-react";
import { format, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery as useRQQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { NovaTarefaMinhasDialog } from "@/components/projetos/NovaTarefaMinhasDialog";
import { MinhasTarefasKPIs } from "@/components/minhas-tarefas/MinhasTarefasKPIs";
import { ProjetoTarefaDetalhe } from "@/components/projetos/ProjetoTarefaDetalhe";
import { MinhasTarefasBoard } from "@/components/minhas-tarefas/MinhasTarefasBoard";
import { MinhasTarefasCalendar } from "@/components/minhas-tarefas/MinhasTarefasCalendar";
import { TourButton, minhasTarefasTourSteps, MINHAS_TAREFAS_TOUR_ID } from "@/components/tour";
import { usePageBgColor } from "@/hooks/usePageBgColor";
import { ProjetoBgColorPicker } from "@/components/projetos/ProjetoBgColorPicker";
import { CustomDashboardBuilder } from "@/components/minhas-tarefas/CustomDashboardBuilder";
import { BarChart3 } from "lucide-react";
import type { ProjetoTarefa, ProjetoSecao } from "@/hooks/useProjetoTarefas";

// ─── List Row ───────────────────────────────────────────────
function ListRow({
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
      <div
        className="h-2 w-2 rounded-full shrink-0"
        style={{ backgroundColor: tarefa.projeto_cor }}
      />
      <span className={`flex-1 text-sm ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>
        {tarefa.titulo}
      </span>
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
      <span className="text-xs text-muted-foreground hidden lg:inline max-w-[120px] truncate">
        {tarefa.projeto_nome}
      </span>
    </div>
  );
}

function ListSection({
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
}

// ─── Main Page ──────────────────────────────────────────────
export default function MinhasTarefas() {
  const { data: tarefas = [], isLoading } = useMinhasTarefas();
  const { user } = useAuth();

  // Fetch user profile name
  const { data: profileData } = useQuery({
    queryKey: ["my-profile-name", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase.from("profiles").select("nome").eq("id", user.id).single();
      return data;
    },
    enabled: !!user?.id,
  });
  const [view, setView] = useState<"list" | "board" | "calendar" | "dashboard">("list");
  const [search, setSearch] = useState("");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterProject, setFilterProject] = useState<string>("all");
  const [showNewTask, setShowNewTask] = useState(false);
  const [detailTarefa, setDetailTarefa] = useState<MinaTarefa | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Unique projects for filter
  const projects = useMemo(() => {
    const map = new Map<string, { id: string; nome: string; cor: string }>();
    tarefas.forEach((t) => map.set(t.projeto_id, { id: t.projeto_id, nome: t.projeto_nome, cor: t.projeto_cor }));
    return Array.from(map.values());
  }, [tarefas]);

  const filtered = useMemo(() => {
    let result = tarefas;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) => t.titulo.toLowerCase().includes(q) || t.projeto_nome.toLowerCase().includes(q)
      );
    }
    if (filterPriority !== "all") {
      result = result.filter((t) => t.prioridade === filterPriority);
    }
    if (filterProject !== "all") {
      result = result.filter((t) => t.projeto_id === filterProject);
    }
    return result;
  }, [tarefas, search, filterPriority, filterProject]);

  const groups = useMemo(() => groupTarefas(filtered), [filtered]);

  const handleToggle = useCallback(
    async (tarefaId: string, done: boolean) => {
      const update: Record<string, any> = { status: done ? "concluida" : "pendente" };
      if (done) update.data_conclusao = new Date().toISOString();
      else update.data_conclusao = null;

      const { error } = await supabase.from("projeto_tarefas").update(update).eq("id", tarefaId);
      if (error) {
        toast.error("Erro ao atualizar tarefa");
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["minhas-tarefas"] });
      toast.success(done ? "Tarefa concluída! ✓" : "Tarefa reaberta");
    },
    [queryClient]
  );

  const handleSelectTask = useCallback((t: MinaTarefa) => {
    setDetailTarefa(t);
    setDetailOpen(true);
  }, []);

  const handleSelectToggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Bulk actions
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

  // Greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const firstName = profileData?.nome?.split(" ")[0] || "";
  const { bgColor, setBgColor } = usePageBgColor("minhas_tarefas");

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto" style={bgColor ? { backgroundColor: bgColor } : undefined}>
          <div className="p-6 max-w-6xl mx-auto space-y-5">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <SidebarTrigger />
                <ProjetoBgColorPicker value={bgColor} onChange={setBgColor} />
                <div>
                  <p className="text-sm text-muted-foreground">
                    {greeting}, {firstName} 👋
                  </p>
                  <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                    <CheckCircle2 className="h-6 w-6 text-primary" />
                    Minhas Tarefas
                  </h1>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button size="sm" className="gap-1.5" onClick={() => setShowNewTask(true)} data-tour="mt-nova-tarefa">
                  <Plus className="h-4 w-4" /> Nova Tarefa
                </Button>
                <Tabs value={view} onValueChange={(v) => setView(v as any)} data-tour="mt-views">
                  <TabsList className="h-8">
                    <TabsTrigger value="list" className="text-xs gap-1 px-2">
                      <LayoutList className="h-3.5 w-3.5" /> Lista
                    </TabsTrigger>
                    <TabsTrigger value="board" className="text-xs gap-1 px-2">
                      <LayoutGrid className="h-3.5 w-3.5" /> Quadro
                    </TabsTrigger>
                    <TabsTrigger value="calendar" className="text-xs gap-1 px-2">
                      <Calendar className="h-3.5 w-3.5" /> Calendário
                    </TabsTrigger>
                    <TabsTrigger value="dashboard" className="text-xs gap-1 px-2">
                      <BarChart3 className="h-3.5 w-3.5" /> Dashboard
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>

            {/* KPIs */}
            <div data-tour="mt-kpis">
              <MinhasTarefasKPIs tarefas={tarefas} loading={isLoading} />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3" data-tour="mt-filters">
              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar tarefas..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>
              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger className="w-[130px] h-8 text-xs">
                  <Flag className="h-3 w-3 mr-1" />
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
                <SelectTrigger className="w-[160px] h-8 text-xs">
                  <Filter className="h-3 w-3 mr-1" />
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
            </div>

            {/* Bulk Actions Bar */}
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-3 px-4 py-2.5 bg-primary/5 border border-primary/20 rounded-lg animate-in fade-in slide-in-from-bottom-2">
                <Badge variant="secondary" className="text-xs">
                  {selectedIds.size} selecionadas
                </Badge>
                <Button size="sm" variant="default" className="h-7 text-xs gap-1" onClick={handleBulkComplete}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Concluir
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => setSelectedIds(new Set())}
                >
                  Limpar seleção
                </Button>
              </div>
            )}

            {/* Content */}
            <div data-tour="mt-content">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : view === "list" ? (
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
            ) : view === "board" ? (
              <MinhasTarefasBoard
                tarefas={filtered}
                onToggle={handleToggle}
                onSelect={handleSelectTask}
              />
            ) : view === "calendar" ? (
              <MinhasTarefasCalendar tarefas={filtered} onSelect={handleSelectTask} />
            ) : (
              <CustomDashboardBuilder tarefas={filtered} />
            )}
            </div>

            {/* Dialogs */}
            <NovaTarefaMinhasDialog open={showNewTask} onOpenChange={setShowNewTask} />
            <MinhasTarefaDetail tarefa={detailTarefa} open={detailOpen} onOpenChange={setDetailOpen} />
          </div>
        </main>
      </div>
      <TourButton tourId={MINHAS_TAREFAS_TOUR_ID} tourSteps={minhasTarefasTourSteps} title="Manual de Tarefas" description="Aprenda a gerenciar suas tarefas passo a passo" />
    </SidebarProvider>
  );
}
