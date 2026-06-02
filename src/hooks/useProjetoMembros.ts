import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { unstickBodyPointerEvents } from "@/lib/projetos/unstickBodyPointerEvents";
import { toast } from "sonner";

/** Chaves de cache reavaliadas quando a composição/permissões de um projeto mudam em qualquer aba. */
function invalidateProjetoMembershipCaches(qc: QueryClient, projetoId: string | undefined) {
  if (!projetoId) return;
  qc.invalidateQueries({ queryKey: ["projeto_membros", projetoId], refetchType: "active" });
  qc.invalidateQueries({ queryKey: ["projeto_ex_membros", projetoId], refetchType: "active" });
  qc.invalidateQueries({ queryKey: ["projeto-tarefas-v2", projetoId], refetchType: "active" });
  qc.invalidateQueries({ queryKey: ["projetos-membros"], refetchType: "active" });
  qc.invalidateQueries({ queryKey: ["projetos-team-data"], refetchType: "active" });
  // Picker de @-menção em tarefas (TarefaChatPanel, TarefaComentariosSection,
  // TarefaFocusMode, MinhasTarefaChat). Sem isso o cache de 60s segura a lista
  // antiga e o membro recém-adicionado não aparece no autocomplete.
  qc.invalidateQueries({ queryKey: ["tarefa-mentionable-users"], refetchType: "active" });
  // Participantes da conversa vinculada (chat drawer v2 → MentionAutocomplete).
  // A trigger no banco já adiciona o usuário em conversas_participantes; aqui
  // garantimos que o cache local também recarrega.
  qc.invalidateQueries({ queryKey: ["chat-mention-members"], refetchType: "active" });
}

export const PROJETO_MEMBROS_BROADCAST_CHANNEL = "projeto-membros-sync";


export interface ProjetoMembro {
  id: string;
  projeto_id: string;
  user_id: string;
  papel: string;
  created_at: string;
  profile?: {
    id: string;
    nome: string;
    avatar_url: string | null;
    // email saiu do chat_directory por questao de privacidade (RLS estrita
    // de profiles). Mantido como opcional para call-sites que ainda
    // referenciam — vai vir undefined.
    email?: string | null;
  };
  secoes_ids?: string[];
}

