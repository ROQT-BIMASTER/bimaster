import { useState, useMemo } from "react";
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
import { 
  CheckCircle2, ChevronDown, ChevronRight, Circle, 
  LayoutList, LayoutGrid, Search, Calendar, AlertTriangle,
  Clock, Filter
} from "lucide-react";
import { format, isToday, startOfWeek, addDays, isSameDay, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { NovaTarefaMinhasDialog } from "@/components/projetos/NovaTarefaMinhasDialog";

// ─── Board Column ───────────────────────────────────────────
function BoardColumn({ 
  title, icon, color, tasks, onToggle, onNavigate 
}: { 
  title: string; 
  icon: React.ReactNode; 
  color: string; 
  tasks: MinaTarefa[]; 
  onToggle: (id: string, done: boolean) => void;
  onNavigate: (t: MinaTarefa) => void;
}) {
  return (
    <div className="flex-1 min-w-[260px]">
      <div className={`flex items-center gap-2 px-3 py-2 mb-2 rounded-md bg-muted/40 border border-border/30`}>
        {icon}
        <span className={`text-xs font-semibold uppercase tracking-wider ${color}`}>{title}</span>
        <Badge variant="secondary" className="text-[10px] ml-auto h-4 px-1.5">{tasks.length}</Badge>
      </div>
      <div className="space-y-2 max-h-[calc(100vh-260px)] overflow-y-auto pr-1">
        {tasks.map(t => (
          <Card 
            key={t.id} 
            className="hover:shadow-md transition-all cursor-pointer border-l-3"
            style={{ borderLeftColor: t.projeto_cor }}
            onClick={() => onNavigate(t)}
          >
            <CardContent className="p-3 space-y-2">
              <div className="flex items-start gap-2">
                <Checkbox
                  checked={t.status === "concluida"}
                  onCheckedChange={(checked) => onToggle(t.id, !!checked)}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-0.5 rounded-full h-4 w-4"
                />
                <span className={`text-sm flex-1 ${t.status === "concluida" ? "line-through text-muted-foreground" : ""}`}>
                  {t.titulo}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: t.projeto_cor }} />
                  <span className="truncate max-w-[100px]">{t.projeto_nome}</span>
                </div>
                {t.data_prazo && (
                  <span className={`ml-auto ${!t.data_conclusao && new Date(t.data_prazo) < new Date() ? "text-destructive font-medium" : ""}`}>
                    {format(new Date(t.data_prazo), "d MMM", { locale: ptBR })}
                  </span>
                )}
              </div>
              {t.prioridade && t.prioridade !== "media" && (
                <Badge variant={t.prioridade === "alta" || t.prioridade === "urgente" ? "destructive" : "secondary"} className="text-[10px] h-4">
                  {t.prioridade === "alta" ? "Alta" : t.prioridade === "urgente" ? "Urgente" : "Baixa"}
                </Badge>
              )}
            </CardContent>
          </Card>
        ))}
        {tasks.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-xs">Nenhuma tarefa</div>
        )}
      </div>
    </div>
  );
}

