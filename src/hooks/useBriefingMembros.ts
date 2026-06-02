import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";

export interface BriefingMembro {
  id: string;
  briefing_id: string;
  user_id: string;
  papel: string;
  created_at: string;
  profile?: {
    id: string;
    nome: string;
    avatar_url: string | null;
  } | null;
}

export function useBriefingMembros(briefingId: string | undefined) {
  const { user } = useAuth();
  const { isAdmin, isGerente } = useUserRole();
  const queryClient = useQueryClient();

  const { data: membros = [], isLoading } = useQuery({
    queryKey: ["briefing_membros", briefingId],
    queryFn: async () => {
      if (!briefingId) return [];
      const { data, error } = await supabase
        .from("briefing_membros" as any)
        .select("*")
        .eq("briefing_id", briefingId)
        .order("created_at");
      if (error) throw error;

      const ids = (data as any[]).map((m) => m.user_id);
      const { data: profiles } = ids.length
        ? await (supabase.rpc as any)("get_chat_directory", { _ids: ids })
        : { data: [] as any[] };

      return (data as any[]).map((m) => ({
        ...m,
        profile: (profiles as any[] | null)?.find((p) => p.id === m.user_id) || null,
      })) as BriefingMembro[];
    },
    enabled: !!briefingId && !!user,
    // Espelha useProjetoMembros: lista de membros precisa refletir adições
    // feitas por outros usuários sem aguardar staleTime global (5min).
    staleTime: 30 * 1000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  // Realtime: invalida o cache quando alguém entra/sai do briefing em qualquer
  // sessão (sem isso, o membro recém-adicionado por outro usuário só aparece
  // no @-mention após F5 ou re-focus).
  useEffect(() => {
    if (!briefingId) return;
    const channel = supabase
      .channel(`briefing_membros:${briefingId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "briefing_membros", filter: `briefing_id=eq.${briefingId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["briefing_membros", briefingId] });
          // Conversa vinculada do chat v2 também depende de participantes;
          // a trigger no banco já sincroniza, mas a UI precisa rebuscar.
          queryClient.invalidateQueries({ queryKey: ["chat-mention-members"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [briefingId, queryClient]);

  const currentUserPapel = membros.find((m) => m.user_id === user?.id)?.papel;
  const isCoordinator =
    membros.some(
      (m) => m.user_id === user?.id && ["gestor_produto", "coordenador"].includes(m.papel),
    ) || isAdmin || isGerente;

  const addMembro = useMutation({
    mutationFn: async ({ userId, papel = "membro" }: { userId: string; papel?: string }) => {
      if (!briefingId) throw new Error("Briefing não definido");
      const { data, error } = await supabase
        .from("briefing_membros" as any)
        .insert({ briefing_id: briefingId, user_id: userId, papel })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["briefing_membros", briefingId] });
      toast.success("Membro adicionado!");
    },
    onError: (err: Error) => toast.error("Erro ao adicionar membro: " + err.message),
  });

  const removeMembro = useMutation({
    mutationFn: async (membroId: string) => {
      const { error } = await supabase
        .from("briefing_membros" as any)
        .delete()
        .eq("id", membroId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["briefing_membros", briefingId] });
      toast.success("Membro removido!");
    },
    onError: (err: Error) => toast.error("Erro ao remover membro: " + err.message),
  });

  const updatePapel = useMutation({
    mutationFn: async ({ membroId, papel }: { membroId: string; papel: string }) => {
      if (!briefingId) throw new Error("Briefing não definido");
      const { data, error } = await supabase
        .from("briefing_membros" as any)
        .update({ papel })
        .eq("id", membroId)
        .eq("briefing_id", briefingId)
        .select("id, papel")
        .single();
      if (error) throw error;
      if (!data || (data as any).papel !== papel) {
        throw new Error("O papel não foi gravado. Verifique sua permissão.");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["briefing_membros", briefingId] });
      toast.success("Papel atualizado!");
    },
    onError: (err: Error) => toast.error("Erro ao atualizar papel: " + err.message),
  });

  return { membros, isLoading, isCoordinator, currentUserPapel, addMembro, removeMembro, updatePapel };
}
