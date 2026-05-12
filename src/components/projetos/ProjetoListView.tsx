import { useState, useMemo } from "react";
import { useProjetoTarefas, ProjetoTarefa } from "@/hooks/useProjetoTarefas";
import { useProjeto } from "@/hooks/useProjetos";
import { useMetasProgress } from "@/hooks/useMetasProgress";
import { ProjetoSecao } from "./ProjetoSecao";
import { NovaSecaoInline } from "./NovaSecaoInline";
import { ProjetoTarefaDetalhe } from "./ProjetoTarefaDetalhe";
import { CriarTarefasIADialog } from "./CriarTarefasIADialog";
import { useProjetoIA } from "@/hooks/useProjetoIA";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, Ban, ChevronDown, ChevronRight } from "lucide-react";
import { ProjetoTarefaRow } from "./ProjetoTarefaRow";
import { ProjetoFilters, ProjetoSort, applyFilters, applySort, hasActiveFilters, EMPTY_FILTERS, DEFAULT_SORT } from "./ProjetoFilterSort";
import { ColumnConfig, loadColumnConfig, saveColumnConfig, buildGridCols, ColumnConfigPopover } from "./ColumnConfigPopover";
import { ProjetoVisaoParcialBanner } from "./ProjetoVisaoParcialBanner";
import { ListSkeleton } from "./ProjetoSkeletons";
import { logger } from "@/lib/logger";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";

// Legacy export for backwards compat
export const GRID_COLS = "grid-cols-[20px_20px_1fr_80px_1px_100px_120px_90px_120px_80px_80px]";

interface ProjetoListViewProps {
  projetoId: string;
  darkBg?: boolean;
  filters?: ProjetoFilters;
  sort?: ProjetoSort;
}