export function useProjetoMembros(projetoId: string | undefined) {
  const { user } = useAuth();
  const { isAdmin, isGerente } = useUserRole();
  const queryClient = useQueryClient();

  const { data: membros = [], isLoading } = useQuery({
    queryKey: ["projeto_membros", projetoId],
    queryFn: async () => {
      if (!projetoId) return [];

      const { data: membrosData, error } = await supabase
        .from("projeto_membros")
        .select("*")
        .eq("projeto_id", projetoId)
        .order("created_at");
      if (error) throw error;

      // RPC SECURITY DEFINER que devolve nome/avatar de TODOS os membros do
      // projeto, contornando a RLS estrita de profiles (que via
      // chat_directory deixava muitos membros como "Membro" sem nome,
      // quebrando o picker de Responsável e o MentionInput).
      const { data: profiles } = await supabase
        .rpc("get_projeto_membros_directory", { _projeto_id: projetoId });

      const membroIds = membrosData.map((m: any) => m.id);
      const { data: secAssignments } = await supabase
        .from("projeto_membro_secoes")
        .select("membro_id, secao_id")
        .in("membro_id", membroIds);

      return membrosData.map((m: any) => ({
        ...m,
        profile: profiles?.find((p: any) => p.id === m.user_id) || null,
        secoes_ids: secAssignments
          ?.filter((s: any) => s.membro_id === m.id)
          .map((s: any) => s.secao_id) || [],
      })) as ProjetoMembro[];
    },
    enabled: !!projetoId && !!user,
    // Lista de membros precisa refletir convites recém-aceitos e adições em
    // outras abas sem aguardar staleTime de 5min do default global.
    staleTime: 30 * 1000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  // Realtime: invalida caches quando alguém entra/sai do projeto em qualquer
  // sessão (aceite de convite, remoção via tela de Equipe, etc.).
  useEffect(() => {
    if (!projetoId) return;
    const channel = supabase
      .channel(`projeto_membros:${projetoId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "projeto_membros", filter: `projeto_id=eq.${projetoId}` },
        () => {
          invalidateProjetoMembershipCaches(queryClient, projetoId);
          // Outra aba pode estar com um modal Radix aberto cujo overlay
          // travou o body; destrava defensivamente.
          unstickBodyPointerEvents();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [projetoId, queryClient]);

  // BroadcastChannel: caminho redundante e de baixa latência para abas no
  // mesmo navegador. Cobre o caso em que o socket Realtime de uma aba em
  // background foi pausado pelo browser.
  useEffect(() => {
    if (!projetoId || typeof BroadcastChannel === "undefined") return;
    const bc = new BroadcastChannel(PROJETO_MEMBROS_BROADCAST_CHANNEL);
    bc.onmessage = (event) => {
      const data = event?.data as { type?: string; projetoId?: string } | undefined;
      if (!data || data.projetoId !== projetoId) return;
      if (data.type === "membro_removido" || data.type === "membro_alterado") {
        invalidateProjetoMembershipCaches(queryClient, projetoId);
        unstickBodyPointerEvents();
      }
    };
    return () => {
      bc.close();
    };
  }, [projetoId, queryClient]);

  // Visibilitychange: ao voltar a aba, força re-sync e destrava body.
  // Cobre cenários onde Realtime/BroadcastChannel falharam enquanto
  // a aba estava em background.
  useEffect(() => {
    if (!projetoId || typeof document === "undefined") return;
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        invalidateProjetoMembershipCaches(queryClient, projetoId);
        unstickBodyPointerEvents();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [projetoId, queryClient]);


  const isCoordinator = membros.some(
    (m) => m.user_id === user?.id && ["coordenador", "gestor_produto"].includes(m.papel)
  ) || isAdmin || isGerente;

  const currentUserPapel = membros.find(m => m.user_id === user?.id)?.papel;

  // Helper: invalida todos os caches que dependem da lista de membros do
  // projeto. Roda em background — a UI já mostrou o membro otimisticamente.
  const invalidateMemberCaches = () => {
    queryClient.invalidateQueries({ queryKey: ["projeto_membros", projetoId] });
    queryClient.invalidateQueries({ queryKey: ["projeto-tarefas-v2", projetoId] });
    queryClient.invalidateQueries({ queryKey: ["projetos-membros"] });
    queryClient.invalidateQueries({ queryKey: ["projetos-team-data"] });
  };

  const addMembro = useMutation({
    mutationFn: async ({ userId, papel = "membro" }: {
      userId: string;
      papel?: string;
      // profile é só usado no patch otimista — não é enviado ao banco.
      profile?: { nome?: string | null; avatar_url?: string | null; email?: string | null };
    }) => {
      if (!projetoId) throw new Error("Projeto não definido");
      const { data, error } = await supabase
        .from("projeto_membros")
        .insert({ projeto_id: projetoId, user_id: userId, papel })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onMutate: async ({ userId, papel = "membro", profile }) => {
      await queryClient.cancelQueries({ queryKey: ["projeto_membros", projetoId] });
      await queryClient.cancelQueries({ queryKey: ["projeto-tarefas-v2", projetoId] });

      const prevMembros = queryClient.getQueryData<ProjetoMembro[]>(["projeto_membros", projetoId]);
      const prevTarefasView = queryClient.getQueryData<any>(["projeto-tarefas-v2", projetoId]);

      const tempId = `temp-membro-${userId}-${Date.now()}`;
      const nome = profile?.nome || "Membro";
      const avatar_url = profile?.avatar_url ?? null;

      // Patch otimista: lista de membros do diálogo de Equipe.
      queryClient.setQueryData<ProjetoMembro[]>(["projeto_membros", projetoId], (old) => {
        const list = old || [];
        if (list.some((m) => m.user_id === userId)) return list;
        const optimistic: ProjetoMembro = {
          id: tempId,
          projeto_id: projetoId!,
          user_id: userId,
          papel,
          created_at: new Date().toISOString(),
          profile: { id: userId, nome, avatar_url, email: profile?.email ?? null },
          secoes_ids: [],
        };
        return [...list, optimistic];
      });

      // Patch otimista: teamMembers usado pelos pickers de Responsável e
      // Seguidores nas tarefas. Esse é o cache que estava atrasando.
      if (prevTarefasView && typeof prevTarefasView === "object") {
        queryClient.setQueryData(["projeto-tarefas-v2", projetoId], (old: any) => {
          if (!old) return old;
          const team = Array.isArray(old.teamMembers) ? old.teamMembers : [];
          if (team.some((m: any) => m.id === userId)) return old;
          return {
            ...old,
            teamMembers: [...team, { id: userId, nome, avatar_url }],
          };
        });
      }

      return { prevMembros, prevTarefasView, tempId };
    },
    onError: (err: Error, _vars, context) => {
      if (context?.prevMembros !== undefined) {
        queryClient.setQueryData(["projeto_membros", projetoId], context.prevMembros);
      }
      if (context?.prevTarefasView !== undefined) {
        queryClient.setQueryData(["projeto-tarefas-v2", projetoId], context.prevTarefasView);
      }
      toast.error("Erro ao adicionar membro: " + err.message);
    },
    onSuccess: (data, _vars, context) => {
      // Reconcilia ID temporário com o ID real do vínculo retornado pelo
      // backend, sem aguardar refetch.
      if (data?.id && context?.tempId) {
        queryClient.setQueryData<ProjetoMembro[]>(["projeto_membros", projetoId], (old) =>
          (old || []).map((m) => (m.id === context.tempId ? { ...m, id: data.id, created_at: data.created_at || m.created_at } : m)),
        );
      }
      toast.success("Membro adicionado!");
    },
    onSettled: () => {
      invalidateMemberCaches();
    },
  });

  const removeMembro = useMutation({
    mutationFn: async (membroId: string) => {
      const { error } = await supabase
        .from("projeto_membros")
        .delete()
        .eq("id", membroId);
      if (error) throw error;
    },
    onMutate: async (membroId) => {
      await queryClient.cancelQueries({ queryKey: ["projeto_membros", projetoId] });
      await queryClient.cancelQueries({ queryKey: ["projeto-tarefas-v2", projetoId] });

      const prevMembros = queryClient.getQueryData<ProjetoMembro[]>(["projeto_membros", projetoId]);
      const prevTarefasView = queryClient.getQueryData<any>(["projeto-tarefas-v2", projetoId]);
      const removidoUserId = prevMembros?.find((m) => m.id === membroId)?.user_id;

      queryClient.setQueryData<ProjetoMembro[]>(["projeto_membros", projetoId], (old) =>
        (old || []).filter((m) => m.id !== membroId),
      );

      if (removidoUserId && prevTarefasView && typeof prevTarefasView === "object") {
        queryClient.setQueryData(["projeto-tarefas-v2", projetoId], (old: any) => {
          if (!old) return old;
          const team = Array.isArray(old.teamMembers) ? old.teamMembers : [];
          return { ...old, teamMembers: team.filter((m: any) => m.id !== removidoUserId) };
        });
      }

      return { prevMembros, prevTarefasView };
    },
    onError: (err: Error, _vars, context) => {
      if (context?.prevMembros !== undefined) {
        queryClient.setQueryData(["projeto_membros", projetoId], context.prevMembros);
      }
      if (context?.prevTarefasView !== undefined) {
        queryClient.setQueryData(["projeto-tarefas-v2", projetoId], context.prevTarefasView);
      }
      toast.error("Erro ao remover membro: " + err.message);
    },
    onSuccess: () => {
      toast.success("Membro removido!");
    },
    onSettled: () => {
      invalidateMemberCaches();
    },
  });

  const updateSecoes = useMutation({
    mutationFn: async ({ membroId, secaoIds }: { membroId: string; secaoIds: string[] }) => {
      const { error: delError } = await supabase
        .from("projeto_membro_secoes")
        .delete()
        .eq("membro_id", membroId);
      if (delError) throw delError;

      if (secaoIds.length > 0) {
        const { error: insError } = await supabase
          .from("projeto_membro_secoes")
          .insert(secaoIds.map((secao_id) => ({ membro_id: membroId, secao_id })));
        if (insError) throw insError;
      }
    },
    onMutate: async ({ membroId, secaoIds }) => {
      await queryClient.cancelQueries({ queryKey: ["projeto_membros", projetoId] });
      const prevMembros = queryClient.getQueryData<ProjetoMembro[]>(["projeto_membros", projetoId]);
      queryClient.setQueryData<ProjetoMembro[]>(["projeto_membros", projetoId], (old) =>
        (old || []).map((m) => (m.id === membroId ? { ...m, secoes_ids: secaoIds } : m)),
      );
      return { prevMembros };
    },
    onError: (err: Error, _vars, context) => {
      if (context?.prevMembros !== undefined) {
        queryClient.setQueryData(["projeto_membros", projetoId], context.prevMembros);
      }
      toast.error("Erro ao atualizar seções: " + err.message);
    },
    onSuccess: () => {
      toast.success("Visibilidade de seções atualizada!");
    },
    onSettled: () => {
      invalidateMemberCaches();
    },
  });

  const updatePapel = useMutation({
    mutationFn: async ({ membroId, papel }: { membroId: string; papel: string }) => {
      if (!projetoId) throw new Error("Projeto não definido");

      const { data, error } = await supabase
        .from("projeto_membros")
        .update({ papel })
        .eq("id", membroId)
        .eq("projeto_id", projetoId)
        .select("id, papel")
        .single();
      if (error) throw error;

      if (!data || data.papel !== papel) {
        throw new Error("O papel não foi gravado. Verifique sua permissão para gerenciar este projeto.");
      }
    },
    onMutate: async ({ membroId, papel }) => {
      await queryClient.cancelQueries({ queryKey: ["projeto_membros", projetoId] });
      const prevMembros = queryClient.getQueryData<ProjetoMembro[]>(["projeto_membros", projetoId]);
      queryClient.setQueryData<ProjetoMembro[]>(["projeto_membros", projetoId], (old) =>
        (old || []).map((m) => (m.id === membroId ? { ...m, papel } : m)),
      );
      return { prevMembros };
    },
    onError: (err: Error, _vars, context) => {
      if (context?.prevMembros !== undefined) {
        queryClient.setQueryData(["projeto_membros", projetoId], context.prevMembros);
      }
      toast.error("Erro ao atualizar papel: " + err.message);
    },
    onSuccess: () => {
      toast.success("Papel atualizado!");
    },
    onSettled: () => {
      invalidateMemberCaches();
    },
  });

  return {
    membros,
    isLoading,
    isCoordinator,
    currentUserPapel,
    addMembro,
    removeMembro,
    updateSecoes,
    updatePapel,
  };
}
