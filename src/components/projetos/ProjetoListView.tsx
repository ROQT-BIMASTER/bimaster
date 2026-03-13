import { useState, useMemo } from "react";
import { useProjetoTarefas, ProjetoTarefa } from "@/hooks/useProjetoTarefas";
import { ProjetoSecao } from "./ProjetoSecao";
import { NovaSecaoInline } from "./NovaSecaoInline";
import { ProjetoTarefaDetalhe } from "./ProjetoTarefaDetalhe";
import { CriarTarefasIADialog } from "./CriarTarefasIADialog";
import { useProjetoIA } from "@/hooks/useProjetoIA";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles } from "lucide-react";
import { ProjetoFilters, ProjetoSort, applyFilters, applySort, hasActiveFilters, EMPTY_FILTERS, DEFAULT_SORT } from "./ProjetoFilterSort";

// Grid template: expand, check, nome, produto, sep, responsável, status, timeline, prazo, prioridade
export const GRID_COLS = "grid-cols-[20px_20px_1fr_80px_1px_100px_90px_120px_80px_80px]";

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
    toggleSecaoBriefing, addColaborador, removeColaborador, teamMembers,
    softDeleteTarefa,
  } = useProjetoTarefas(projetoId);
  const [selectedTarefa, setSelectedTarefa] = useState<ProjetoTarefa | null>(null);
  const [iaDialogOpen, setIaDialogOpen] = useState(false);
  const { createTasksWithAI, createFromFile, loading: iaLoading } = useProjetoIA();

  const isFiltering = hasActiveFilters(filters);

  // Memoize filtered tarefas per section
  const filteredTarefasPorSecao = useMemo(() => {
    const result: Record<string, ReturnType<typeof tarefasPorSecao>> = {};
    for (const secao of secoes) {
      let secTarefas = tarefasPorSecao(secao.id);
      if (isFiltering) {
        secTarefas = applyFilters(secTarefas, filters) as typeof secTarefas;
      }
      if (sort.field !== "created_at" || sort.direction !== "asc") {
        secTarefas = applySort(secTarefas, sort) as typeof secTarefas;
      }
      result[secao.id] = secTarefas;
    }
    return result;
  }, [secoes, tarefas, filters, sort, isFiltering]);

  if (secoesLoading || tarefasLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleAddTarefa = (titulo: string, secaoId: string) => {
    createTarefa.mutate({ titulo, secao_id: secaoId });
  };

  const handleToggle = (tarefa: ProjetoTarefa) => {
    toggleTarefaCompleta.mutate(tarefa);
  };

  const handleSelectTarefa = (tarefa: ProjetoTarefa) => {
    const fullTarefa = tarefas.find(t => t.id === tarefa.id);
    if (fullTarefa) {
      setSelectedTarefa({
        ...fullTarefa,
        subtarefas: tarefas.filter(st => st.parent_tarefa_id === fullTarefa.id),
      });
    } else {
      setSelectedTarefa(tarefa);
    }
  };

  const handleUpdateTarefa = (id: string, updates: Partial<ProjetoTarefa>) => {
    updateTarefa.mutate({ id, ...updates });
    if (selectedTarefa?.id === id) {
      setSelectedTarefa(prev => prev ? { ...prev, ...updates } : null);
    }
  };

  const handleAddSubtarefa = (titulo: string, parentId: string, secaoId: string) => {
    createTarefa.mutate({ titulo, secao_id: secaoId, parent_tarefa_id: parentId });
  };

  const handleMoveTarefa = (tarefaId: string, secaoOrigemId: string, secaoDestinoId: string) => {
    moveTarefaToSecao.mutate({ tarefaId, secaoOrigemId, secaoDestinoId });
    if (selectedTarefa?.id === tarefaId) {
      setSelectedTarefa(prev => prev ? { ...prev, secao_id: secaoDestinoId } : null);
    }
  };

  const handleCreateIAItems = async (data: { secoes: { nome: string }[]; tasks: any[]; documentFiles: File[] }) => {
    // 1. Create new sections and collect their IDs mapped by name
    const newSecaoMap: Record<string, string> = {};
    
    for (const secao of data.secoes) {
      createSecao.mutate(secao.nome, {
        onSuccess: (created: any) => {
          if (created?.id) {
            newSecaoMap[secao.nome] = created.id;
          }
        },
      });
    }

    // Small delay to let sections be created
    if (data.secoes.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 1500));
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
                    const { data: urlData } = supabase.storage
                      .from("projeto-documentos")
                      .getPublicUrl(path);
                    await supabase.from("projeto_tarefa_documentos" as any).insert({
                      tarefa_id: created.id,
                      nome_arquivo: file.name,
                      url: urlData.publicUrl,
                      tipo_arquivo: file.type,
                      tamanho: file.size,
                    });
                  }
                } catch (e) {
                  console.error("Error uploading doc:", e);
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
      <div className={`border rounded-lg overflow-hidden ${darkBg ? "border-white/20 bg-white/5" : "border-border/50 bg-card"}`}>
        {/* Column headers */}
        <div className={`grid ${GRID_COLS} items-center gap-0 px-3 py-2 border-b font-semibold text-[11px] uppercase tracking-wider ${darkBg ? "border-white/10 bg-white/5 text-white/70" : "border-border/50 bg-muted/50 text-foreground/60"}`}>
          <div /> {/* expand */}
          <div /> {/* checkbox */}
          <div>Nome da tarefa</div>
          <div>Produto</div>
          <div className={`w-px h-4 ${darkBg ? "bg-white/10" : "bg-border/40"}`} /> {/* separator */}
          <div>Responsável</div>
          <div>Data con.</div>
          <div>Colab.</div>
          <div className={`w-px h-4 ${darkBg ? "bg-white/10" : "bg-border/40"}`} /> {/* separator */}
          <div>Criador</div>
          <div>Data mod.</div>
          <div className={`w-px h-4 ${darkBg ? "bg-white/10" : "bg-border/40"}`} /> {/* separator */}
          <div className="text-center">Status</div>
          <div className="text-center">Estágio</div>
        </div>

        {secoes.map(secao => (
          <ProjetoSecao
            key={secao.id}
            nome={secao.nome}
            secaoId={secao.id}
            projetoId={projetoId}
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
          />
        ))}

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
        onOpenChange={(open) => { if (!open) setSelectedTarefa(null); }}
        onUpdate={handleUpdateTarefa}
        onToggle={handleToggle}
        onAddSubtarefa={handleAddSubtarefa}
        secoes={secoes}
        onMoveTarefa={handleMoveTarefa}
      />
    </>
  );
}