export function ProjetoListView({ projetoId, darkBg = false, filters = EMPTY_FILTERS, sort = DEFAULT_SORT }: ProjetoListViewProps) {
  const {
    secoes, tarefas, tarefasPorSecao, ghostsPorSecao,
    secoesLoading, tarefasLoading,
    createTarefa, updateTarefa, toggleTarefaCompleta, moveTarefaToSecao, createSecao,
    updateSecao, deleteSecao,
    toggleSecaoBriefing, addColaborador, removeColaborador, teamMembers,
    softDeleteTarefa,
    isPartialView, restrictToOwn, totalSecoesProjeto, totalTarefasProjeto, visibleTarefasCount,
  } = useProjetoTarefas(projetoId);
  const { data: projeto } = useProjeto(projetoId);
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const currentUserId = user?.id ?? null;
  const canDeleteSecao = !!projeto && (isAdmin || projeto.criador_id === currentUserId);
  const [selectedTarefaId, setSelectedTarefaId] = useState<string | null>(null);
  // Derive the live tarefa from the freshest `tarefas` array so the detail Sheet
  // reflects optimistic updates and realtime invalidations without remounting.
  const selectedTarefa = useMemo(() => {
    if (!selectedTarefaId) return null;
    const found = tarefas.find(t => t.id === selectedTarefaId);
    if (!found) return null;
    return { ...found, subtarefas: tarefas.filter(st => st.parent_tarefa_id === found.id) };
  }, [selectedTarefaId, tarefas]);
  const [iaDialogOpen, setIaDialogOpen] = useState(false);
  const { createTasksWithAI, createFromFile, loading: iaLoading } = useProjetoIA();
  const [columns, setColumns] = useState<ColumnConfig[]>(loadColumnConfig);

  // Batch-fetch checklist progress for all tasks
  const allTaskIds = useMemo(() => tarefas.map(t => t.id), [tarefas]);
  const metasProgress = useMetasProgress(allTaskIds);

  const vis = (key: string) => columns.find(c => c.key === key)?.visible ?? true;
  const dynamicGrid = `grid-cols-[${buildGridCols(columns)}]`;

  const isFiltering = hasActiveFilters(filters);

  // Memoize filtered tarefas per section (excluding canceled top-level tasks)
  const filteredTarefasPorSecao = useMemo(() => {
    const result: Record<string, ReturnType<typeof tarefasPorSecao>> = {};
    for (const secao of secoes) {
      let secTarefas = tarefasPorSecao(secao.id);
      // Hide canceled tasks from regular sections (they appear in the "Canceladas" section)
      secTarefas = secTarefas.filter((t: any) => t.status !== "cancelada") as typeof secTarefas;
      if (isFiltering) {
        secTarefas = applyFilters(secTarefas, filters, currentUserId) as typeof secTarefas;
      }
      if (sort.field !== "created_at" || sort.direction !== "asc") {
        secTarefas = applySort(secTarefas, sort) as typeof secTarefas;
      }
      result[secao.id] = secTarefas;
    }
    return result;
  }, [secoes, tarefas, filters, sort, isFiltering, currentUserId]);

  // Aggregate all canceled top-level tasks across sections
  const tarefasCanceladas = useMemo(() => {
    const all: any[] = [];
    for (const secao of secoes) {
      const secTarefas = tarefasPorSecao(secao.id);
      for (const t of secTarefas) {
        if ((t as any).status === "cancelada") all.push(t);
      }
    }
    return all;
  }, [secoes, tarefas]);

  if (secoesLoading || tarefasLoading) {
    return <ListSkeleton />;
  }

  const handleAddTarefa = (titulo: string, secaoId: string) => {
    createTarefa.mutate({ titulo, secao_id: secaoId });
  };

  const handleToggle = (tarefa: ProjetoTarefa) => {
    toggleTarefaCompleta.mutate(tarefa);
  };

  const handleSelectTarefa = (tarefa: ProjetoTarefa) => {
    setSelectedTarefaId(tarefa.id);
  };

  const handleUpdateTarefa = (id: string, updates: Partial<ProjetoTarefa>) => {
    updateTarefa.mutate({ id, ...updates });
  };

  const handleAddSubtarefa = (titulo: string, parentId: string, secaoId: string) => {
    createTarefa.mutate({ titulo, secao_id: secaoId, parent_tarefa_id: parentId });
  };

  const handleMoveTarefa = (tarefaId: string, secaoOrigemId: string, secaoDestinoId: string) => {
    moveTarefaToSecao.mutate({ tarefaId, secaoOrigemId, secaoDestinoId });
  };

  const handleCreateIAItems = async (data: { secoes: { nome: string }[]; tasks: any[]; documentFiles: File[] }) => {
    // 1. Create new sections in parallel and collect their REAL IDs (no setTimeout race)
    const newSecaoMap: Record<string, string> = {};

    if (data.secoes.length > 0) {
      const created = await Promise.all(
        data.secoes.map(s => createSecao.mutateAsync(s.nome).then((c: any) => ({ nome: s.nome, id: c?.id })).catch(() => null))
      );
      for (const c of created) {
        if (c?.id) newSecaoMap[c.nome] = c.id;
      }
    }

    // 2. Create tasks - map secao_nome to existing or new section IDs
    for (const task of data.tasks) {
      let secaoId = task.secao_id;
      if (!secaoId && task.secao_nome) {
        // Try to find in existing sections
        const existing = secoes.find(s => s.nome.toLowerCase() === task.secao_nome.toLowerCase());
        secaoId = existing?.id || newSecaoMap[task.secao_nome] || secoes[0]?.id;
      }
      if (!secaoId && secoes.length > 0) secaoId = secoes[0].id;
      
      createTarefa.mutate({ titulo: task.titulo, secao_id: secaoId }, {
        onSuccess: async (created: any) => {
          if (created?.id) {
            // Update extra fields
            const updates: any = {};
            if (task.descricao) updates.descricao = task.descricao;
            if (task.prioridade) updates.prioridade = task.prioridade;
            if (task.estagio) updates.estagio = task.estagio;
            if (task.data_prazo) updates.data_prazo = task.data_prazo;
            if (Object.keys(updates).length > 0) {
              updateTarefa.mutate({ id: created.id, ...updates });
            }

            // Upload document files and link to first task
            if (data.documentFiles.length > 0 && data.tasks.indexOf(task) === 0) {
              for (const file of data.documentFiles) {
                try {
                  const path = `${projetoId}/${created.id}/${Date.now()}_${file.name}`;
                  const { supabase } = await import("@/integrations/supabase/client");
                  const { error: uploadError } = await supabase.storage
                    .from("projeto-documentos")
                    .upload(path, file);
                  if (!uploadError) {
                    const { data: signedData } = await supabase.storage
                      .from("projeto-documentos")
                      .createSignedUrl(path, 31536000);
                    await supabase.from("projeto_tarefa_documentos" as any).insert({
                      tarefa_id: created.id,
                      nome_arquivo: file.name,
                      url: signedData?.signedUrl || path,
                      tipo_arquivo: file.type,
                      tamanho: file.size,
                    });
                  }
                } catch (e) {
                  logger.error("ProjetoListView upload doc error", e as Error);
                }
              }
            }
          }
        },
      });
    }
  };

  const handleCreateBriefingTasks = (tasks: { titulo: string; descricao: string; prioridade: string; secao_id: string }[]) => {
    for (const task of tasks) {
      createTarefa.mutate({ titulo: task.titulo, secao_id: task.secao_id }, {
        onSuccess: (data: any) => {
          if (data?.id) {
            updateTarefa.mutate({ id: data.id, descricao: task.descricao, prioridade: task.prioridade } as any);
          }
        },
      });
    }
  };

  return (
    <>
      {isPartialView && (
        <div className="mb-3">
          <ProjetoVisaoParcialBanner
            visibleCount={visibleTarefasCount}
            totalCount={totalTarefasProjeto}
            visibleSecoes={secoes.length}
            totalSecoes={totalSecoesProjeto}
            restrictToOwn={restrictToOwn}
            darkBg={darkBg}
          />
        </div>
      )}
      <div className={`border rounded-lg overflow-hidden ${darkBg ? "border-white/20 bg-white/5" : "border-border/50 bg-card"}`}>
        {/* Column headers */}
        <div className={`flex items-center gap-0 px-3 py-2 border-b font-semibold text-[11px] uppercase tracking-wider ${darkBg ? "border-white/10 bg-white/5 text-white/70" : "border-border/50 bg-muted/50 text-foreground/60"}`}>
          <div className="flex-1 flex items-center gap-0" style={{ display: "grid", gridTemplateColumns: buildGridCols(columns).replace(/_/g, " ") }}>
            <div className={`border-r ${darkBg ? "border-white/10" : "border-border/40"}`} /> {/* expand */}
            <div className={`border-r ${darkBg ? "border-white/10" : "border-border/40"}`} /> {/* checkbox */}
            <div className={`border-r ${darkBg ? "border-white/10" : "border-border/40"}`}>Nome da tarefa</div>
            {vis("produto") && <div className={`border-r ${darkBg ? "border-white/10" : "border-border/40"}`}>Produto</div>}
            <div className={`border-r ${darkBg ? "border-white/10" : "border-border/40"}`} />
            {vis("responsavel") && <div className={`border-r ${darkBg ? "border-white/10" : "border-border/40"}`}>Responsável</div>}
            {vis("equipe") && <div className={`border-r ${darkBg ? "border-white/10" : "border-border/40"}`}>Equipe</div>}
            {vis("status") && <div className={`text-center border-r ${darkBg ? "border-white/10" : "border-border/40"}`}>Status</div>}
            {vis("timeline") && <div className={`text-center border-r ${darkBg ? "border-white/10" : "border-border/40"}`}>Timeline</div>}
            {vis("prazo") && <div className={`border-r ${darkBg ? "border-white/10" : "border-border/40"}`}>Prazo</div>}
            {vis("prioridade") && <div className="text-center">Prior.</div>}
          </div>
          <ColumnConfigPopover columns={columns} onChange={setColumns} darkBg={darkBg} className="ml-1 flex-shrink-0" />
        </div>

        {secoes.map((secao, index) => (
          <ProjetoSecao
            key={secao.id}
            nome={secao.nome}
            secaoId={secao.id}
            projetoId={projetoId}
            secaoIndex={index}
            secaoDataInicio={(secao as any).data_inicio ?? null}
            secaoDataPrazo={(secao as any).data_prazo ?? null}
            secaoDiasAlertaAntes={(secao as any).dias_alerta_antes ?? 2}
            projetoDataInicio={projeto?.data_inicio ?? null}
            projetoDataFimAlvo={projeto?.data_fim_alvo ?? null}
            projetoRegime={projeto?.regime_calendario ?? "dias_uteis"}
            onUpdateSecao={async (secaoId, updates) => {
              await updateSecao.mutateAsync({ secaoId, updates });
            }}
            tarefas={filteredTarefasPorSecao[secao.id] || []}
            ghosts={isFiltering ? [] : ghostsPorSecao(secao.id)}
            temBriefing={(secao as any).tem_briefing || false}
            allSecoes={secoes.map(s => ({ id: s.id, nome: s.nome }))}
            selectedTarefaId={selectedTarefa?.id}
            onToggleTarefa={handleToggle}
            onSelectTarefa={handleSelectTarefa}
            onAddTarefa={handleAddTarefa}
            onUpdateTarefa={handleUpdateTarefa}
            onDeleteTarefa={(tarefaId) => softDeleteTarefa.mutate(tarefaId)}
            onToggleBriefing={(secaoId, value) => toggleSecaoBriefing.mutate({ secaoId, temBriefing: value })}
            onCreateBriefingTasks={handleCreateBriefingTasks}
            teamMembers={teamMembers}
            onAddColaborador={(tarefaId, userId) => addColaborador.mutate({ tarefaId, userId })}
            onRemoveColaborador={(tarefaId, userId) => removeColaborador.mutate({ tarefaId, userId })}
            darkBg={darkBg}
            columns={columns}
            metasProgress={metasProgress}
          />
        ))}

        {tarefasCanceladas.length > 0 && (
          <CanceladasSection
            tarefas={tarefasCanceladas}
            darkBg={darkBg}
            columns={columns}
            onUpdate={handleUpdateTarefa}
            onDelete={(id) => softDeleteTarefa.mutate(id)}
            onSelect={handleSelectTarefa}
            onToggle={handleToggle}
            selectedTarefaId={selectedTarefa?.id}
            teamMembers={teamMembers}
          />
        )}

        <div className={`flex items-center gap-2 border-t ${darkBg ? "border-white/10" : "border-border/30"}`}>
          <NovaSecaoInline onAdd={(nome) => createSecao.mutate(nome)} darkBg={darkBg} />
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs gap-1.5 mr-2 text-primary hover:text-primary"
            onClick={() => setIaDialogOpen(true)}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Criar com IA
          </Button>
        </div>
      </div>

      <CriarTarefasIADialog
        open={iaDialogOpen}
        onOpenChange={setIaDialogOpen}
        secoes={secoes.map(s => ({ id: s.id, nome: s.nome }))}
        projetoId={projetoId}
        onCreateItems={handleCreateIAItems}
        createTasksWithAI={createTasksWithAI}
        createFromFile={createFromFile}
        loading={iaLoading === "create_tasks" || iaLoading === "create_from_file"}
      />

      <ProjetoTarefaDetalhe
        tarefa={selectedTarefa}
        open={!!selectedTarefa}
        onOpenChange={(open) => { if (!open) setSelectedTarefaId(null); }}
        onUpdate={handleUpdateTarefa}
        onToggle={handleToggle}
        onAddSubtarefa={handleAddSubtarefa}
        secoes={secoes}
        onMoveTarefa={handleMoveTarefa}
      />
    </>
  );
}

