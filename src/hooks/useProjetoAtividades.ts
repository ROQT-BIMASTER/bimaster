import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMemo, useCallback } from "react";

export interface ProjetoAtividade {
  id: string;
  projeto_id: string;
  tarefa_id: string | null;
  user_id: string;
  tipo: string;
  descricao: string | null;
  metadata: Record<string, any>;
  lida: boolean;
  arquivada: boolean;
  favorita: boolean;
  created_at: string;
  user_nome?: string;
  user_avatar?: string | null;
  projeto_nome?: string;
  projeto_cor?: string;
}

export type InboxFilter = {
  projetoIds?: string[];
  tipos?: string[];
  search?: string;
};

export function useProjetoAtividades(filter?: InboxFilter) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: atividades = [], isLoading } = useQuery({
    queryKey: ["projeto-atividades"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_atividades")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;

      const userIds = [...new Set((data || []).map(a => a.user_id))];
      const projetoIds = [...new Set((data || []).map(a => a.projeto_id))];

      const [profilesRes, projetosRes] = await Promise.all([
        userIds.length > 0 ? supabase.from("profiles").select("id, nome, avatar_url").in("id", userIds) : { data: [] },
        projetoIds.length > 0 ? supabase.from("projetos").select("id, nome, cor").in("id", projetoIds) : { data: [] },
      ]);

      const profileMap = Object.fromEntries((profilesRes.data || []).map(p => [p.id, p]));
      const projetoMap = Object.fromEntries((projetosRes.data || []).map(p => [p.id, p]));

      return (data || []).map(a => ({
        ...a,
        metadata: (a.metadata || {}) as Record<string, any>,
        user_nome: profileMap[a.user_id]?.nome || "Usuário",
        user_avatar: profileMap[a.user_id]?.avatar_url || null,
        projeto_nome: projetoMap[a.projeto_id]?.nome || "Projeto",
        projeto_cor: projetoMap[a.projeto_id]?.cor || "#6366f1",
      })) as ProjetoAtividade[];
    },
    enabled: !!user,
  });

  const filtered = useMemo(() => {
    let list = atividades;
    if (filter?.projetoIds?.length) {
      list = list.filter(a => filter.projetoIds!.includes(a.projeto_id));
    }
    if (filter?.tipos?.length) {
      list = list.filter(a => filter.tipos!.includes(a.tipo));
    }
    if (filter?.search) {
      const s = filter.search.toLowerCase();
      list = list.filter(a =>
        (a.descricao || "").toLowerCase().includes(s) ||
        (a.user_nome || "").toLowerCase().includes(s) ||
        (a.projeto_nome || "").toLowerCase().includes(s)
      );
    }
    return list;
  }, [atividades, filter]);

  const naoLidas = filtered.filter(a => !a.lida && !a.arquivada).length;
  const ativas = filtered.filter(a => !a.arquivada);
  const arquivadas = filtered.filter(a => a.arquivada);
  const favoritas = filtered.filter(a => a.favorita && !a.arquivada);
  const mencoes = filtered.filter(a => a.tipo === "comentou" && !a.arquivada);
  const hoje = ativas.filter(a => {
    const d = new Date(a.created_at);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length;

  const projetos = useMemo(() => {
    const map = new Map<string, { id: string; nome: string; cor: string }>();
    atividades.forEach(a => {
      if (!map.has(a.projeto_id)) {
        map.set(a.projeto_id, { id: a.projeto_id, nome: a.projeto_nome || "Projeto", cor: a.projeto_cor || "#6366f1" });
      }
    });
    return Array.from(map.values());
  }, [atividades]);

  const arquivar = useCallback(async (ids: string[]) => {
    await supabase.from("projeto_atividades").update({ arquivada: true } as any).in("id", ids);
    queryClient.invalidateQueries({ queryKey: ["projeto-atividades"] });
  }, [queryClient]);

  const desarquivar = useCallback(async (ids: string[]) => {
    await supabase.from("projeto_atividades").update({ arquivada: false } as any).in("id", ids);
    queryClient.invalidateQueries({ queryKey: ["projeto-atividades"] });
  }, [queryClient]);

  const toggleFavorita = useCallback(async (id: string) => {
    const item = atividades.find(a => a.id === id);
    if (!item) return;
    await supabase.from("projeto_atividades").update({ favorita: !item.favorita } as any).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["projeto-atividades"] });
  }, [atividades, queryClient]);

  const marcarLidas = useCallback(async (ids: string[]) => {
    await supabase.from("projeto_atividades").update({ lida: true }).in("id", ids);
    queryClient.invalidateQueries({ queryKey: ["projeto-atividades"] });
  }, [queryClient]);

  return {
    atividades: ativas,
    arquivadas,
    favoritas,
    mencoes,
    isLoading,
    naoLidas,
    hoje,
    projetos,
    arquivar,
    desarquivar,
    toggleFavorita,
    marcarLidas,
  };
}
