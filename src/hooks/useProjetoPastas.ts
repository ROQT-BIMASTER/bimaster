/**
 * Organização de projetos em pastas (workspaces).
 *
 * Camada puramente organizacional: não altera visibilidade nem dados de
 * projetos. Existem dois escopos:
 *  - `compartilhada`: visível para toda a organização, gerida por admin /
 *    gerente geral de Projetos.
 *  - `pessoal`: visível e gerida apenas pelo próprio usuário.
 *
 * Um projeto pode estar em no máximo uma pasta compartilhada e em no máximo
 * uma pasta pessoal por usuário.
 */
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useIsGerenteGeralProjetos } from "@/hooks/useIsGerenteGeralProjetos";

export type PastaEscopo = "compartilhada" | "pessoal";

export interface ProjetoPasta {
  id: string;
  nome: string;
  cor: string;
  icone: string;
  ordem: number;
  escopo: PastaEscopo;
  owner_id: string | null;
  created_by: string;
  created_at: string;
}

export interface ProjetoPastaItem {
  id: string;
  pasta_id: string;
  projeto_id: string;
  user_id: string | null;
}

export const PASTA_CORES = [
  "#6366F1",
  "#0EA5E9",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#EC4899",
  "#8B5CF6",
  "#64748B",
];

export function useProjetoPastas() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const { isGerenteGeral } = useIsGerenteGeralProjetos();
  const podeGerirCompartilhadas = Boolean(isAdmin || isGerenteGeral);

  const pastasQuery = useQuery({
    queryKey: ["projeto-pastas"],
    queryFn: async (): Promise<ProjetoPasta[]> => {
      const { data, error } = await supabase
        .from("projeto_pastas")
        .select("id, nome, cor, icone, ordem, escopo, owner_id, created_by, created_at")
        .order("escopo", { ascending: true })
        .order("ordem", { ascending: true })
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data || []) as ProjetoPasta[];
    },
  });

  const itensQuery = useQuery({
    queryKey: ["projeto-pasta-itens"],
    queryFn: async (): Promise<ProjetoPastaItem[]> => {
      const { data, error } = await supabase
        .from("projeto_pasta_itens")
        .select("id, pasta_id, projeto_id, user_id");
      if (error) throw error;
      return (data || []) as ProjetoPastaItem[];
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["projeto-pastas"] });
    queryClient.invalidateQueries({ queryKey: ["projeto-pasta-itens"] });
  };

  const pastas = pastasQuery.data ?? [];
  const itens = itensQuery.data ?? [];

  /** projeto_id -> pasta_id efetiva (pessoal tem prioridade sobre compartilhada). */
  const pastaPorProjeto = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of itens) {
      if (item.user_id === null && !map.has(item.projeto_id)) {
        map.set(item.projeto_id, item.pasta_id);
      }
    }
    for (const item of itens) {
      if (item.user_id && item.user_id === user?.id) {
        map.set(item.projeto_id, item.pasta_id);
      }
    }
    return map;
  }, [itens, user?.id]);

  const criarPasta = useMutation({
    mutationFn: async (input: { nome: string; cor?: string; escopo: PastaEscopo }) => {
      if (!user?.id) throw new Error("Sessão expirada.");
      if (input.escopo === "compartilhada" && !podeGerirCompartilhadas) {
        throw new Error("Sem permissão para criar pastas compartilhadas.");
      }
      const { error } = await supabase.from("projeto_pastas").insert({
        nome: input.nome.trim(),
        cor: input.cor || PASTA_CORES[0],
        escopo: input.escopo,
        owner_id: input.escopo === "pessoal" ? user.id : null,
        created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Pasta criada.");
    },
    onError: (e: Error) => toast.error(e.message || "Não foi possível criar a pasta."),
  });

  const atualizarPasta = useMutation({
    mutationFn: async (input: { id: string; nome?: string; cor?: string; ordem?: number }) => {
      const patch: { nome?: string; cor?: string; ordem?: number } = {};
      if (input.nome !== undefined) patch.nome = input.nome.trim();
      if (input.cor !== undefined) patch.cor = input.cor;
      if (input.ordem !== undefined) patch.ordem = input.ordem;
      const { error } = await supabase.from("projeto_pastas").update(patch).eq("id", input.id);

      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Pasta atualizada.");
    },
    onError: (e: Error) => toast.error(e.message || "Não foi possível atualizar a pasta."),
  });

  const excluirPasta = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projeto_pastas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Pasta excluída. Os projetos permanecem inalterados.");
    },
    onError: (e: Error) => toast.error(e.message || "Não foi possível excluir a pasta."),
  });

  /**
   * Move um projeto para uma pasta. `pastaId = null` remove o vínculo.
   * O escopo do vínculo acompanha o escopo da pasta de destino.
   */
  const moverProjeto = useMutation({
    mutationFn: async (input: { projetoId: string; pastaId: string | null }) => {
      if (!user?.id) throw new Error("Sessão expirada.");
      const destino = input.pastaId ? pastas.find((p) => p.id === input.pastaId) : null;
      if (input.pastaId && !destino) throw new Error("Pasta não encontrada.");

      const vinculosDoProjeto = itens.filter(
        (i) => i.projeto_id === input.projetoId && (i.user_id === null || i.user_id === user.id),
      );

      // Remove vínculos que o usuário pode remover (pessoais sempre;
      // compartilhados apenas se tiver alçada).
      const removiveis = vinculosDoProjeto.filter(
        (i) => i.user_id === user.id || podeGerirCompartilhadas,
      );
      if (removiveis.length > 0) {
        const { error } = await supabase
          .from("projeto_pasta_itens")
          .delete()
          .in(
            "id",
            removiveis.map((i) => i.id),
          );
        if (error) throw error;
      }

      if (!destino) return;

      if (destino.escopo === "compartilhada" && !podeGerirCompartilhadas) {
        throw new Error("Sem permissão para organizar pastas compartilhadas.");
      }

      const { error } = await supabase.from("projeto_pasta_itens").insert({
        pasta_id: destino.id,
        projeto_id: input.projetoId,
        user_id: destino.escopo === "pessoal" ? user.id : null,
        created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Projeto reorganizado.");
    },
    onError: (e: Error) => toast.error(e.message || "Não foi possível mover o projeto."),
  });

  return {
    pastas,
    itens,
    pastaPorProjeto,
    isLoading: pastasQuery.isLoading || itensQuery.isLoading,
    podeGerirCompartilhadas,
    criarPasta,
    atualizarPasta,
    excluirPasta,
    moverProjeto,
  };
}