// ─── Virtual section for canceled tasks ───
function CanceladasSection({
  tarefas,
  darkBg,
  columns,
  onUpdate,
  onDelete,
  onSelect,
  onToggle,
  selectedTarefaId,
  teamMembers,
}: {
  tarefas: any[];
  darkBg?: boolean;
  columns: ColumnConfig[];
  onUpdate: (id: string, updates: Partial<ProjetoTarefa>) => void;
  onDelete: (id: string) => void;
  onSelect: (t: any) => void;
  onToggle: (t: any) => void;
  selectedTarefaId?: string;
  teamMembers: any[];
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`border-t ${darkBg ? "border-white/10" : "border-border/40"}`}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium ${darkBg ? "text-white/60 hover:bg-white/5" : "text-muted-foreground hover:bg-muted/40"}`}
      >
        {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <Ban className="h-3.5 w-3.5" />
        <span>Canceladas</span>
        <span className={`ml-1 ${darkBg ? "text-white/40" : "text-muted-foreground/70"}`}>{tarefas.length}</span>
      </button>
      {expanded && (
        <div className="opacity-70">
          {tarefas.map((t) => (
            <ProjetoTarefaRow
              key={t.id}
              tarefa={t}
              onToggle={onToggle}
              onSelect={onSelect}
              onUpdate={onUpdate}
              onDelete={onDelete}
              selected={selectedTarefaId === t.id}
              teamMembers={teamMembers}
              darkBg={darkBg}
              columns={columns}
            />
          ))}
        </div>
      )}
    </div>
  );
}
