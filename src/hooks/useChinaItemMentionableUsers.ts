import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface MentionableUser {
  id: string;
  nome: string;
  avatar_url: string | null;
}

/**
 * Usuários mencionáveis no contexto de um item do checklist China–Brasil.
 * Inclui:
 *  - o próprio usuário
 *  - criador/revisor da submissão
 *  - membros do projeto vinculado (via china_submissao_projetos → projeto_membros)
 */
export function useChinaItemMentionableUsers(submissaoId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["china-item-mentionable", submissaoId, user?.id],
    enabled: !!submissaoId && !!user,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<MentionableUser[]> => {
      const ids = new Set<string>();
      if (user?.id) ids.add(user.id);

      const { data: sub } = await supabase
        .from("china_produto_submissoes")
        .select("created_by, reviewed_by, liberado_por")
        .eq("id", submissaoId!)
        .maybeSingle();
      if (sub?.created_by) ids.add(sub.created_by);
      if ((sub as any)?.reviewed_by) ids.add((sub as any).reviewed_by);
      if ((sub as any)?.liberado_por) ids.add((sub as any).liberado_por);

      const { data: vinculos } = await supabase
        .from("china_submissao_projetos" as any)
        .select("projeto_id")
        .eq("submissao_id", submissaoId!);

      const projetoIds = (vinculos || [])
        .map((v: any) => v.projeto_id)
        .filter(Boolean);

      if (projetoIds.length > 0) {
        const { data: membros } = await supabase
          .from("projeto_membros")
          .select("user_id")
          .in("projeto_id", projetoIds);
        membros?.forEach((m: any) => m.user_id && ids.add(m.user_id));
      }

      if (ids.size === 0) return [];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nome, avatar_url")
        .in("id", Array.from(ids));

      return ((profiles || []) as any[])
        .map((p) => ({
          id: p.id,
          nome: p.nome || "Usuário",
          avatar_url: p.avatar_url ?? null,
        }))
        .sort((a, b) => a.nome.localeCompare(b.nome));
    },
  });
}
