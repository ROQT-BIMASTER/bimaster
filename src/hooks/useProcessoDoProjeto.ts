import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ProcessoVinculado {
  processo_id: string;
  nome: string;
  cor: string | null;
  is_coordenador: boolean;
}

/**
 * Retorna o processo operacional (se houver) que espelha as tarefas
 * deste projeto — via `suporte_rotinas_fixas.projeto_id_espelho`.
 * Também indica se o usuário atual é coordenador do projeto.
 */
export function useProcessoDoProjeto(projetoId: string | null | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["processo-do-projeto", projetoId, user?.id],
    enabled: !!projetoId,
    staleTime: 60_000,
    queryFn: async (): Promise<ProcessoVinculado | null> => {
      // 1) rotina fixa que espelha este projeto
      const { data: rotinas } = await (supabase as any)
        .from("suporte_rotinas_fixas")
        .select("id")
        .eq("projeto_id_espelho", projetoId!)
        .limit(1);
      const rotinaIds = (rotinas ?? []).map((r: any) => r.id);
      if (rotinaIds.length === 0) return null;

      // 2) etapa → processo
      const { data: etapas } = await (supabase as any)
        .from("processo_etapas")
        .select("processo_id")
        .in("rotina_fixa_id", rotinaIds)
        .limit(1);
      const processoId = (etapas ?? [])[0]?.processo_id;
      if (!processoId) return null;

      // 3) processo + coordenador
      const [{ data: proc }, { data: membro }] = await Promise.all([
        (supabase as any)
          .from("processos_operacionais")
          .select("id, nome, cor")
          .eq("id", processoId)
          .maybeSingle(),
        user
          ? (supabase as any)
              .from("projeto_membros")
              .select("papel")
              .eq("projeto_id", projetoId!)
              .eq("user_id", user.id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      if (!proc) return null;
      return {
        processo_id: proc.id,
        nome: proc.nome,
        cor: proc.cor ?? null,
        is_coordenador: (membro as any)?.papel === "coordenador",
      };
    },
  });
}
