import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProjetoOPSugestao {
  projeto_id: string;
  projeto_nome: string;
  ops: Array<{
    id: string;
    numero: string;
    status: string;
    quantidade_planejada: number | null;
  }>;
}

/**
 * Busca projetos vinculados a uma submissão China + OPs em aberto.
 * Otimizado: 2 round-trips (links → join paralelo de projetos+produtos+OPs)
 * em vez do N+1 anterior.
 */
export function useSubmissaoProjetosOPs(submissaoId: string | undefined) {
  return useQuery({
    queryKey: ["submissao-projetos-ops", submissaoId],
    enabled: !!submissaoId,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    queryFn: async (): Promise<ProjetoOPSugestao[]> => {
      // 1) Links submissão → projetos
      const { data: links } = await supabase
        .from("china_submissao_projetos" as any)
        .select("projeto_id")
        .eq("submissao_id", submissaoId!);

      const projetoIds = Array.from(
        new Set(((links || []) as any[]).map((l) => l.projeto_id).filter(Boolean)),
      );
      if (!projetoIds.length) return [];

      // 2) Projetos + vínculos produto em paralelo
      const [{ data: projetos }, { data: prodLinks }] = await Promise.all([
        supabase.from("projetos" as any).select("id, nome").in("id", projetoIds),
        supabase
          .from("projeto_produto_vinculos" as any)
          .select("projeto_id, produto_id")
          .in("projeto_id", projetoIds),
      ]);

      const produtoIds = Array.from(
        new Set(((prodLinks || []) as any[]).map((p) => p.produto_id).filter(Boolean)),
      );
      if (!produtoIds.length) {
        // Sem produtos vinculados: retorna projetos sem OPs (caller pode mostrar fallback)
        return ((projetos || []) as any[]).map((p) => ({
          projeto_id: p.id,
          projeto_nome: p.nome || "Projeto",
          ops: [],
        }));
      }

      // 3) OPs em aberto de todos os produtos em uma só query
      const { data: ops } = await supabase
        .from("fabrica_ordens_producao" as any)
        .select("id, numero, status, quantidade_planejada, produto_id")
        .in("produto_id", produtoIds)
        .in("status", ["pendente", "em_andamento", "planejada"])
        .order("created_at", { ascending: false });

      const opsByProduto = new Map<string, any[]>();
      ((ops || []) as any[]).forEach((op) => {
        if (!opsByProduto.has(op.produto_id)) opsByProduto.set(op.produto_id, []);
        opsByProduto.get(op.produto_id)!.push(op);
      });

      const projNomes = new Map<string, string>(
        ((projetos || []) as any[]).map((p) => [p.id, p.nome]),
      );
      const opsByProjeto = new Map<string, any[]>();
      ((prodLinks || []) as any[]).forEach((pl) => {
        const arr = opsByProjeto.get(pl.projeto_id) || [];
        (opsByProduto.get(pl.produto_id) || []).forEach((op) => {
          if (!arr.some((x) => x.id === op.id)) arr.push(op);
        });
        opsByProjeto.set(pl.projeto_id, arr);
      });

      return projetoIds.map((pid) => ({
        projeto_id: pid,
        projeto_nome: projNomes.get(pid) || "Projeto",
        ops: (opsByProjeto.get(pid) || []).map((op) => ({
          id: op.id,
          numero: op.numero,
          status: op.status,
          quantidade_planejada: op.quantidade_planejada,
        })),
      }));
    },
  });
}
