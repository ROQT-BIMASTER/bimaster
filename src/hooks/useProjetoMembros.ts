import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";

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
    email: string | null;
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

      const userIds = membrosData.map((m: any) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nome, avatar_url, email")
        .in("id", userIds);

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
  });

  const isCoordinator = membros.some(
    (m) => m.user_id === user?.id && ["coordenador", "gestor_produto"].includes(m.papel)
  ) || isAdmin || isGerente;

  const currentUserPapel = membros.find(m => m.user_id === user?.id)?.papel;

  const addMembro = useMutation({
    mutationFn: async ({ userId, papel = "membro" }: { userId: string; papel?: string }) => {
      if (!projetoId) throw new Error("Projeto não definido");
      const { data, error } = await supabase
        .from("projeto_membros")
        .insert({ projeto_id: projetoId, user_id: userId, papel })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto_membros", projetoId] });
      toast.success("Membro adicionado!");
    },
    onError: (err: Error) => toast.error("Erro ao adicionar membro: " + err.message),
  });

  const removeMembro = useMutation({
    mutationFn: async (membroId: string) => {
      const { error } = await supabase
        .from("projeto_membros")
        .delete()
        .eq("id", membroId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto_membros", projetoId] });
      toast.success("Membro removido!");
    },
    onError: (err: Error) => toast.error("Erro ao remover membro: " + err.message),
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto_membros", projetoId] });
      toast.success("Visibilidade de seções atualizada!");
    },
    onError: (err: Error) => toast.error("Erro ao atualizar seções: " + err.message),
  });

  const updatePapel = useMutation({
    mutationFn: async ({ membroId, papel }: { membroId: string; papel: string }) => {
      const { error } = await supabase
        .from("projeto_membros")
        .update({ papel })
        .eq("id", membroId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto_membros", projetoId] });
      toast.success("Papel atualizado!");
    },
    onError: (err: Error) => toast.error("Erro ao atualizar papel: " + err.message),
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
