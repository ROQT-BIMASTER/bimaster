import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ProjetoAtividade {
  id: string;
  projeto_id: string;
  tarefa_id: string | null;
  user_id: string;
  tipo: string;
  descricao: string | null;
  metadata: Record<string, any>;
  lida: boolean;
  created_at: string;
  user_nome?: string;
  user_avatar?: string | null;
  projeto_nome?: string;
}

export function useProjetoAtividades() {
  const { user } = useAuth();

  const { data: atividades = [], isLoading } = useQuery({
    queryKey: ["projeto-atividades"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_atividades")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;

      // Fetch user profiles and project names
      const userIds = [...new Set((data || []).map(a => a.user_id))];
      const projetoIds = [...new Set((data || []).map(a => a.projeto_id))];

      const [profilesRes, projetosRes] = await Promise.all([
        userIds.length > 0 ? supabase.from("profiles").select("id, nome, avatar_url").in("id", userIds) : { data: [] },
        projetoIds.length > 0 ? supabase.from("projetos").select("id, nome").in("id", projetoIds) : { data: [] },
      ]);

      const profileMap = Object.fromEntries((profilesRes.data || []).map(p => [p.id, p]));
      const projetoMap = Object.fromEntries((projetosRes.data || []).map(p => [p.id, p]));

      return (data || []).map(a => ({
        ...a,
        metadata: (a.metadata || {}) as Record<string, any>,
        user_nome: profileMap[a.user_id]?.nome || "Usuário",
        user_avatar: profileMap[a.user_id]?.avatar_url || null,
        projeto_nome: projetoMap[a.projeto_id]?.nome || "Projeto",
      })) as ProjetoAtividade[];
    },
    enabled: !!user,
  });

  const naoLidas = atividades.filter(a => !a.lida).length;

  return { atividades, isLoading, naoLidas };
}
