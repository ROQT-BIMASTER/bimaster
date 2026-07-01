import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useBridgeSaveRetry } from "@/hooks/useBridgeSaveRetry";
import {
  CheckCircle2, ChevronDown, ChevronRight, ListChecks, LayoutGrid,
  Calendar as CalendarIcon, Plus, Search, Lock, Users as UsersIcon, Flag, Trash2,
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
import { parseLocalDate, getToday, getCurrentHourBR, nowSaoPauloISO } from "@/lib/utils/parseLocalDate";
import { supabase } from "@/integrations/supabase/client";

import { NovaTarefaMinhasDialog } from "@/components/projetos/NovaTarefaMinhasDialog";
import { ProjetoTarefaDetalhe } from "@/components/projetos/ProjetoTarefaDetalhe";
import { MinhasTarefasBoard } from "@/components/minhas-tarefas/MinhasTarefasBoard";
import { MinhasTarefasCalendar } from "@/components/minhas-tarefas/MinhasTarefasCalendar";
import { CentralChip } from "@/components/projetos/central/CentralChips";
import {
  MinhasTarefaResponsavelInline,
  MinhasTarefaColaboradoresInline,
  ProjetoInlinePicker,
} from "@/components/minhas-tarefas/MinhasTarefaInlinePickers";
import { useProjetoPessoal } from "@/hooks/useProjetoPessoal";
import type { ProjetoTarefa, ProjetoSecao } from "@/hooks/useProjetoTarefas";
import { acquireDetailGate, releaseDetailGate } from "@/hooks/projetoTarefasOpenGate";

function getGreeting() {
  const h = getCurrentHourBR();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

type ViewMode = "list" | "board" | "calendar";
type SortMode = "due_asc" | "due_desc" | "created_desc" | "priority";
type QuickFilter = "all" | "sem_data" | "hoje" | "atrasadas" | "concluidas_hoje";
type PriorityFilter = "all" | "urgente" | "alta" | "media" | "baixa";
type OriginFilter = "all" | "pessoal" | "projetos";

const PRIORITY_META: Record<string, { label: string; tone: string }> = {
  urgente: { label: "Urgente", tone: "text-destructive" },
  alta: { label: "Alta", tone: "text-warning" },
  baixa: { label: "Baixa", tone: "text-muted-foreground" },
};

function PriorityFlag({ value }: { value: string | null | undefined }) {
  if (!value || value === "media") return null;
  const meta = PRIORITY_META[value];
  if (!meta) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Flag className={cn("h-3.5 w-3.5 shrink-0", meta.tone)} aria-label={meta.label} />
      </TooltipTrigger>
      <TooltipContent>{meta.label}</TooltipContent>
    </Tooltip>
  );
}

/* ------------------------------ Grupos Asana ------------------------------ */

interface SimpleGroup {
  key: string;
  label: string;
  items: MinaTarefa[];
  defaultCollapsed?: boolean;
  tone?: string;
}

function groupAsanaStyle(tarefas: MinaTarefa[]): SimpleGroup[] {
  const now = getToday();
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
  t, onToggle, onSelect, onDelete, currentUserId, projetoPessoalId,
}: {
  t: MinaTarefa;
  onToggle: (id: string, done: boolean) => void;
  onSelect: (t: MinaTarefa) => void;
  onDelete: (t: MinaTarefa) => void;
  currentUserId: string | null;
  projetoPessoalId: string | null;
}) {
  const done = t.status === "concluida";
  const prazo = parseLocalDate(t.data_prazo);
  const now = getToday();
  const atrasada = !done && prazo && isBefore(startOfDay(prazo), now);
  const isPessoal = !!projetoPessoalId && t.projeto_id === projetoPessoalId;
  const podeExcluir = !!currentUserId && t.criador_id === currentUserId;

  return (
    <div
      className={cn(
        "group grid items-center gap-3 px-4 py-2 border-b border-border/30 hover:bg-muted/30 cursor-pointer transition-colors",
        "grid-cols-[24px_minmax(0,1fr)_120px_90px_110px_160px_120px_28px]",
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
        <PriorityFlag value={t.prioridade} />
        <span className={cn("text-sm truncate", done && "line-through text-muted-foreground")}>
          {t.titulo}
        </span>
      </div>
      <div className={cn("text-xs", atrasada ? "text-destructive font-medium" : "text-muted-foreground")}>
        {prazo ? format(prazo, "d 'de' MMM", { locale: ptBR }) : "—"}
      </div>
      <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
        <MinhasTarefaResponsavelInline
          tarefaId={t.id}
          projetoId={t.projeto_id}
          responsavelId={t.responsavel_id}
          responsavelNome={t.responsavel_nome}
          responsavelAvatarUrl={t.responsavel_avatar_url}
        />
      </div>
      <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
        <MinhasTarefaColaboradoresInline tarefaId={t.id} projetoId={t.projeto_id} />
      </div>
      <div className="flex items-center min-w-0" onClick={(e) => e.stopPropagation()}>
        <ProjetoInlinePicker
          tarefaId={t.id}
          currentProjetoId={t.projeto_id}
          currentProjetoNome={t.projeto_nome}
          currentProjetoCor={t.projeto_cor}
          isPessoal={isPessoal}
        />
      </div>
      <VisibilidadeBadge value={t.visibilidade} />
      <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
        {podeExcluir ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onDelete(t)}
                className="h-6 w-6 rounded-md inline-flex items-center justify-center text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all"
                aria-label="Excluir tarefa"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Mover para a lixeira (30 dias)</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </div>
  );
}

/* -------------------------------- Seção UI ------------------------------- */

function Section({
  group, onToggle, onSelect, onDelete, currentUserId, projetoPessoalId,
}: {
  group: SimpleGroup;
  onToggle: (id: string, done: boolean) => void;
  onSelect: (t: MinaTarefa) => void;
  onDelete: (t: MinaTarefa) => void;
  currentUserId: string | null;
  projetoPessoalId: string | null;
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
            <Row
              key={t.id}
              t={t}
              onToggle={onToggle}
              onSelect={onSelect}
              onDelete={onDelete}
              currentUserId={currentUserId}
              projetoPessoalId={projetoPessoalId}
            />
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
  const { data: pessoal } = useProjetoPessoal();
  const projetoPessoalId = pessoal?.projeto_id ?? null;

  const { data: profileData } = useQuery({
    queryKey: ["my-profile-name", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("nome, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
  });

  const firstName = (profileData?.nome || user?.email || "").split(/[\s@]/)[0] || "";
  const today = format(getToday(), "EEEE, d 'de' MMMM", { locale: ptBR });

  const [view, setView] = useState<ViewMode>("list");
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [originFilter, setOriginFilter] = useState<OriginFilter>("all");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("due_asc");

  const [showNewTask, setShowNewTask] = useState(false);
  const [detailTarefa, setDetailTarefa] = useState<MinaTarefa | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const { isSaving: isBridgeSaving, attemptSave } = useBridgeSaveRetry();

  const projects = useMemo(() => {
    const map = new Map<string, { id: string; nome: string; cor: string }>();
    tarefas.forEach((t) => {
      if (projetoPessoalId && t.projeto_id === projetoPessoalId) return;
      map.set(t.projeto_id, { id: t.projeto_id, nome: t.projeto_nome, cor: t.projeto_cor });
    });
    return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [tarefas, projetoPessoalId]);

  // Contadores dos chips — calculados sobre o dataset completo para não
  // saltarem ao aplicar busca/projeto/prioridade.
  const chipCounts = useMemo(() => {
    const now = getToday();
    const pend = tarefas.filter((t) => t.status !== "concluida");
    return {
      todas: pend.length,
      semPrazo: pend.filter((t) => !t.data_prazo).length,
      hoje: pend.filter((t) => {
        const p = parseLocalDate(t.data_prazo);
        return p && isToday(p);
      }).length,
      atrasadas: pend.filter((t) => {
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

  const filtered = useMemo(() => {
    const now = getToday();
    let result = tarefas;
    if (quickFilter !== "all") {
      result = result.filter((t) => {
        const prazo = parseLocalDate(t.data_prazo);
        if (quickFilter === "sem_data") return t.status !== "concluida" && !t.data_prazo;
        if (quickFilter === "hoje") return t.status !== "concluida" && !!prazo && isToday(prazo);
        if (quickFilter === "atrasadas") return t.status !== "concluida" && !!prazo && isBefore(startOfDay(prazo), now);
        if (quickFilter === "concluidas_hoje") {
          const c = parseLocalDate(t.data_conclusao);
          return t.status === "concluida" && !!c && isToday(c);
        }
        return true;
      });
    }
    if (priorityFilter !== "all") {
      result = result.filter((t) => (t.prioridade || "media") === priorityFilter);
    }
    if (originFilter === "pessoal" && projetoPessoalId) {
      result = result.filter((t) => t.projeto_id === projetoPessoalId);
    } else if (originFilter === "projetos" && projetoPessoalId) {
      result = result.filter((t) => t.projeto_id !== projetoPessoalId);
    }
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
  }, [tarefas, quickFilter, priorityFilter, projectFilter, originFilter, projetoPessoalId, search, sortMode]);

  // Quando o filtro rápido é "concluidas_hoje", apresentamos lista plana
  // (sem os grupos Asana de pendentes).
  const groups = useMemo(() => {
    if (quickFilter === "concluidas_hoje") {
      return filtered.length
        ? [{ key: "flat", label: "Concluídas hoje", items: filtered, tone: "text-success" }]
        : [];
    }
    return groupAsanaStyle(filtered);
  }, [filtered, quickFilter]);

  /* ----------------------------- Toggle status ---------------------------- */
  const handleToggle = useCallback(async (id: string, done: boolean) => {
    if (done) {
      const { confirmConclusaoTarefa } = await import("@/lib/projetos/confirmConclusao");
      const ok = await confirmConclusaoTarefa({});
      if (!ok) return;
    }
    const update: Record<string, any> = {
      status: done ? "concluida" : "pendente",
      data_conclusao: done ? nowSaoPauloISO() : null,
    };
    const { data: fresh, error } = await supabase
      .from("projeto_tarefas")
      .update(update as never)
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error) { toast.error("Erro ao atualizar tarefa"); return; }
    if (!fresh) {
      toast.error("Você não tem permissão para alterar esta tarefa", {
        description: "Peça ao responsável ou ao criador para conceder acesso.",
      });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["minhas-tarefas"] });
    toast.success(done ? "Tarefa concluída" : "Tarefa reaberta");
  }, [queryClient]);

  /* ----------------------------- Alterar prazo (DnD) ---------------------- */
  const handleChangePrazo = useCallback(async (id: string, novaData: string | null) => {
    const { error } = await supabase
      .from("projeto_tarefas")
      .update({ data_prazo: novaData } as never)
      .eq("id", id);
    if (error) { toast.error("Erro ao atualizar prazo"); return; }
    queryClient.invalidateQueries({ queryKey: ["minhas-tarefas"] });
    toast.success("Prazo atualizado");
  }, [queryClient]);

  /* ----------------------------- Soft delete ----------------------------- */
  const handleDeleteTarefa = useCallback(async (t: MinaTarefa) => {
    if (!user?.id || t.criador_id !== user.id) {
      toast.error("Apenas o criador da tarefa pode excluí-la.");
      return;
    }
    const { confirmExclusaoTarefa } = await import("@/lib/projetos/confirmConclusao");
    const ok = await confirmExclusaoTarefa({
      titulo: t.titulo,
      isSubtarefa: !!t.parent_tarefa_id,
    });
    if (!ok) return;
    const { error } = await supabase
      .from("projeto_tarefas")
      .update({ excluida_em: nowSaoPauloISO(), excluida_por: user.id } as any)
      .eq("id", t.id);
    if (error) {
      toast.error("Não foi possível excluir a tarefa: " + error.message);
      return;
    }
    toast.success("Tarefa movida para a lixeira. Permanecerá por 30 dias.");
    queryClient.invalidateQueries({ queryKey: ["minhas-tarefas"] });
    queryClient.invalidateQueries({ queryKey: ["projeto-tarefas-v2"] });
  }, [queryClient, user?.id]);

  /* ----------------------------- Detalhe sheet ---------------------------- */
  const handleSelect = useCallback((t: MinaTarefa) => {
    setDetailTarefa(t);
    setDetailOpen(true);
  }, []);

  const selectedProjetoId = detailTarefa?.projeto_id;
  const detailTarefaId = detailTarefa?.id;

  useEffect(() => {
    if (!detailOpen || !selectedProjetoId) return;
    acquireDetailGate(selectedProjetoId);
    return () => releaseDetailGate(selectedProjetoId);
  }, [detailOpen, selectedProjetoId]);

  // Subtarefas ao vivo da tarefa aberta — Focus Mode reflete novas
  // subtarefas sem precisar fechar/reabrir o modal.
  const { data: bridgedSubtarefas = [] } = useQuery({
    queryKey: ["projeto-tarefas-subtarefas-bridge-mt", detailTarefaId],
    queryFn: async () => {
      if (!detailTarefaId) return [];
      const { fetchHydratedSubtarefas } = await import("@/lib/projetos/fetchHydratedSubtarefas");
      return fetchHydratedSubtarefas(detailTarefaId);
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
      subtarefas: bridgedSubtarefas,
    } as ProjetoTarefa;
  }, [detailTarefa, bridgedSubtarefas]);

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
    const result = await attemptSave("Salvar tarefa", () =>
      supabase.from("projeto_tarefas").update(updates as any).eq("id", id),
    );
    if (!result.ok) return;
    queryClient.invalidateQueries({ queryKey: ["minhas-tarefas"] });
    if (detailTarefa && detailTarefa.id === id) {
      setDetailTarefa({ ...detailTarefa, ...updates } as MinaTarefa);
    }
    if (detailTarefaId) {
      queryClient.setQueryData<ProjetoTarefa[]>(["projeto-tarefas-subtarefas-bridge-mt", detailTarefaId], (old = []) =>
        old.map((st) => st.id === id ? ({ ...st, ...updates } as ProjetoTarefa) : st),
      );
    }
  }, [queryClient, detailTarefa, detailTarefaId, attemptSave]);

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
    const result = await attemptSave(done ? "Concluir tarefa" : "Reabrir tarefa", () =>
      supabase.from("projeto_tarefas").update(update as never).eq("id", t.id),
    );
    if (!result.ok) return;
    queryClient.invalidateQueries({ queryKey: ["minhas-tarefas"] });
    if (detailTarefa && detailTarefa.id === t.id) {
      setDetailTarefa({ ...detailTarefa, ...update } as MinaTarefa);
    }
    if (detailTarefaId) {
      queryClient.setQueryData<ProjetoTarefa[]>(["projeto-tarefas-subtarefas-bridge-mt", detailTarefaId], (old = []) =>
        old.map((st) => st.id === t.id ? ({ ...st, ...update } as ProjetoTarefa) : st),
      );
    }
  }, [queryClient, detailTarefa, detailTarefaId, attemptSave]);

  const handleBridgeAddSubtarefa = useCallback(async (titulo: string, parentId: string, secaoId: string) => {
    if (!user?.id || !selectedProjetoId) return;
    const tempId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 6)}-4${Math.random().toString(16).slice(2, 5)}-a${Math.random().toString(16).slice(2, 5)}-${Math.random().toString(16).slice(2, 14)}`;
    const clientKey = `sub:${parentId}:${titulo.trim().toLowerCase()}:${tempId}`;
    const nowIso = nowSaoPauloISO();
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
      queryClient.setQueryData<ProjetoTarefa[]>(["projeto-tarefas-subtarefas-bridge-mt", detailTarefaId], (old = []) =>
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
        queryClient.setQueryData<ProjetoTarefa[]>(["projeto-tarefas-subtarefas-bridge-mt", detailTarefaId], (old = []) =>
          removeFromBranch(old),
        );
      }
      throw new Error("Não foi possível criar a subtarefa.");
    }
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
      queryClient.setQueryData<ProjetoTarefa[]>(["projeto-tarefas-subtarefas-bridge-mt", detailTarefaId], (old = []) =>
        swapInBranch(old),
      );
    }
  }, [queryClient, user?.id, selectedProjetoId, detailTarefaId, attemptSave]);

  const handleBridgeMoveTarefa = useCallback(async (tarefaId: string, _o: string, secaoDestinoId: string) => {
    const { error } = await supabase.from("projeto_tarefas").update({ secao_id: secaoDestinoId }).eq("id", tarefaId);
    if (error) { toast.error("Erro ao mover tarefa"); return; }
    queryClient.invalidateQueries({ queryKey: ["minhas-tarefas"] });
  }, [queryClient]);

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

  /* ---------------------------------- UI ---------------------------------- */
  return (
    <TooltipProvider>
      <div className="w-full space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-semibold text-foreground flex items-center gap-2 truncate">
              <ListChecks className="h-5 w-5 text-primary shrink-0" />
              <span className="truncate">
                <span className="hidden sm:inline">{getGreeting()}</span>
                {firstName ? <span className="sm:before:content-[',_']">{firstName}</span> : null}
              </span>
              <span className="hidden md:inline text-xs font-normal text-muted-foreground capitalize ml-2">
                · {today}
              </span>
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Minhas tarefas — visão pessoal. Para filtros avançados, use a Central de Trabalho.
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
            <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as PriorityFilter)}>
              <SelectTrigger className="h-8 w-40 text-sm" aria-label="Prioridade">
                <Flag className="h-3.5 w-3.5 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas prioridades</SelectItem>
                <SelectItem value="urgente">Urgente</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="media">Média</SelectItem>
                <SelectItem value="baixa">Baixa</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={originFilter}
              onValueChange={(v) => {
                const next = v as OriginFilter;
                setOriginFilter(next);
                if (next === "pessoal") setProjectFilter("all");
              }}
            >
              <SelectTrigger className="h-8 w-44 text-sm" aria-label="Origem">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as origens</SelectItem>
                <SelectItem value="pessoal">
                  <div className="flex items-center gap-2">
                    <Lock className="h-3 w-3" /> Tarefas pessoais
                  </div>
                </SelectItem>
                <SelectItem value="projetos">
                  <div className="flex items-center gap-2">
                    <UsersIcon className="h-3 w-3" /> Tarefas de projetos
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={projectFilter}
              onValueChange={setProjectFilter}
              disabled={originFilter === "pessoal"}
            >
              <SelectTrigger className="h-8 w-48 text-sm">
                <SelectValue placeholder="Projeto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os projetos</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: p.cor }} />
                      {p.nome}
                    </div>
                  </SelectItem>
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

        {/* Chips de filtro rápido por prazo */}
        <div className="flex flex-wrap items-center gap-1.5">
          <CentralChip label="Todas" count={chipCounts.todas}
            active={quickFilter === "all"} onClick={() => setQuickFilter("all")} />
          <CentralChip label="Sem prazo" count={chipCounts.semPrazo}
            active={quickFilter === "sem_data"} onClick={() => setQuickFilter("sem_data")} />
          <CentralChip label="Para hoje" count={chipCounts.hoje}
            active={quickFilter === "hoje"} onClick={() => setQuickFilter("hoje")} />
          <CentralChip label="Atrasadas" count={chipCounts.atrasadas}
            countVariant={chipCounts.atrasadas > 0 && quickFilter !== "atrasadas" ? "destructive" : undefined}
            active={quickFilter === "atrasadas"} onClick={() => setQuickFilter("atrasadas")} />
          <CentralChip label="Concluídas hoje" count={chipCounts.concluidasHoje}
            active={quickFilter === "concluidas_hoje"} onClick={() => setQuickFilter("concluidas_hoje")} />
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
                    "grid-cols-[24px_minmax(0,1fr)_120px_90px_110px_160px_120px_28px]",
                  )}
                >
                  <span />
                  <span>Nome</span>
                  <span>Data de conclusão</span>
                  <span>Responsável</span>
                  <span>Colaboradores</span>
                  <span>Projeto</span>
                  <span>Visibilidade</span>
                  <span />
                </div>
                {groups.map((g) => (
                  <Section
                    key={g.key}
                    group={g}
                    onToggle={handleToggle}
                    onSelect={handleSelect}
                    onDelete={handleDeleteTarefa}
                    currentUserId={user?.id ?? null}
                    projetoPessoalId={projetoPessoalId}
                  />
                ))}
              </>
            )}
          </Card>
        ) : view === "board" ? (
          <MinhasTarefasBoard tarefas={filtered} onToggle={handleToggle} onSelect={handleSelect} onChangePrazo={handleChangePrazo} />
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
          onDelete={handleBridgeDelete}
          secoes={bridgedSecoes}
          onMoveTarefa={handleBridgeMoveTarefa}
          projetoIdOverride={selectedProjetoId}
          externalSaving={isBridgeSaving}
        />
      </div>
    </TooltipProvider>
  );
}
