import { useState, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CheckCircle2, ChevronDown, ChevronRight, ListChecks, LayoutGrid,
  Calendar as CalendarIcon, Plus, Search, Lock, Users as UsersIcon, Flag,
} from "lucide-react";
import { format, isToday, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { useMinhasTarefas, type MinaTarefa } from "@/hooks/useMinhasTarefas";
import { useAuth } from "@/contexts/AuthContext";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";
import { supabase } from "@/integrations/supabase/client";

import { TarefaResponsavelAvatar } from "@/components/projetos/shared/TarefaResponsavelAvatar";
import { NovaTarefaMinhasDialog } from "@/components/projetos/NovaTarefaMinhasDialog";
import { ProjetoTarefaDetalhe } from "@/components/projetos/ProjetoTarefaDetalhe";
import { MinhasTarefasBoard } from "@/components/minhas-tarefas/MinhasTarefasBoard";
import { MinhasTarefasCalendar } from "@/components/minhas-tarefas/MinhasTarefasCalendar";
import type { ProjetoTarefa, ProjetoSecao } from "@/hooks/useProjetoTarefas";

type ViewMode = "list" | "board" | "calendar";
type SortMode = "due_asc" | "due_desc" | "created_desc" | "priority";

/* ------------------------------ Grupos Asana ------------------------------ */

interface SimpleGroup {
  key: string;
  label: string;
  items: MinaTarefa[];
  defaultCollapsed?: boolean;
  tone?: string;
}

function groupAsanaStyle(tarefas: MinaTarefa[]): SimpleGroup[] {
  const now = startOfDay(new Date());
  const in7 = new Date(now);
  in7.setDate(in7.getDate() + 7);

  const recentes: MinaTarefa[] = [];
  const hoje: MinaTarefa[] = [];
  const proxSemana: MinaTarefa[] = [];
  const maisTarde: MinaTarefa[] = [];
  const concluidas: MinaTarefa[] = [];

  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  for (const t of tarefas) {
    if (t.status === "concluida") {
      concluidas.push(t);
      continue;
    }
    const prazo = parseLocalDate(t.data_prazo);
    if (prazo && (isToday(prazo) || isBefore(startOfDay(prazo), now))) {
      hoje.push(t);
      continue;
    }
    if (prazo && isBefore(startOfDay(prazo), in7)) {
      proxSemana.push(t);
      continue;
    }
    const created = t.created_at ? new Date(t.created_at) : null;
    if (created && created >= sevenDaysAgo && !prazo) {
      recentes.push(t);
      continue;
    }
    maisTarde.push(t);
  }

  return [
    { key: "recentes", label: "Atribuídas recentemente", items: recentes },
    { key: "hoje", label: "A fazer hoje", items: hoje, tone: "text-primary" },
    { key: "semana", label: "A fazer na próxima semana", items: proxSemana },
    { key: "mais_tarde", label: "A fazer mais tarde", items: maisTarde, tone: "text-muted-foreground" },
    { key: "concluidas", label: "Concluídas recentemente", items: concluidas.slice(0, 10), defaultCollapsed: true, tone: "text-success" },
  ].filter((g) => g.items.length > 0);
}

/* --------------------------------- Linha --------------------------------- */

function VisibilidadeBadge({ value }: { value: string | null }) {
  if (value === "privada") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
        <Lock className="h-3 w-3" /> Somente eu
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
      <UsersIcon className="h-3 w-3" /> Equipe
    </span>
  );
}

