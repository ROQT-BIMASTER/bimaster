import { logger } from "@/lib/logger";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface ProjetoSecao {
  id: string;
  projeto_id: string;
  nome: string;
  ordem: number;
  tem_briefing: boolean;
  created_at: string;
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
  criador?: { id: string; nome: string; avatar_url: string | null } | null;
  colaboradores?: { user_id: string; nome: string; avatar_url: string | null }[];
  produto_foto_url?: string | null;
  produto_tipo?: string | null;
  produto_nome?: string | null;
  linked_produtos?: { id: string; nome: string; foto_url: string | null; codigo: string | null }[];
  tipo_tarefa?: string | null;
  motivo_retrabalho?: string | null;
  dias_alerta_antes?: number | null;
}

export function useProjetoTarefas(projetoId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch allowed section IDs for current user in this project
  const { data: allowedSecaoIds } = useQuery({
    queryKey: ["membro-secoes-permitidas", projetoId, user?.id],
    queryFn: async () => {
      if (!projetoId || !user?.id) return null;
      
      const { data: membro } = await supabase
        .from("projeto_membros")
        .select("id, papel")
        .eq("projeto_id", projetoId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!membro) return null; // not a member, RLS handles access

      // Coordinators/admins see everything
      if (["coordenador", "gestor_produto"].includes(membro.papel)) return null;

      const { data: secAssignments } = await supabase
        .from("projeto_membro_secoes")
        .select("secao_id")
        .eq("membro_id", membro.id);

      if (!secAssignments || secAssignments.length === 0) return null; // 0 = full access
      return secAssignments.map(s => s.secao_id);
    },
    enabled: !!projetoId && !!user?.id,
  });

  const { data: allSecoes = [], isLoading: secoesLoading } = useQuery({
    queryKey: ["projeto-secoes", projetoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_secoes")
        .select("*")
        .eq("projeto_id", projetoId!)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return data as ProjetoSecao[];
    },
    enabled: !!projetoId && !!user,
  });

  // Filter sections by allowed list
  const secoes = allowedSecaoIds
    ? allSecoes.filter(s => allowedSecaoIds.includes(s.id))
    : allSecoes;

  const { data: allTarefas = [], isLoading: tarefasLoading } = useQuery({
    queryKey: ["projeto-tarefas", projetoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_tarefas")
        .select("*")
        .eq("projeto_id", projetoId!)
        .is("excluida_em", null)
        .order("ordem", { ascending: true });
      if (error) throw error;
      
      // Collect all user IDs (responsavel + criador)
      const allUserIds = new Set<string>();
      for (const t of data as ProjetoTarefa[]) {
        if (t.responsavel_id) allUserIds.add(t.responsavel_id);
        if (t.criador_id) allUserIds.add(t.criador_id);
      }
      
      let profiles: Record<string, { id: string; nome: string; avatar_url: string | null }> = {};
      if (allUserIds.size > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, nome, avatar_url")
          .in("id", [...allUserIds]);
        if (profilesData) {
          profiles = Object.fromEntries(profilesData.map(p => [p.id, p]));
        }
      }

      // Fetch colaboradores
      const tarefaIds = (data as ProjetoTarefa[]).map(t => t.id);
      let colabMap: Record<string, { user_id: string; nome: string; avatar_url: string | null }[]> = {};
      
      if (tarefaIds.length > 0) {
        const { data: colabs } = await supabase
          .from("projeto_tarefa_colaboradores")
          .select("tarefa_id, user_id")
          .in("tarefa_id", tarefaIds);
        
        if (colabs && colabs.length > 0) {
          const colabUserIds = [...new Set(colabs.map(c => c.user_id))];
          // Add to profiles if not already there
          const missingIds = colabUserIds.filter(id => !profiles[id]);
          if (missingIds.length > 0) {
            const { data: colabProfiles } = await supabase
              .from("profiles")
              .select("id, nome, avatar_url")
              .in("id", missingIds);
            if (colabProfiles) {
              for (const p of colabProfiles) profiles[p.id] = p;
            }
          }
          
          for (const c of colabs) {
            if (!colabMap[c.tarefa_id]) colabMap[c.tarefa_id] = [];
            const profile = profiles[c.user_id];
            if (profile) {
              colabMap[c.tarefa_id].push({ user_id: c.user_id, nome: profile.nome, avatar_url: profile.avatar_url });
            }
          }
        }
      }

      // Fetch product photos for tarefas with produto_id
      const produtoIds = [...new Set((data as ProjetoTarefa[]).filter(t => t.produto_id).map(t => t.produto_id!))];
      let produtoInfo: Record<string, { foto_url: string | null; tipo: string | null; nome: string | null }> = {};
      if (produtoIds.length > 0) {
        const { data: produtos } = await supabase
          .from("fabrica_produtos" as any)
          .select("id, foto_url, tipo, nome")
          .in("id", produtoIds);
        if (produtos) {
          produtoInfo = Object.fromEntries((produtos as any[]).map(p => [p.id, { foto_url: p.foto_url, tipo: p.tipo, nome: p.nome }]));
        }
      }

      // Fetch linked products from junction table (projeto_tarefa_produtos)
      let linkedProdutosMap: Record<string, { id: string; nome: string; foto_url: string | null; codigo: string | null }[]> = {};
      if (tarefaIds.length > 0) {
        const { data: links } = await supabase
          .from("projeto_tarefa_produtos" as any)
          .select("tarefa_id, produto_id")
          .in("tarefa_id", tarefaIds);
        if (links && (links as any[]).length > 0) {
          const linkedProdutoIds = [...new Set((links as any[]).map((l: any) => l.produto_id))];
          const missingProdutoIds = linkedProdutoIds.filter(id => !produtoInfo[id]);
          let allProdutoData: Record<string, { id: string; nome: string; foto_url: string | null; codigo: string | null }> = {};
          
          // Reuse already fetched data
          for (const id of linkedProdutoIds) {
            if (produtoInfo[id]) {
              allProdutoData[id] = { id, nome: produtoInfo[id].nome || "", foto_url: produtoInfo[id].foto_url, codigo: null };
            }
          }
          
          if (missingProdutoIds.length > 0) {
            const { data: extraProdutos } = await supabase
              .from("fabrica_produtos" as any)
              .select("id, nome, foto_url, codigo")
              .in("id", missingProdutoIds);
            if (extraProdutos) {
              for (const p of extraProdutos as any[]) {
                allProdutoData[p.id] = { id: p.id, nome: p.nome, foto_url: p.foto_url, codigo: p.codigo };
              }
            }
          }
          
          for (const link of links as any[]) {
            if (!linkedProdutosMap[link.tarefa_id]) linkedProdutosMap[link.tarefa_id] = [];
            const prod = allProdutoData[link.produto_id];
            if (prod) linkedProdutosMap[link.tarefa_id].push(prod);
          }
        }
      }

      return (data as ProjetoTarefa[]).map(t => ({
        ...t,
        responsavel: t.responsavel_id ? profiles[t.responsavel_id] || null : null,
        criador: t.criador_id ? profiles[t.criador_id] || null : null,
        colaboradores: colabMap[t.id] || [],
        produto_foto_url: t.produto_id ? (produtoInfo[t.produto_id]?.foto_url || null) : null,
        produto_tipo: t.produto_id ? (produtoInfo[t.produto_id]?.tipo || null) : null,
        produto_nome: t.produto_id ? (produtoInfo[t.produto_id]?.nome || null) : null,
        linked_produtos: linkedProdutosMap[t.id] || [],
      }));
    },
    enabled: !!projetoId && !!user,
  });

  // Filter tarefas by allowed sections
  const tarefas = allowedSecaoIds
    ? allTarefas.filter(t => allowedSecaoIds.includes(t.secao_id))
    : allTarefas;

  // Movement history for ghost rows
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

  // Ghost trails: tasks that were moved FROM a given section
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
      // Record the movement
      const { error: movError } = await supabase
        .from("projeto_tarefa_movimentacoes" as any)
        .insert({
          tarefa_id: tarefaId,
          secao_origem_id: secaoOrigemId,
          secao_destino_id: secaoDestinoId,
          movido_por: user?.id,
        } as any);
      if (movError) throw movError;

      // Actually move the task
      const { error } = await supabase
        .from("projeto_tarefas")
        .update({ secao_id: secaoDestinoId, updated_at: new Date().toISOString() })
        .eq("id", tarefaId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto-tarefas", projetoId] });
      queryClient.invalidateQueries({ queryKey: ["tarefa-movimentacoes", projetoId] });
      toast.success("Tarefa movida!");
    },
    onError: (err: Error) => toast.error(err.message),
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
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto-tarefas", projetoId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateTarefa = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ProjetoTarefa> & { id: string }) => {
      const { error } = await supabase
        .from("projeto_tarefas")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto-tarefas", projetoId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleTarefaCompleta = useMutation({
    mutationFn: async (tarefa: ProjetoTarefa) => {
      const isCompleting = tarefa.status !== "concluida";
      logger.debug("[toggleTarefaCompleta] tarefa:", tarefa.id, "isCompleting:", isCompleting, "current status:", tarefa.status);
      const { error } = await supabase
        .from("projeto_tarefas")
        .update({
          status: isCompleting ? "concluida" : "pendente",
          data_conclusao: isCompleting ? new Date().toISOString().split("T")[0] : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", tarefa.id);
      if (error) {
        console.error("[toggleTarefaCompleta] error:", error);
        throw error;
      }
      logger.debug("[toggleTarefaCompleta] success");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto-tarefas", projetoId] });
    },
    onError: (err: Error) => {
      console.error("[toggleTarefaCompleta] mutation error:", err);
      toast.error("Erro ao atualizar status: " + err.message);
    },
  });

  const createSecao = useMutation({
    mutationFn: async (nome: string) => {
      const maxOrdem = secoes.length;
      const { error } = await supabase
        .from("projeto_secoes")
        .insert({ projeto_id: projetoId!, nome, ordem: maxOrdem });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto-secoes", projetoId] });
      toast.success("Seção criada!");
    },
  });

  // Add/remove colaboradores
  const addColaborador = useMutation({
    mutationFn: async ({ tarefaId, userId }: { tarefaId: string; userId: string }) => {
      const { error } = await supabase
        .from("projeto_tarefa_colaboradores")
        .insert({ tarefa_id: tarefaId, user_id: userId });
      if (error) throw error;
      return { tarefaId, userId };
    },
    onMutate: async ({ tarefaId, userId }) => {
      await queryClient.cancelQueries({ queryKey: ["projeto-tarefas", projetoId] });
      const previous = queryClient.getQueryData<ProjetoTarefa[]>(["projeto-tarefas", projetoId]);
      const member = teamMembers.find(m => m.id === userId);
      if (previous && member) {
        queryClient.setQueryData<ProjetoTarefa[]>(["projeto-tarefas", projetoId], old =>
          (old || []).map(t =>
            t.id === tarefaId
              ? { ...t, colaboradores: [...(t.colaboradores || []), { user_id: userId, nome: member.nome, avatar_url: member.avatar_url }] }
              : t
          )
        );
      }
      return { previous };
    },
    onError: (err: Error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["projeto-tarefas", projetoId], context.previous);
      }
      toast.error(err.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto-tarefas", projetoId] });
    },
  });

  const removeColaborador = useMutation({
    mutationFn: async ({ tarefaId, userId }: { tarefaId: string; userId: string }) => {
      const { error } = await supabase
        .from("projeto_tarefa_colaboradores")
        .delete()
        .eq("tarefa_id", tarefaId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto-tarefas", projetoId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Toggle briefing on section
  const toggleSecaoBriefing = useMutation({
    mutationFn: async ({ secaoId, temBriefing }: { secaoId: string; temBriefing: boolean }) => {
      const { error } = await supabase
        .from("projeto_secoes")
        .update({ tem_briefing: temBriefing } as any)
        .eq("id", secaoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto-secoes", projetoId] });
      toast.success("Briefing atualizado!");
    },
    onError: (err: Error) => toast.error(err.message),
  });
  const { data: teamMembers = [] } = useQuery({
    queryKey: ["team-members", projetoId],
    queryFn: async () => {
      if (!projetoId) return [];
      // Only fetch profiles of project members
      const { data: membros } = await supabase
        .from("projeto_membros")
        .select("user_id")
        .eq("projeto_id", projetoId);
      if (!membros || membros.length === 0) return [];
      const userIds = membros.map(m => m.user_id);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, avatar_url")
        .in("id", userIds)
        .order("nome");
      if (error) throw error;
      return data as { id: string; nome: string; avatar_url: string | null }[];
    },
    enabled: !!user && !!projetoId,
  });

  // Soft delete
  const softDeleteTarefa = useMutation({
    mutationFn: async (tarefaId: string) => {
      const { error } = await supabase
        .from("projeto_tarefas")
        .update({ excluida_em: new Date().toISOString(), excluida_por: user?.id || null } as any)
        .eq("id", tarefaId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto-tarefas", projetoId] });
      queryClient.invalidateQueries({ queryKey: ["projeto-tarefas-excluidas", projetoId] });
      toast.success("Tarefa movida para a lixeira");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const restaurarTarefa = useMutation({
    mutationFn: async (tarefaId: string) => {
      const { error } = await supabase
        .from("projeto_tarefas")
        .update({ excluida_em: null, excluida_por: null } as any)
        .eq("id", tarefaId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto-tarefas", projetoId] });
      queryClient.invalidateQueries({ queryKey: ["projeto-tarefas-excluidas", projetoId] });
      toast.success("Tarefa restaurada!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

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
    enabled: !!projetoId && !!user,
  });

  return {
    secoes,
    tarefas,
    secoesLoading,
    tarefasLoading,
    tarefasPorSecao,
    ghostsPorSecao,
    createTarefa,
    updateTarefa,
    toggleTarefaCompleta,
    moveTarefaToSecao,
    createSecao,
    toggleSecaoBriefing,
    addColaborador,
    removeColaborador,
    teamMembers,
    softDeleteTarefa,
    restaurarTarefa,
    tarefasExcluidas,
    tarefasExcluidasLoading,
  };
}
