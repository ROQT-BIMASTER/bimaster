import { logger } from "@/lib/logger";
import { useEffect, useRef, type MutableRefObject } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { uniqueChannelName } from "@/lib/realtime/channelName";
import { registrarAuditoriaTarefa } from "@/lib/projetos/auditoriaTarefa";

export interface ProjetoSecao {
  id: string;
  projeto_id: string;
  nome: string;
  ordem: number;
  tem_briefing: boolean;
  created_at: string;
  data_inicio?: string | null;
  data_prazo?: string | null;
  dias_alerta_antes?: number | null;
}

export interface ProjetoTarefa {
  id: string;
  projeto_id: string;
  secao_id: string;
  parent_tarefa_id: string | null;
  titulo: string;
  descricao: string | null;
  responsavel_id: string | null;
  criador_id: string | null;
  status: string;
  prioridade: string;
  data_prazo: string | null;
  data_inicio_planejada?: string | null;
  data_conclusao: string | null;
  codigo: string | null;
  estagio: string | null;
  visibilidade: string;
  ordem: number;
  created_at: string;
  updated_at: string;
  produto_id: string | null;
  subtarefas?: ProjetoTarefa[];
  responsavel?: { id: string; nome: string; avatar_url: string | null } | null;
  /** Multi-responsáveis (junction projeto_tarefa_responsaveis). `responsavel`/`responsavel_id` continuam refletindo o "principal". */
  responsaveis?: { user_id: string; nome: string; avatar_url: string | null; papel?: string }[];
  criador?: { id: string; nome: string; avatar_url: string | null } | null;
  colaboradores?: { user_id: string; nome: string; avatar_url: string | null }[];
  produto_foto_url?: string | null;
  produto_tipo?: string | null;
  produto_nome?: string | null;
  numero_processo?: string | null;
  linked_produtos?: { id: string; nome: string; foto_url: string | null; codigo: string | null }[];
  tipo_tarefa?: string | null;
  motivo_retrabalho?: string | null;
  dias_alerta_antes?: number | null;
}

export interface ProjetoTarefasView {
  secoes: ProjetoSecao[];
  tarefas: ProjetoTarefa[];
  teamMembers: { id: string; nome: string; avatar_url: string | null }[];
  isPartialView: boolean;
  restrictToOwn: boolean;
  totalSecoesProjeto: number;
  totalTarefasProjeto: number;
  visibleTarefasCount: number;
}

interface ProjetoTarefasRpcPayload {
  secoes?: ProjetoSecao[];
  tarefas?: ProjetoTarefa[];
  team_members?: { id: string; nome: string; avatar_url: string | null }[];
  is_partial_view?: boolean;
  restrict_to_own?: boolean;
  total_secoes_projeto?: number;
  total_tarefas_projeto?: number;
  visible_tarefas_count?: number;
}