function Row({
  t, onToggle, onSelect,
}: {
  t: MinaTarefa;
  onToggle: (id: string, done: boolean) => void;
  onSelect: (t: MinaTarefa) => void;
}) {
  const done = t.status === "concluida";
  const prazo = parseLocalDate(t.data_prazo);
  const now = startOfDay(new Date());
  const atrasada = !done && prazo && isBefore(startOfDay(prazo), now);

  return (
    <div
      className={cn(
        "group grid items-center gap-3 px-4 py-2 border-b border-border/30 hover:bg-muted/30 cursor-pointer transition-colors",
        "grid-cols-[24px_minmax(0,1fr)_120px_140px_160px_120px]",
      )}
      onClick={() => onSelect(t)}
    >
      <Checkbox
        checked={done}
        onCheckedChange={(c) => onToggle(t.id, !!c)}
        onClick={(e) => e.stopPropagation()}
        className="h-4 w-4"
      />
      <div className="min-w-0 flex items-center gap-2">
        <span className={cn("text-sm truncate", done && "line-through text-muted-foreground")}>
          {t.titulo}
        </span>
      </div>
      <div className={cn("text-xs", atrasada ? "text-destructive font-medium" : "text-muted-foreground")}>
        {prazo ? format(prazo, "d 'de' MMM", { locale: ptBR }) : "—"}
      </div>
      <div className="flex items-center gap-1">
        {t.responsavel_id ? (
          <TarefaResponsavelAvatar
            responsavelId={t.responsavel_id}
            nome={t.responsavel_nome}
            avatarUrl={t.responsavel_avatar_url}
            size="xs"
          />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="h-2 w-2 rounded-full shrink-0"
          style={{ backgroundColor: t.projeto_cor }}
        />
        <span className="text-xs text-muted-foreground truncate">{t.projeto_nome}</span>
      </div>
      <VisibilidadeBadge value={t.visibilidade} />
    </div>
  );
}

/* -------------------------------- Seção UI ------------------------------- */

function Section({
  group, onToggle, onSelect,
}: {
  group: SimpleGroup;
  onToggle: (id: string, done: boolean) => void;
  onSelect: (t: MinaTarefa) => void;
}) {
  const [collapsed, setCollapsed] = useState(!!group.defaultCollapsed);
  return (
    <div>
      <button
        className="flex items-center gap-2 w-full px-4 py-2 bg-muted/20 border-b border-border/30 hover:bg-muted/40 transition-colors text-left"
        onClick={() => setCollapsed(!collapsed)}
      >
        {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        <span className={cn("text-xs font-semibold uppercase tracking-wider", group.tone)}>
          {group.label}
        </span>
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 ml-1">
          {group.items.length}
        </Badge>
      </button>
      {!collapsed && (
        <>
          {group.items.map((t) => (
            <Row key={t.id} t={t} onToggle={onToggle} onSelect={onSelect} />
          ))}
          <button
            className="w-full text-left px-4 py-1.5 text-xs text-muted-foreground hover:bg-muted/20 border-b border-border/30"
            disabled
            title="Use o botão Adicionar tarefa acima"
          >
            Adicionar tarefa…
          </button>
        </>
      )}
    </div>
  );
}

/* -------------------------------- Página --------------------------------- */

export function MinhasTarefasSimples() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: tarefas = [], isLoading } = useMinhasTarefas();

  const [view, setView] = useState<ViewMode>("list");
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [sortMode, setSortMode] = useState<SortMode>("due_asc");

  const [showNewTask, setShowNewTask] = useState(false);
  const [detailTarefa, setDetailTarefa] = useState<MinaTarefa | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const projects = useMemo(() => {
    const map = new Map<string, { id: string; nome: string; cor: string }>();
    tarefas.forEach((t) => map.set(t.projeto_id, { id: t.projeto_id, nome: t.projeto_nome, cor: t.projeto_cor }));
    return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [tarefas]);

  const filtered = useMemo(() => {
    let result = tarefas;
    if (projectFilter !== "all") {
      result = result.filter((t) => t.projeto_id === projectFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((t) =>
        t.titulo.toLowerCase().includes(q) ||
        (t.codigo || "").toLowerCase().includes(q) ||
        t.projeto_nome.toLowerCase().includes(q));
    }
    const sorted = [...result];
    sorted.sort((a, b) => {
      switch (sortMode) {
        case "due_asc": {
          const da = parseLocalDate(a.data_prazo)?.getTime() ?? Infinity;
          const db = parseLocalDate(b.data_prazo)?.getTime() ?? Infinity;
          return da - db;
        }
        case "due_desc": {
          const da = parseLocalDate(a.data_prazo)?.getTime() ?? -Infinity;
          const db = parseLocalDate(b.data_prazo)?.getTime() ?? -Infinity;
          return db - da;
        }
        case "created_desc":
          return (new Date(b.created_at).getTime()) - (new Date(a.created_at).getTime());
        case "priority": {
          const order: Record<string, number> = { urgente: 0, alta: 1, media: 2, baixa: 3 };
          return (order[a.prioridade || "media"] ?? 9) - (order[b.prioridade || "media"] ?? 9);
        }
      }
    });
    return sorted;
  }, [tarefas, projectFilter, search, sortMode]);

  const groups = useMemo(() => groupAsanaStyle(filtered), [filtered]);

  /* ----------------------------- Toggle status ---------------------------- */
  const handleToggle = useCallback(async (id: string, done: boolean) => {
    if (done) {
      const { confirmConclusaoTarefa } = await import("@/lib/projetos/confirmConclusao");
      const ok = await confirmConclusaoTarefa({});
      if (!ok) return;
    }
    const update: Record<string, any> = {
      status: done ? "concluida" : "pendente",
      data_conclusao: done ? new Date().toISOString() : null,
    };
    const { error } = await supabase.from("projeto_tarefas").update(update as never).eq("id", id);
    if (error) { toast.error("Erro ao atualizar tarefa"); return; }
    queryClient.invalidateQueries({ queryKey: ["minhas-tarefas"] });
    toast.success(done ? "Tarefa concluída" : "Tarefa reaberta");
  }, [queryClient]);

  /* ----------------------------- Detalhe sheet ---------------------------- */
  const handleSelect = useCallback((t: MinaTarefa) => {
    setDetailTarefa(t);
    setDetailOpen(true);
  }, []);

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
    } as ProjetoTarefa;
  }, [detailTarefa]);

  const selectedProjetoId = detailTarefa?.projeto_id;
  const { data: bridgedSecoes = [] } = useQuery({
    queryKey: ["projeto-secoes-bridge-mt", selectedProjetoId],
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
    if ((updates as any).status === "concluida") {
      const { confirmConclusaoTarefa } = await import("@/lib/projetos/confirmConclusao");
      const ok = await confirmConclusaoTarefa({});
      if (!ok) return;
    }
    const { error } = await supabase.from("projeto_tarefas").update(updates as any).eq("id", id);
    if (error) { toast.error("Erro ao atualizar"); return; }
    queryClient.invalidateQueries({ queryKey: ["minhas-tarefas"] });
    if (detailTarefa) setDetailTarefa({ ...detailTarefa, ...updates } as MinaTarefa);
  }, [queryClient, detailTarefa]);

  const handleBridgeToggle = useCallback(async (t: ProjetoTarefa) => {
    await handleToggle(t.id, t.status !== "concluida");
  }, [handleToggle]);

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
  }, [queryClient]);

  /* ---------------------------------- UI ---------------------------------- */
  return (
    <TooltipProvider>
      <div className="w-full space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Minhas tarefas</h1>
            <p className="text-sm text-muted-foreground">
              Visão simplificada das suas tarefas. Para filtros avançados, use a Central de Trabalho.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setShowNewTask(true)} className="gap-1.5">
              <Plus className="h-4 w-4" /> Adicionar tarefa
            </Button>
          </div>
        </div>

        {/* Tabs + filtros */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
            <TabsList>
              <TabsTrigger value="list" className="gap-1.5">
                <ListChecks className="h-4 w-4" /> Lista
              </TabsTrigger>
              <TabsTrigger value="board" className="gap-1.5">
                <LayoutGrid className="h-4 w-4" /> Quadro
              </TabsTrigger>
              <TabsTrigger value="calendar" className="gap-1.5">
                <CalendarIcon className="h-4 w-4" /> Calendário
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar tarefa…"
                className="h-8 w-56 pl-8 text-sm"
              />
            </div>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="h-8 w-48 text-sm">
                <SelectValue placeholder="Projeto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os projetos</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
              <SelectTrigger className="h-8 w-44 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="due_asc">Vencimento ↑</SelectItem>
                <SelectItem value="due_desc">Vencimento ↓</SelectItem>
                <SelectItem value="created_desc">Mais recentes</SelectItem>
                <SelectItem value="priority">Prioridade</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Conteúdo */}
        {view === "list" ? (
          <Card className="overflow-hidden">
            {isLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : groups.length === 0 ? (
              <div className="p-10">
                <EmptyState
                  icon={CheckCircle2}
                  title="Você não tem tarefas atribuídas"
                  description="Quando alguém te atribuir uma tarefa, ela aparece aqui."
                >
                  <Button size="sm" onClick={() => setShowNewTask(true)} className="gap-1.5">
                    <Plus className="h-4 w-4" /> Criar minha primeira tarefa
                  </Button>
                </EmptyState>
              </div>
            ) : (
              <>
                {/* Cabeçalho de colunas */}
                <div
                  className={cn(
                    "grid items-center gap-3 px-4 py-2 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border/40 bg-background",
                    "grid-cols-[24px_minmax(0,1fr)_120px_140px_160px_120px]",
                  )}
                >
                  <span />
                  <span>Nome</span>
                  <span>Data de conclusão</span>
                  <span>Colaboradores</span>
                  <span>Projeto</span>
                  <span>Visibilidade</span>
                </div>
                {groups.map((g) => (
                  <Section key={g.key} group={g} onToggle={handleToggle} onSelect={handleSelect} />
                ))}
              </>
            )}
          </Card>
        ) : view === "board" ? (
          <MinhasTarefasBoard tarefas={filtered} onToggle={handleToggle} onSelect={handleSelect} />
        ) : (
          <MinhasTarefasCalendar tarefas={filtered} onSelect={handleSelect} />
        )}

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
    </TooltipProvider>
  );
}
