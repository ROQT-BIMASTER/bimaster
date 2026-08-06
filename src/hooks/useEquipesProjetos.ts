import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EquipeProjeto {
  id: string;
  nome: string;
  cor: string | null;
  membros: string[];
}

/**
 * Equipes cadastradas (`equipes_projetos`) com os IDs dos membros.
 * Usado nos filtros de calendário para restringir eventos aos responsáveis
 * que pertencem a uma equipe.
 */
export function useEquipesProjetos() {
  return useQuery({
    queryKey: ["equipes-projetos-com-membros"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<EquipeProjeto[]> => {
      const [{ data: equipes, error: e1 }, { data: membros, error: e2 }] = await Promise.all([
        supabase.from("equipes_projetos").select("id, nome, cor").order("nome"),
        supabase.from("equipe_membros").select("equipe_id, user_id"),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;

      const porEquipe = new Map<string, string[]>();
      (membros || []).forEach((m: { equipe_id: string; user_id: string }) => {
        const arr = porEquipe.get(m.equipe_id) || [];
        arr.push(m.user_id);
        porEquipe.set(m.equipe_id, arr);
      });

      return (equipes || []).map((e: { id: string; nome: string; cor: string | null }) => ({
        id: e.id,
        nome: e.nome,
        cor: e.cor,
        membros: porEquipe.get(e.id) || [],
      }));
    },
  });
}