// ─── Calendar View ──────────────────────────────────────────
function CalendarView({ 
  tarefas, onToggle, onNavigate 
}: { 
  tarefas: MinaTarefa[]; 
  onToggle: (id: string, done: boolean) => void;
  onNavigate: (t: MinaTarefa) => void;
}) {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map(day => {
        const dayTasks = tarefas.filter(t => t.data_prazo && isSameDay(new Date(t.data_prazo), day));
        const isCurrentDay = isToday(day);
        return (
          <div key={day.toISOString()} className={`min-h-[200px] rounded-lg border p-2 ${isCurrentDay ? "border-primary bg-primary/5" : "border-border/40"}`}>
            <div className={`text-xs font-medium mb-2 ${isCurrentDay ? "text-primary" : "text-muted-foreground"}`}>
              {format(day, "EEE d", { locale: ptBR })}
            </div>
            <div className="space-y-1">
              {dayTasks.map(t => (
                <div 
                  key={t.id} 
                  className="text-[11px] px-1.5 py-1 rounded bg-muted/50 hover:bg-muted cursor-pointer truncate flex items-center gap-1"
                  onClick={() => onNavigate(t)}
                >
                  <div className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: t.projeto_cor }} />
                  <span className={t.status === "concluida" ? "line-through text-muted-foreground" : ""}>{t.titulo}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── List Row ───────────────────────────────────────────────
function ListRow({ tarefa, onToggle, onNavigate }: { tarefa: MinaTarefa; onToggle: (id: string, done: boolean) => void; onNavigate: (t: MinaTarefa) => void }) {
  const isDone = tarefa.status === "concluida";
  const isOverdue = !isDone && tarefa.data_prazo && new Date(tarefa.data_prazo) < new Date();

  return (
    <div 
      className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors cursor-pointer border-b border-border/20 last:border-b-0 group"
      onClick={() => onNavigate(tarefa)}
    >
      <Checkbox
        checked={isDone}
        onCheckedChange={(checked) => onToggle(tarefa.id, !!checked)}
        onClick={(e) => e.stopPropagation()}
        className="rounded-full h-4 w-4"
      />
      <span className={`flex-1 text-sm ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>
        {tarefa.titulo}
      </span>
      {tarefa.prioridade && tarefa.prioridade !== "media" && (
        <Badge variant={tarefa.prioridade === "alta" || tarefa.prioridade === "urgente" ? "destructive" : "outline"} className="text-[10px] h-4 hidden sm:flex">
          {tarefa.prioridade === "alta" ? "Alta" : tarefa.prioridade === "urgente" ? "Urgente" : "Baixa"}
        </Badge>
      )}
      {tarefa.data_prazo && (
        <span className={`text-xs ${isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
          {format(new Date(tarefa.data_prazo), "d MMM", { locale: ptBR })}
        </span>
      )}
      <div className="flex items-center gap-1.5">
        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: tarefa.projeto_cor }} />
        <span className="text-xs text-muted-foreground hidden lg:inline max-w-[120px] truncate">{tarefa.projeto_nome}</span>
      </div>
    </div>
  );
}

function ListSection({ group, onToggle, onNavigate }: { group: { label: string; key: string; items: MinaTarefa[] }; onToggle: (id: string, done: boolean) => void; onNavigate: (t: MinaTarefa) => void }) {
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
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 ml-1">{group.items.length}</Badge>
      </button>
      {!collapsed && group.items.map(t => (
        <ListRow key={t.id} tarefa={t} onToggle={onToggle} onNavigate={onNavigate} />
      ))}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────
export default function MinhasTarefas() {
  const { data: tarefas = [], isLoading } = useMinhasTarefas();
  const [view, setView] = useState<"list" | "board" | "calendar">("list");
  const [search, setSearch] = useState("");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [showNewTask, setShowNewTask] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const filtered = useMemo(() => {
    let result = tarefas;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(t => t.titulo.toLowerCase().includes(q) || t.projeto_nome.toLowerCase().includes(q));
    }
    if (filterPriority !== "all") {
      result = result.filter(t => t.prioridade === filterPriority);
    }
    return result;
  }, [tarefas, search, filterPriority]);

  const groups = useMemo(() => groupTarefas(filtered), [filtered]);
  const pendentes = filtered.filter(t => t.status !== "concluida");
  const atrasadas = pendentes.filter(t => t.data_prazo && new Date(t.data_prazo) < new Date());

  const handleToggle = async (tarefaId: string, done: boolean) => {
    const update: any = { status: done ? "concluida" : "pendente" };
    if (done) update.data_conclusao = new Date().toISOString();
    else update.data_conclusao = null;

    const { error } = await supabase.from("projeto_tarefas").update(update).eq("id", tarefaId);
    if (error) { toast.error("Erro ao atualizar tarefa"); return; }

    queryClient.invalidateQueries({ queryKey: ["minhas-tarefas"] });
    toast.success(done ? "Tarefa concluída!" : "Tarefa reaberta");
  };

  const handleNavigate = (t: MinaTarefa) => navigate(`/dashboard/projetos/${t.projeto_id}`);

  // Board grouping
  const boardGroups = useMemo(() => {
    const now = startOfDay(new Date());
    const overdue: MinaTarefa[] = [];
    const today: MinaTarefa[] = [];
    const upcoming: MinaTarefa[] = [];
    const done: MinaTarefa[] = [];

    for (const t of filtered) {
      if (t.status === "concluida") { done.push(t); continue; }
      if (!t.data_prazo) { upcoming.push(t); continue; }
      const d = startOfDay(new Date(t.data_prazo));
      if (d < now) overdue.push(t);
      else if (isToday(d)) today.push(t);
      else upcoming.push(t);
    }
    return { overdue, today, upcoming, done: done.slice(0, 10) };
  }, [filtered]);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <div className="p-6 max-w-6xl mx-auto space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <SidebarTrigger />
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-6 w-6 text-primary" />
                  <h1 className="text-2xl font-bold text-foreground">Minhas Tarefas</h1>
                </div>
                <div className="hidden md:flex items-center gap-3 ml-4 text-sm text-muted-foreground">
                  <span>{pendentes.length} pendentes</span>
                  {atrasadas.length > 0 && (
                    <span className="text-destructive flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" /> {atrasadas.length} atrasadas
                    </span>
                  )}
                <Button size="sm" className="gap-1.5" onClick={() => setShowNewTask(true)}>
                  <Plus className="h-4 w-4" /> Nova Tarefa
                </Button>
              </div>
              </div>

              {/* View Switcher */}
              <Tabs value={view} onValueChange={(v) => setView(v as any)}>
                <TabsList className="h-8">
                  <TabsTrigger value="list" className="text-xs gap-1 px-2"><LayoutList className="h-3.5 w-3.5" /> Lista</TabsTrigger>
                  <TabsTrigger value="board" className="text-xs gap-1 px-2"><LayoutGrid className="h-3.5 w-3.5" /> Quadro</TabsTrigger>
                  <TabsTrigger value="calendar" className="text-xs gap-1 px-2"><Calendar className="h-3.5 w-3.5" /> Calendário</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-xs">
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
                  <Filter className="h-3 w-3 mr-1" />
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
            </div>

            {/* Content */}
            {isLoading ? (
              <div className="space-y-3">
                {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : view === "list" ? (
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  {groups.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                      <CheckCircle2 className="h-10 w-10 mb-3 opacity-40" />
                      <p className="font-medium">Nenhuma tarefa encontrada</p>
                    </div>
                  ) : (
                    groups.map(g => <ListSection key={g.key} group={g} onToggle={handleToggle} onNavigate={handleNavigate} />)
                  )}
                </CardContent>
              </Card>
            ) : view === "board" ? (
              <div className="flex gap-4 overflow-x-auto pb-4">
                <BoardColumn 
                  title="Atrasadas" 
                  icon={<AlertTriangle className="h-4 w-4 text-destructive" />} 
                  color="text-destructive" 
                  tasks={boardGroups.overdue} 
                  onToggle={handleToggle} 
                  onNavigate={handleNavigate} 
                />
                <BoardColumn 
                  title="Hoje" 
                  icon={<Clock className="h-4 w-4 text-primary" />} 
                  color="text-primary" 
                  tasks={boardGroups.today} 
                  onToggle={handleToggle} 
                  onNavigate={handleNavigate} 
                />
                <BoardColumn 
                  title="A fazer" 
                  icon={<Circle className="h-4 w-4 text-muted-foreground" />} 
                  color="text-foreground" 
                  tasks={boardGroups.upcoming} 
                  onToggle={handleToggle} 
                  onNavigate={handleNavigate} 
                />
                <BoardColumn 
                  title="Concluídas" 
                  icon={<CheckCircle2 className="h-4 w-4 text-success" />} 
                  color="text-success" 
                  tasks={boardGroups.done} 
                  onToggle={handleToggle} 
                  onNavigate={handleNavigate} 
                />
              </div>
            ) : (
              <CalendarView tarefas={filtered} onToggle={handleToggle} onNavigate={handleNavigate} />
            )}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