export function useProjetoTarefas(projetoId: string | undefined, opts?: { lixeiraOpen?: boolean }) {
  const { user } = useAuth();
  const lixeiraOpen = !!opts?.lixeiraOpen;
  const queryClient = useQueryClient();

  type PessoaCache = { id: string; nome: string; avatar_url: string | null };
  type PendingListOp = { op: "add" | "remove"; pessoa: PessoaCache };
  const pendingResponsaveisRef = useRef(new Map<string, Map<string, PendingListOp>>());
  const pendingColaboradoresRef = useRef(new Map<string, Map<string, PendingListOp>>());
  const pendingPrimaryRef = useRef(new Map<string, { userId: string | null; pessoa: PessoaCache | null }>());

  const resolvePessoa = (userId: string, viewSnapshot?: Pick<ProjetoTarefasView, "teamMembers">): PessoaCache => {
    const fromTeam = (viewSnapshot?.teamMembers || []).find(m => m.id === userId);
    if (fromTeam) return { id: fromTeam.id, nome: fromTeam.nome, avatar_url: fromTeam.avatar_url };
    const membrosCache = queryClient.getQueryData<any[]>(["projeto_membros", projetoId]);
    const fromMembros = membrosCache?.find((m: any) => m.user_id === userId);
    if (fromMembros?.profile) {
      return {
        id: fromMembros.user_id,
        nome: fromMembros.profile.nome || "Membro",
        avatar_url: fromMembros.profile.avatar_url || null,
      };
    }
    return { id: userId, nome: "Membro", avatar_url: null };
  };

  const setPendingListOp = (
    ref: MutableRefObject<Map<string, Map<string, PendingListOp>>>,
    tarefaId: string,
    userId: string,
    op: "add" | "remove",
    pessoa: PessoaCache,
  ) => {
    const next = new Map(ref.current);
    const taskOps = new Map(next.get(tarefaId) || []);
    taskOps.set(userId, { op, pessoa });
    next.set(tarefaId, taskOps);
    ref.current = next;
  };

  const clearPendingListOp = (
    ref: MutableRefObject<Map<string, Map<string, PendingListOp>>>,
    tarefaId: string,
    userId: string,
  ) => {
    const next = new Map(ref.current);
    const taskOps = new Map(next.get(tarefaId) || []);
    taskOps.delete(userId);
    if (taskOps.size > 0) next.set(tarefaId, taskOps);
    else next.delete(tarefaId);
    ref.current = next;
  };

  const schedulePendingCleanup = (clear: () => void) => {
    window.setTimeout(() => {
      clear();
      queryClient.invalidateQueries({ queryKey: ["projeto-tarefas-v2", projetoId] });
    }, 8_000);
  };

  const applyPendingAssignments = (base: ProjetoTarefasView): ProjetoTarefasView => {
    if (
      pendingResponsaveisRef.current.size === 0 &&
      pendingColaboradoresRef.current.size === 0 &&
      pendingPrimaryRef.current.size === 0
    ) {
      return base;
    }

    const teamById = new Map(base.teamMembers.map(m => [m.id, m]));
    const ensureTeam = (pessoa: PessoaCache | null) => {
      if (pessoa && !teamById.has(pessoa.id)) teamById.set(pessoa.id, pessoa);
    };

    const tarefasPatched = base.tarefas.map((t) => {
      let patched: ProjetoTarefa = t;
      const respOps = pendingResponsaveisRef.current.get(t.id);
      const colabOps = pendingColaboradoresRef.current.get(t.id);
      const primary = pendingPrimaryRef.current.get(t.id);

      if (respOps?.size) {
        let responsaveis = [...(patched.responsaveis || [])];
        respOps.forEach(({ op, pessoa }, userId) => {
          ensureTeam(pessoa);
          responsaveis = responsaveis.filter(r => r.user_id !== userId);
          if (op === "add") {
            responsaveis.push({ user_id: userId, nome: pessoa.nome, avatar_url: pessoa.avatar_url, papel: "responsavel" });
          }
        });
        patched = { ...patched, responsaveis };
      }

      if (colabOps?.size) {
        let colaboradores = [...(patched.colaboradores || [])];
        colabOps.forEach(({ op, pessoa }, userId) => {
          ensureTeam(pessoa);
          colaboradores = colaboradores.filter(c => c.user_id !== userId);
          if (op === "add") {
            colaboradores.push({ user_id: userId, nome: pessoa.nome, avatar_url: pessoa.avatar_url });
          }
        });
        patched = { ...patched, colaboradores };
      }

      if (primary) {
        ensureTeam(primary.pessoa);
        patched = {
          ...patched,
          responsavel_id: primary.userId,
          responsavel: primary.pessoa,
          responsaveis: primary.userId && primary.pessoa
            ? [{ user_id: primary.userId, nome: primary.pessoa.nome, avatar_url: primary.pessoa.avatar_url, papel: "responsavel" }]
            : [],
        };
      } else if (respOps?.size && patched.responsavel_id) {
        const stillResponsible = (patched.responsaveis || []).find(r => r.user_id === patched.responsavel_id);
        if (!stillResponsible) {
          const next = (patched.responsaveis || [])[0];
          patched = {
            ...patched,
            responsavel_id: next?.user_id ?? null,
            responsavel: next ? { id: next.user_id, nome: next.nome, avatar_url: next.avatar_url } : null,
          };
        }
      }

      return patched;
    });

    return { ...base, tarefas: tarefasPatched, teamMembers: Array.from(teamById.values()) };
  };

  // === Single RPC fetches everything (tarefas + secoes + team + visibility flags) ===
  const { data: view, isLoading: viewLoading } = useQuery<ProjetoTarefasView>({
    queryKey: ["projeto-tarefas-v2", projetoId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_projeto_tarefas_v2", {
        p_projeto_id: projetoId,
      });
      if (error) throw error;
      const payload = (data ?? {}) as Partial<ProjetoTarefasRpcPayload>;
      if (data && typeof data === "object" && !Array.isArray(data)) {
        // shape sanity — não joga, só registra para detectar drift de contrato da RPC
        if (payload.secoes !== undefined && !Array.isArray(payload.secoes)) {
          logger.warn("get_projeto_tarefas_v2: payload.secoes não é array", { payload });
        }
        if (payload.tarefas !== undefined && !Array.isArray(payload.tarefas)) {
          logger.warn("get_projeto_tarefas_v2: payload.tarefas não é array", { payload });
        }
      } else if (data != null) {
        logger.warn("get_projeto_tarefas_v2: payload com shape inesperado", { data });
      }
      return applyPendingAssignments({
        secoes: (Array.isArray(payload.secoes) ? payload.secoes : []) as ProjetoSecao[],
        tarefas: (Array.isArray(payload.tarefas) ? payload.tarefas : []) as ProjetoTarefa[],
        teamMembers: (Array.isArray(payload.team_members) ? payload.team_members : []) as { id: string; nome: string; avatar_url: string | null }[],
        isPartialView: !!payload.is_partial_view,
        restrictToOwn: !!payload.restrict_to_own,
        totalSecoesProjeto: payload.total_secoes_projeto ?? 0,
        totalTarefasProjeto: payload.total_tarefas_projeto ?? 0,
        visibleTarefasCount: payload.visible_tarefas_count ?? 0,
      });
    },
    enabled: !!projetoId && !!user,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    placeholderData: (prev) => prev,
  });

  const secoes = view?.secoes || [];
  const tarefas = view?.tarefas || [];
  const teamMembers = view?.teamMembers || [];
  const isPartialView = view?.isPartialView || false;
  const restrictToOwn = view?.restrictToOwn || false;

  // Helper to update the cached view via setQueryData (optimistic)
  const patchView = (mutator: (v: ProjetoTarefasView) => ProjetoTarefasView) => {
    queryClient.setQueryData<ProjetoTarefasView>(["projeto-tarefas-v2", projetoId], (old) =>
      old ? mutator(old) : old
    );
  };

  // Movement history for ghost rows (kept separate — small payload)
  const { data: movimentacoes = [] } = useQuery({
    queryKey: ["tarefa-movimentacoes", projetoId],
    queryFn: async () => {
      const secaoIds = secoes.map(s => s.id);
      if (secaoIds.length === 0) return [];
      const { data, error } = await supabase
        .from("projeto_tarefa_movimentacoes" as any)
        .select("*")
        .in("secao_origem_id", secaoIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!projetoId && !!user && secoes.length > 0,
  });

  const tarefasPorSecao = (secaoId: string) => {
    const parentTasks = tarefas.filter(t => t.secao_id === secaoId && !t.parent_tarefa_id);
    return parentTasks.map(t => ({
      ...t,
      subtarefas: tarefas.filter(st => st.parent_tarefa_id === t.id),
    }));
  };

  const ghostsPorSecao = (secaoId: string) => {
    return movimentacoes
      .filter(m => m.secao_origem_id === secaoId)
      .map(m => {
        const tarefa = tarefas.find(t => t.id === m.tarefa_id);
        const destSecao = secoes.find(s => s.id === m.secao_destino_id);
        return tarefa ? { ...m, tarefa, destSecaoNome: destSecao?.nome || "Outra seção" } : null;
      })
      .filter(Boolean);
  };

  const moveTarefaToSecao = useMutation({
    mutationFn: async ({ tarefaId, secaoOrigemId, secaoDestinoId }: { tarefaId: string; secaoOrigemId: string; secaoDestinoId: string }) => {
      const { error: movError } = await supabase
        .from("projeto_tarefa_movimentacoes" as any)
        .insert({
          tarefa_id: tarefaId,
          secao_origem_id: secaoOrigemId,
          secao_destino_id: secaoDestinoId,
          movido_por: user?.id,
        } as any);
      if (movError) throw movError;

      const { error } = await supabase
        .from("projeto_tarefas")
        .update({ secao_id: secaoDestinoId, updated_at: new Date().toISOString() })
        .eq("id", tarefaId);
      if (error) throw error;
    },
    onMutate: async ({ tarefaId, secaoDestinoId }) => {
      await queryClient.cancelQueries({ queryKey: ["projeto-tarefas-v2", projetoId] });
      const previous = queryClient.getQueryData<ProjetoTarefasView>(["projeto-tarefas-v2", projetoId]);
      patchView((v) => ({
        ...v,
        tarefas: v.tarefas.map(t => t.id === tarefaId ? { ...t, secao_id: secaoDestinoId } : t),
      }));
      return { previous };
    },
    onError: (err: Error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(["projeto-tarefas-v2", projetoId], context.previous);
      toast.error(err.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto-tarefas-v2", projetoId] });
      queryClient.invalidateQueries({ queryKey: ["tarefa-movimentacoes", projetoId] });
    },
    // Toast suprimido intencionalmente: drag-and-drop precisa ser silencioso
    // (benchmark Asana). Erros continuam sendo notificados via onError.
  });

  const createTarefa = useMutation({
    mutationFn: async (tarefa: { titulo: string; secao_id: string; parent_tarefa_id?: string }) => {
      const maxOrdem = tarefas.filter(t => t.secao_id === tarefa.secao_id).length;
      const { data, error } = await supabase
        .from("projeto_tarefas")
        .insert({
          ...tarefa,
          projeto_id: projetoId!,
          ordem: maxOrdem,
          criador_id: user?.id || null,
        })
        .select()
        .single();
      if (error) throw error;
      return { data };
    },
    onMutate: async (tarefa) => {
      await queryClient.cancelQueries({ queryKey: ["projeto-tarefas-v2", projetoId] });
      const previous = queryClient.getQueryData<ProjetoTarefasView>(["projeto-tarefas-v2", projetoId]);
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const nowIso = new Date().toISOString();
      const optimistic: ProjetoTarefa = {
        id: tempId,
        projeto_id: projetoId!,
        secao_id: tarefa.secao_id,
        parent_tarefa_id: tarefa.parent_tarefa_id || null,
        titulo: tarefa.titulo,
        descricao: null,
        responsavel_id: null,
        criador_id: user?.id || null,
        status: "pendente",
        prioridade: "media",
        data_prazo: null,
        data_conclusao: null,
        codigo: null,
        estagio: null,
        visibilidade: "publica",
        ordem: previous?.tarefas.filter(t => t.secao_id === tarefa.secao_id).length || 0,
        created_at: nowIso,
        updated_at: nowIso,
        produto_id: null,
      } as ProjetoTarefa;
      patchView((v) => ({ ...v, tarefas: [...v.tarefas, optimistic] }));
      return { previous, tempId };
    },
    onError: (err: Error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(["projeto-tarefas-v2", projetoId], context.previous);
      toast.error(err.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto-tarefas-v2", projetoId] });
    },
  });

  const updateTarefa = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ProjetoTarefa> & { id: string }) => {
      // Quando o caller troca diretamente o status para "concluida"
      // (ex.: select de status, drag para coluna concluído), exigimos
      // confirmação para padronizar com o checkbox e evitar conclusão acidental.
      if ((updates as any).status === "concluida") {
        const tarefa = tarefas.find(t => t.id === id);
        if (tarefa && tarefa.status !== "concluida") {
          const { confirmConclusaoTarefa } = await import("@/lib/projetos/confirmConclusao");
          const ok = await confirmConclusaoTarefa({
            titulo: tarefa.titulo,
            isSubtarefa: !!tarefa.parent_tarefa_id,
          });
          if (!ok) throw new Error("__CANCELLED__");
        }
      }
      const { data: updated, error } = await supabase
        .from("projeto_tarefas")
        .update({ ...updates, updated_at: new Date().toISOString() } as never)
        .eq("id", id)
        .select("id");
      if (error) throw error;
      if (!updated || updated.length === 0) {
        throw new Error("Sem permissão para alterar esta tarefa. Você precisa ser membro do projeto, responsável ou criador da tarefa.");
      }

      // Auditoria: registra mudança de status para concluida/reaberta.
      if (Object.prototype.hasOwnProperty.call(updates, "status")) {
        const tarefa = tarefas.find(t => t.id === id);
        const novoStatus = (updates as any).status as string | undefined;
        if (tarefa && novoStatus && novoStatus !== tarefa.status) {
          if (novoStatus === "concluida") {
            await registrarAuditoriaTarefa({
              tarefaId: id,
              projetoId: tarefa.projeto_id,
              parentTarefaId: tarefa.parent_tarefa_id,
              isSubtarefa: !!tarefa.parent_tarefa_id,
              tituloSnapshot: tarefa.titulo,
              action: "concluida",
              metadata: { source: "updateTarefa" },
            });
          } else if (tarefa.status === "concluida") {
            await registrarAuditoriaTarefa({
              tarefaId: id,
              projetoId: tarefa.projeto_id,
              parentTarefaId: tarefa.parent_tarefa_id,
              isSubtarefa: !!tarefa.parent_tarefa_id,
              tituloSnapshot: tarefa.titulo,
              action: "reaberta",
              metadata: { source: "updateTarefa", novoStatus },
            });
          }
        }
      }
    },
    onMutate: async ({ id, ...updates }) => {
      await queryClient.cancelQueries({ queryKey: ["projeto-tarefas-v2", projetoId] });
      const previous = queryClient.getQueryData<ProjetoTarefasView>(["projeto-tarefas-v2", projetoId]);
      // Enriquecimento: quando `responsavel_id` muda, o objeto derivado
      // `responsavel: { id, nome, avatar_url }` também precisa ser atualizado
      // no patch otimista, senão a UI mostra avatar/nome antigos até o refetch.
      // Olha primeiro em `teamMembers` (lista já carregada na view) e, como
      // fallback, no cache de `projeto_membros` — necessário para subtarefas
      // ao atribuir um membro que ainda não consta como responsável de
      // nenhuma tarefa (e portanto não está em teamMembers).
      const respChange = Object.prototype.hasOwnProperty.call(updates, "responsavel_id");
      const novoResponsavelId = (updates as Partial<ProjetoTarefa>).responsavel_id;
      let novoMembro: { id: string; nome: string; avatar_url: string | null } | null = null;
      if (respChange && novoResponsavelId) {
        novoMembro = resolvePessoa(novoResponsavelId, previous);
      }
      if (respChange) {
        const nextPrimary = new Map(pendingPrimaryRef.current);
        nextPrimary.set(id, { userId: novoResponsavelId ?? null, pessoa: novoMembro });
        pendingPrimaryRef.current = nextPrimary;
      }
      patchView((v) => ({
        ...v,
        tarefas: v.tarefas.map(t => {
          if (t.id !== id) return t;
          const patched = { ...t, ...updates } as ProjetoTarefa;
          if (respChange) {
            patched.responsavel = novoMembro;
            patched.responsaveis = novoResponsavelId && novoMembro
              ? [{ user_id: novoResponsavelId, nome: novoMembro.nome, avatar_url: novoMembro.avatar_url, papel: "responsavel" }]
              : [];
          }
          return patched;
        }),
      }));
      return { previous, pendingPrimaryTaskId: respChange ? id : null };
    },

    onError: (err: Error, _vars, context) => {
      if (context?.pendingPrimaryTaskId) {
        const nextPrimary = new Map(pendingPrimaryRef.current);
        nextPrimary.delete(context.pendingPrimaryTaskId);
        pendingPrimaryRef.current = nextPrimary;
      }
      if (context?.previous) queryClient.setQueryData(["projeto-tarefas-v2", projetoId], context.previous);
      if (err.message === "__CANCELLED__") return;
      toast.error(err.message);
    },
    onSuccess: (_data, _vars, context) => {
      if (context?.pendingPrimaryTaskId) {
        schedulePendingCleanup(() => {
          const nextPrimary = new Map(pendingPrimaryRef.current);
          nextPrimary.delete(context.pendingPrimaryTaskId!);
          pendingPrimaryRef.current = nextPrimary;
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto-tarefas-v2", projetoId] });
    },
  });

  const toggleTarefaCompleta = useMutation({
    mutationFn: async (tarefa: ProjetoTarefa) => {
      const isCompleting = tarefa.status !== "concluida";
      logger.debug(`[toggleTarefaCompleta] tarefa: ${tarefa.id} isCompleting: ${isCompleting}`);

      if (isCompleting) {
        // Confirmação obrigatória para evitar conclusão acidental por clique
        const { confirmConclusaoTarefa } = await import("@/lib/projetos/confirmConclusao");
        const ok = await confirmConclusaoTarefa({ titulo: tarefa.titulo });
        if (!ok) {
          // Sinaliza cancelamento para reverter o estado otimista
          throw new Error("__CANCELLED__");
        }

        const { data: esp } = await supabase
          .from("processo_tarefa_espelho" as any)
          .select("*")
          .eq("projeto_tarefa_id", tarefa.id)
          .in("status", ["pendente", "em_andamento"])
          .limit(1)
          .maybeSingle();
        if (esp) {
          window.dispatchEvent(new CustomEvent("espelho-precisa-evidencia", { detail: esp }));
          throw new Error("__CANCELLED__");
        }
      }

      const { error } = await supabase
        .from("projeto_tarefas")
        .update({
          status: isCompleting ? "concluida" : "pendente",
          data_conclusao: isCompleting ? new Date().toISOString().split("T")[0] : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", tarefa.id);
      if (error) throw error;

      await registrarAuditoriaTarefa({
        tarefaId: tarefa.id,
        projetoId: tarefa.projeto_id,
        parentTarefaId: tarefa.parent_tarefa_id,
        isSubtarefa: !!tarefa.parent_tarefa_id,
        tituloSnapshot: tarefa.titulo,
        action: isCompleting ? "concluida" : "reaberta",
        metadata: { source: "toggleTarefaCompleta" },
      });
    },
    onMutate: async (tarefa) => {
      await queryClient.cancelQueries({ queryKey: ["projeto-tarefas-v2", projetoId] });
      const previous = queryClient.getQueryData<ProjetoTarefasView>(["projeto-tarefas-v2", projetoId]);
      const isCompleting = tarefa.status !== "concluida";
      patchView((v) => ({
        ...v,
        tarefas: v.tarefas.map(t => t.id === tarefa.id ? {
          ...t,
          status: isCompleting ? "concluida" : "pendente",
          data_conclusao: isCompleting ? new Date().toISOString().split("T")[0] : null,
        } : t),
      }));
      return { previous };
    },
    onError: (err: Error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(["projeto-tarefas-v2", projetoId], context.previous);
      if (err.message === "__CANCELLED__") return; // usuário cancelou ou foi p/ fluxo de evidência
      toast.error("Erro ao atualizar status: " + err.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto-tarefas-v2", projetoId] });
    },
  });

  const createSecao = useMutation({
    mutationFn: async (nome: string) => {
      const maxOrdem = secoes.length;
      const { data, error } = await supabase
        .from("projeto_secoes")
        .insert({ projeto_id: projetoId!, nome, ordem: maxOrdem })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onMutate: async (nome) => {
      await queryClient.cancelQueries({ queryKey: ["projeto-tarefas-v2", projetoId] });
      const previous = queryClient.getQueryData<ProjetoTarefasView>(["projeto-tarefas-v2", projetoId]);
      const tempId = `temp-sec-${Date.now()}`;
      const optimistic: ProjetoSecao = {
        id: tempId,
        projeto_id: projetoId!,
        nome,
        ordem: previous?.secoes.length || 0,
        tem_briefing: false,
        created_at: new Date().toISOString(),
      };
      patchView((v) => ({ ...v, secoes: [...v.secoes, optimistic] }));
      return { previous };
    },
    onError: (err: Error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(["projeto-tarefas-v2", projetoId], context.previous);
      toast.error(err.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto-tarefas-v2", projetoId] });
    },
    onSuccess: () => toast.success("Seção criada!"),
  });

  const addColaborador = useMutation({
    mutationFn: async ({ tarefaId, userId }: { tarefaId: string; userId: string }) => {
      // Idempotente: se o vínculo (tarefa_id, user_id) já existir, ignora silenciosamente
      // (evita o erro "duplicate key" quando o cache local ainda não refletiu um seguidor
      // adicionado em outra sessão/aba ou em clique duplo).
      const { data: inserted, error } = await supabase
        .from("projeto_tarefa_colaboradores")
        .upsert(
          { tarefa_id: tarefaId, user_id: userId },
          { onConflict: "tarefa_id,user_id", ignoreDuplicates: true },
        )
        .select("id");
      if (error) throw error;
      if (!inserted || inserted.length === 0) {
        // Pode ser duplicata (sucesso silencioso) OU bloqueio por RLS. Conferimos.
        const { data: existing } = await supabase
          .from("projeto_tarefa_colaboradores")
          .select("id")
          .eq("tarefa_id", tarefaId)
          .eq("user_id", userId)
          .maybeSingle();
        if (!existing) {
          throw new Error("Sem permissão para adicionar seguidor. Você precisa ser membro do projeto, responsável ou criador da tarefa.");
        }
      }
      return { tarefaId, userId };
    },
    onMutate: async ({ tarefaId, userId }) => {
      await queryClient.cancelQueries({ queryKey: ["projeto-tarefas-v2", projetoId] });
      const previous = queryClient.getQueryData<ProjetoTarefasView>(["projeto-tarefas-v2", projetoId]);
      // Mesmo enriquecimento do responsável: olha primeiro em teamMembers e,
      // como fallback, no cache de projeto_membros — necessário quando o
      // membro ainda não atua em nenhuma outra tarefa do projeto.
      let nome = "Membro";
      let avatar_url: string | null = null;
      const fromTeam = (previous?.teamMembers || []).find(m => m.id === userId);
      if (fromTeam) {
        nome = fromTeam.nome;
        avatar_url = fromTeam.avatar_url;
      } else {
        const membrosCache = queryClient.getQueryData<any[]>(["projeto_membros", projetoId]);
        const fromMembros = membrosCache?.find((m: any) => m.user_id === userId);
        if (fromMembros?.profile) {
          nome = fromMembros.profile.nome || "Membro";
          avatar_url = fromMembros.profile.avatar_url || null;
        }
      }
      patchView((v) => ({
        ...v,
        tarefas: v.tarefas.map(t =>
          t.id === tarefaId
            ? {
                ...t,
                colaboradores: (t.colaboradores || []).some(c => c.user_id === userId)
                  ? t.colaboradores!
                  : [...(t.colaboradores || []), { user_id: userId, nome, avatar_url }],
              }
            : t
        ),
      }));
      return { previous };
    },
    onError: (err: Error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(["projeto-tarefas-v2", projetoId], context.previous);
      toast.error(err.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto-tarefas-v2", projetoId] });
    },
  });

  const removeColaborador = useMutation({
    mutationFn: async ({ tarefaId, userId }: { tarefaId: string; userId: string }) => {
      const { data: deleted, error } = await supabase
        .from("projeto_tarefa_colaboradores")
        .delete()
        .eq("tarefa_id", tarefaId)
        .eq("user_id", userId)
        .select("id");
      if (error) throw error;
      if (!deleted || deleted.length === 0) {
        throw new Error("Sem permissão para remover seguidor. Você precisa ser membro do projeto, responsável ou criador da tarefa.");
      }
    },
    onMutate: async ({ tarefaId, userId }) => {
      await queryClient.cancelQueries({ queryKey: ["projeto-tarefas-v2", projetoId] });
      const previous = queryClient.getQueryData<ProjetoTarefasView>(["projeto-tarefas-v2", projetoId]);
      patchView((v) => ({
        ...v,
        tarefas: v.tarefas.map(t =>
          t.id === tarefaId
            ? { ...t, colaboradores: (t.colaboradores || []).filter(c => c.user_id !== userId) }
            : t
        ),
      }));
      return { previous };
    },
    onError: (err: Error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(["projeto-tarefas-v2", projetoId], context.previous);
      toast.error(err.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto-tarefas-v2", projetoId] });
    },
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Multi-responsáveis (projeto_tarefa_responsaveis)
  // O trigger no banco mantém `projeto_tarefas.responsavel_id` sincronizado
  // com o "principal" (papel='principal' mais antigo, senão o registro mais
  // antigo). Aqui aplicamos optimistic update no array `responsaveis` e,
  // quando faz sentido, ajustamos o `responsavel_id`/`responsavel` espelho.
  // ─────────────────────────────────────────────────────────────────────────
  function resolveMembro(userId: string, previous: ProjetoTarefasView | undefined): { nome: string; avatar_url: string | null } {
    const fromTeam = (previous?.teamMembers || []).find(m => m.id === userId);
    if (fromTeam) return { nome: fromTeam.nome, avatar_url: fromTeam.avatar_url };
    const membrosCache = queryClient.getQueryData<any[]>(["projeto_membros", projetoId]);
    const fromMembros = membrosCache?.find((m: any) => m.user_id === userId);
    if (fromMembros?.profile) {
      return { nome: fromMembros.profile.nome || "Membro", avatar_url: fromMembros.profile.avatar_url || null };
    }
    return { nome: "Membro", avatar_url: null };
  }

  const addResponsavel = useMutation({
    mutationFn: async ({ tarefaId, userId }: { tarefaId: string; userId: string }) => {
      const { data, error } = await supabase
        .from("projeto_tarefa_responsaveis" as never)
        .insert({ tarefa_id: tarefaId, user_id: userId } as never)
        .select("id");
      if (error) throw error;
      if (!data || (data as any[]).length === 0) {
        throw new Error("Sem permissão para adicionar responsável. Você precisa ser membro do projeto, responsável ou criador da tarefa.");
      }
      return { tarefaId, userId };
    },
    onMutate: async ({ tarefaId, userId }) => {
      await queryClient.cancelQueries({ queryKey: ["projeto-tarefas-v2", projetoId] });
      const previous = queryClient.getQueryData<ProjetoTarefasView>(["projeto-tarefas-v2", projetoId]);
      const info = resolveMembro(userId, previous);
      patchView((v) => ({
        ...v,
        tarefas: v.tarefas.map(t => {
          if (t.id !== tarefaId) return t;
          const lista = t.responsaveis || [];
          if (lista.some(r => r.user_id === userId)) return t;
          const novaLista = [...lista, { user_id: userId, nome: info.nome, avatar_url: info.avatar_url, papel: "responsavel" }];
          // Espelha o principal se ainda não houver responsavel_id.
          const patched: ProjetoTarefa = { ...t, responsaveis: novaLista };
          if (!t.responsavel_id) {
            patched.responsavel_id = userId;
            patched.responsavel = { id: userId, nome: info.nome, avatar_url: info.avatar_url };
          }
          return patched;
        }),
      }));
      return { previous };
    },
    onError: (err: Error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(["projeto-tarefas-v2", projetoId], context.previous);
      toast.error(err.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto-tarefas-v2", projetoId] });
    },
  });

  const removeResponsavel = useMutation({
    mutationFn: async ({ tarefaId, userId }: { tarefaId: string; userId: string }) => {
      const { data, error } = await supabase
        .from("projeto_tarefa_responsaveis" as never)
        .delete()
        .eq("tarefa_id", tarefaId)
        .eq("user_id", userId)
        .select("id");
      if (error) throw error;
      if (!data || (data as any[]).length === 0) {
        throw new Error("Sem permissão para remover responsável. Você precisa ser membro do projeto, responsável ou criador da tarefa.");
      }
    },
    onMutate: async ({ tarefaId, userId }) => {
      await queryClient.cancelQueries({ queryKey: ["projeto-tarefas-v2", projetoId] });
      const previous = queryClient.getQueryData<ProjetoTarefasView>(["projeto-tarefas-v2", projetoId]);
      patchView((v) => ({
        ...v,
        tarefas: v.tarefas.map(t => {
          if (t.id !== tarefaId) return t;
          const novaLista = (t.responsaveis || []).filter(r => r.user_id !== userId);
          const patched: ProjetoTarefa = { ...t, responsaveis: novaLista };
          // Se removeu o "principal" espelhado, promove o próximo (ou limpa).
          if (t.responsavel_id === userId) {
            const next = novaLista[0];
            if (next) {
              patched.responsavel_id = next.user_id;
              patched.responsavel = { id: next.user_id, nome: next.nome, avatar_url: next.avatar_url };
            } else {
              patched.responsavel_id = null;
              patched.responsavel = null;
            }
          }
          return patched;
        }),
      }));
      return { previous };
    },
    onError: (err: Error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(["projeto-tarefas-v2", projetoId], context.previous);
      toast.error(err.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto-tarefas-v2", projetoId] });
    },
  });

  const updateSecao = useMutation({
    mutationFn: async ({
      secaoId,
      updates,
    }: {
      secaoId: string;
      updates: Partial<Pick<ProjetoSecao, "nome" | "data_inicio" | "data_prazo" | "dias_alerta_antes">>;
    }) => {
      const { error } = await supabase
        .from("projeto_secoes")
        .update(updates as any)
        .eq("id", secaoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto-tarefas-v2", projetoId] });
      toast.success("Seção atualizada!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteSecao = useMutation({
    mutationFn: async (secaoId: string) => {
      const { error } = await supabase
        .from("projeto_secoes")
        .delete()
        .eq("id", secaoId);
      if (error) throw error;
    },
    onMutate: async (secaoId) => {
      await queryClient.cancelQueries({ queryKey: ["projeto-tarefas-v2", projetoId] });
      const previous = queryClient.getQueryData<ProjetoTarefasView>(["projeto-tarefas-v2", projetoId]);
      patchView((v) => ({
        ...v,
        secoes: v.secoes.filter(s => s.id !== secaoId),
        tarefas: v.tarefas.filter(t => t.secao_id !== secaoId),
      }));
      return { previous };
    },
    onError: (err: Error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(["projeto-tarefas-v2", projetoId], context.previous);
      toast.error("Erro ao excluir seção: " + err.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto-tarefas-v2", projetoId] });
    },
    onSuccess: () => toast.success("Seção excluída"),
  });

  const toggleSecaoBriefing = useMutation({
    mutationFn: async ({ secaoId, temBriefing }: { secaoId: string; temBriefing: boolean }) => {
      const { error } = await supabase
        .from("projeto_secoes")
        .update({ tem_briefing: temBriefing } as any)
        .eq("id", secaoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto-tarefas-v2", projetoId] });
      toast.success("Briefing atualizado!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const softDeleteTarefa = useMutation({
    mutationFn: async (tarefaId: string) => {
      // Confirmação obrigatória — evita exclusão acidental por clique/atalho.
      const tarefa = tarefas.find(t => t.id === tarefaId);
      const { confirmExclusaoTarefa } = await import("@/lib/projetos/confirmConclusao");
      const ok = await confirmExclusaoTarefa({
        titulo: tarefa?.titulo,
        isSubtarefa: !!tarefa?.parent_tarefa_id,
      });
      if (!ok) throw new Error("__CANCELLED__");

      const { error } = await supabase
        .from("projeto_tarefas")
        .update({ excluida_em: new Date().toISOString(), excluida_por: user?.id || null } as any)
        .eq("id", tarefaId);
      if (error) throw error;

      await registrarAuditoriaTarefa({
        tarefaId,
        projetoId: tarefa?.projeto_id,
        parentTarefaId: tarefa?.parent_tarefa_id,
        isSubtarefa: !!tarefa?.parent_tarefa_id,
        tituloSnapshot: tarefa?.titulo,
        action: "excluida",
        metadata: { source: "softDeleteTarefa" },
      });
    },
    onMutate: async (tarefaId) => {
      await queryClient.cancelQueries({ queryKey: ["projeto-tarefas-v2", projetoId] });
      const previous = queryClient.getQueryData<ProjetoTarefasView>(["projeto-tarefas-v2", projetoId]);
      patchView((v) => ({
        ...v,
        tarefas: v.tarefas.filter(t => t.id !== tarefaId),
      }));
      return { previous };
    },
    onError: (err: Error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(["projeto-tarefas-v2", projetoId], context.previous);
      if (err.message === "__CANCELLED__") return;
      toast.error(err.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto-tarefas-v2", projetoId] });
      queryClient.invalidateQueries({ queryKey: ["projeto-tarefas-excluidas", projetoId] });
      queryClient.invalidateQueries({ queryKey: ["projeto-tarefas-excluidas-count", projetoId] });
    },
    onSuccess: () => toast.success("Tarefa movida para a lixeira"),
  });

  const restaurarTarefa = useMutation({
    mutationFn: async (tarefaId: string) => {
      const tarefa = tarefas.find(t => t.id === tarefaId);
      const { error } = await supabase
        .from("projeto_tarefas")
        .update({ excluida_em: null, excluida_por: null } as any)
        .eq("id", tarefaId);
      if (error) throw error;

      await registrarAuditoriaTarefa({
        tarefaId,
        projetoId: tarefa?.projeto_id,
        parentTarefaId: tarefa?.parent_tarefa_id,
        isSubtarefa: !!tarefa?.parent_tarefa_id,
        tituloSnapshot: tarefa?.titulo,
        action: "restaurada",
        metadata: { source: "restaurarTarefa" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto-tarefas-v2", projetoId] });
      queryClient.invalidateQueries({ queryKey: ["projeto-tarefas-excluidas", projetoId] });
      queryClient.invalidateQueries({ queryKey: ["projeto-tarefas-excluidas-count", projetoId] });
      toast.success("Tarefa restaurada!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Fase 2 — contagem leve sempre disponível para o badge da lixeira.
  const { data: tarefasExcluidasCount = 0 } = useQuery({
    queryKey: ["projeto-tarefas-excluidas-count", projetoId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("count_projeto_tarefas_excluidas", {
        p_projeto_id: projetoId!,
      });
      if (error) throw error;
      return (data as number) || 0;
    },
    enabled: !!projetoId && !!user,
    staleTime: 30_000,
  });

  // Fase 2 — só carrega o conteúdo da lixeira quando o usuário a abre.
  const { data: tarefasExcluidas = [], isLoading: tarefasExcluidasLoading } = useQuery({
    queryKey: ["projeto-tarefas-excluidas", projetoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_tarefas")
        .select("*")
        .eq("projeto_id", projetoId!)
        .not("excluida_em", "is", null)
        .order("excluida_em" as any, { ascending: false });
      if (error) throw error;
      return data as (ProjetoTarefa & { excluida_em: string })[];
    },
    enabled: !!projetoId && !!user && lixeiraOpen,
  });

  // Batch reorder via RPC: 1 round-trip + 1 invalidação para a coluna inteira.
  const reorderTarefasSecao = useMutation({
    mutationFn: async ({ secaoId, orderedIds }: { secaoId: string; orderedIds: string[] }) => {
      const { error } = await supabase.rpc("reorder_tarefas_secao", {
        p_secao_id: secaoId,
        p_ordered_ids: orderedIds,
      });
      if (error) throw error;
    },
    onMutate: async ({ secaoId, orderedIds }) => {
      await queryClient.cancelQueries({ queryKey: ["projeto-tarefas-v2", projetoId] });
      const previous = queryClient.getQueryData<ProjetoTarefasView>(["projeto-tarefas-v2", projetoId]);
      const orderMap = new Map(orderedIds.map((id, idx) => [id, idx]));
      patchView((v) => ({
        ...v,
        tarefas: v.tarefas.map(t =>
          t.secao_id === secaoId && orderMap.has(t.id)
            ? { ...t, ordem: orderMap.get(t.id)! }
            : t
        ),
      }));
      return { previous };
    },
    onError: (err: Error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(["projeto-tarefas-v2", projetoId], context.previous);
      toast.error(err.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto-tarefas-v2", projetoId] });
    },
  });

  // ===== Realtime — Fase 2 =====
  // Inscreve em mudanças de projeto_tarefas/projeto_secoes deste projeto
  // e dispara invalidate debounce-200ms para refazer a view consolidada.
  // Observação: o filtro server-side por projeto_id evita ruído cruzado.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!projetoId || !user) return;
    let cancelled = false;
    const scheduleInvalidate = () => {
      if (cancelled) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (cancelled) return;
        queryClient.invalidateQueries({ queryKey: ["projeto-tarefas-v2", projetoId] });
        queryClient.invalidateQueries({ queryKey: ["projeto-tarefas-excluidas-count", projetoId] });
      }, 200);
    };
    // Topic único por instância — evita "cannot add postgres_changes callbacks
    // ... after subscribe()" quando o hook monta múltiplas vezes (StrictMode,
    // múltiplos consumers do mesmo projeto).
    const channelName = uniqueChannelName(`rt-projeto-${projetoId}`);
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "projeto_tarefas", filter: `projeto_id=eq.${projetoId}` },
        scheduleInvalidate)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "projeto_secoes", filter: `projeto_id=eq.${projetoId}` },
        scheduleInvalidate)
      .subscribe((status, err) => {
        if (cancelled) return;
        if (err) {
          logger.error(`[useProjetoTarefas] Realtime channel error (${channelName})`, { error: err });
          return;
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          logger.warn(`[useProjetoTarefas] Realtime status=${status} channel=${channelName}`);
        }
      });
    return () => {
      cancelled = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      try {
        const result = supabase.removeChannel(channel) as unknown as Promise<unknown> | unknown;
        if (result && typeof (result as Promise<unknown>).catch === "function") {
          (result as Promise<unknown>).catch((err) => {
            // canal já pode ter sido removido — apenas auditamos para detectar leaks no longo prazo
            logger.warn(`[useProjetoTarefas] removeChannel rejeitado (${channelName})`, { error: err });
          });
        }
      } catch (err) {
        logger.warn(`[useProjetoTarefas] removeChannel throw (${channelName})`, { error: err });
      }
    };
  }, [projetoId, user, queryClient]);

  return {
    secoes,
    tarefas,
    secoesLoading: viewLoading,
    tarefasLoading: viewLoading,
    tarefasPorSecao,
    ghostsPorSecao,
    createTarefa,
    updateTarefa,
    toggleTarefaCompleta,
    moveTarefaToSecao,
    createSecao,
    updateSecao,
    deleteSecao,
    toggleSecaoBriefing,
    addColaborador,
    removeColaborador,
    addResponsavel,
    removeResponsavel,
    teamMembers,
    softDeleteTarefa,
    restaurarTarefa,
    tarefasExcluidas,
    tarefasExcluidasLoading,
    tarefasExcluidasCount,
    reorderTarefasSecao,
    // New visibility metadata
    isPartialView,
    restrictToOwn,
    totalSecoesProjeto: view?.totalSecoesProjeto || 0,
    totalTarefasProjeto: view?.totalTarefasProjeto || 0,
    visibleTarefasCount: view?.visibleTarefasCount || 0,
  };
}
