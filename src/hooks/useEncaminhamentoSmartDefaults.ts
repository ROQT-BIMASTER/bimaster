import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SmartDefaults {
  /** Projeto recomendado (vínculo prévio em produtos_brasil ou tarefa). */
  projeto: { id: string; nome: string; cor?: string | null } | null;
  /**
   * Tarefa(s) recomendadas, ordenadas por score:
   *   +3 já vinculada à submissão  | +2 mesma marca/categoria
   *   +1 estágio compatível ("China"/"Vincular"/"Recebimento")
   *   +1 responsável é o usuário atual
   */
  tarefas: Array<{
    id: string;
    titulo: string;
    secao_id: string | null;
    score: number;
    motivos: string[];
  }>;
  /** Processo já existente para essa submissão, se houver. */
  processId: string | null;
}

/**
 * Calcula recomendações de projeto/tarefa para encaminhar uma submissão China.
 * Combina:
 *  - vínculos existentes (china_submissao_tarefa_vinculos / produtos_brasil)
 *  - histórico recente em process_events do mesmo produto
 *  - heurísticas de título/estágio da tarefa
 */
export function useEncaminhamentoSmartDefaults(submissaoId: string | null) {
  return useQuery({
    queryKey: ["china-encaminhamento-defaults", submissaoId],
    enabled: !!submissaoId,
    staleTime: 30_000,
    queryFn: async (): Promise<SmartDefaults> => {
      const empty: SmartDefaults = { projeto: null, tarefas: [], processId: null };
      if (!submissaoId) return empty;

      const { data: { user } } = await supabase.auth.getUser();
      const uid = user?.id ?? null;

      // 1) Vínculos prévios desta submissão (origem mais forte)
      const { data: linkedRows } = await (supabase
        .from("china_submissao_tarefa_vinculos" as any)
        .select("tarefa_id, secao_id, projeto_id, projeto:projetos(id, nome, cor)")
        .eq("submissao_id", submissaoId) as any);
      const linkedTarefaIds = new Set<string>(((linkedRows ?? []) as any[]).map(r => r.tarefa_id));

      let projeto: SmartDefaults["projeto"] = null;
      if (linkedRows && linkedRows.length > 0) {
        const r = linkedRows[0];
        projeto = r.projeto ? { id: r.projeto.id, nome: r.projeto.nome, cor: r.projeto.cor } : null;
      }

      // 2) Vínculo "leve" via produtos_brasil
      if (!projeto) {
        const { data: pb } = await (supabase
          .from("produtos_brasil" as any)
          .select("projeto:projetos(id, nome, cor)")
          .eq("submissao_china_id", submissaoId)
          .maybeSingle() as any);
        if (pb?.projeto) projeto = { id: pb.projeto.id, nome: pb.projeto.nome, cor: pb.projeto.cor };
      }

      // 3) Inferência por marca/código (último encaminhamento do mesmo código)
      let marcaProjetoId: string | null = null;
      if (!projeto) {
        const { data: sub } = await supabase
          .from("china_produto_submissoes" as any)
          .select("produto_codigo")
          .eq("id", submissaoId)
          .maybeSingle() as any;
        const codigo: string | null = sub?.produto_codigo ?? null;
        if (codigo) {
          const { data: prev } = await (supabase
            .from("produtos_brasil" as any)
            .select("projeto:projetos(id, nome, cor)")
            .eq("china_codigo", codigo)
            .order("created_at", { ascending: false })
            .limit(1) as any);
          if (prev && prev[0]?.projeto) {
            projeto = { id: prev[0].projeto.id, nome: prev[0].projeto.nome, cor: prev[0].projeto.cor };
            marcaProjetoId = projeto.id;
          }
        }
      }

      // 4) Process existente para esta submissão
      const { data: proc } = await (supabase
        .from("product_process" as any)
        .select("id")
        .eq("produto_tipo", "china")
        .eq("produto_ref_id", submissaoId)
        .maybeSingle() as any);
      const processId: string | null = proc?.id ?? null;

      if (!projeto) return { ...empty, processId };

      // 5) Tarefas do projeto + scoring
      const { data: tarefas } = await supabase
        .from("projeto_tarefas")
        .select("id, titulo, secao_id, estagio, responsavel_id")
        .eq("projeto_id", projeto.id)
        .is("excluida_em" as any, null)
        .is("parent_tarefa_id", null);

      const HINT_RE = /china|vincul|recebi|importa|china[-\s]?br|qa/i;
      const scored = ((tarefas ?? []) as any[])
        .map((t) => {
          let score = 0;
          const motivos: string[] = [];
          if (linkedTarefaIds.has(t.id)) { score += 3; motivos.push("já vinculada"); }
          if (marcaProjetoId === projeto!.id) { score += 1; motivos.push("mesmo produto/projeto"); }
          if (t.estagio && HINT_RE.test(String(t.estagio))) { score += 1; motivos.push(`estágio "${t.estagio}"`); }
          if (t.titulo && HINT_RE.test(String(t.titulo))) { score += 1; motivos.push("título compatível"); }
          if (uid && t.responsavel_id === uid) { score += 1; motivos.push("você é o responsável"); }
          return {
            id: t.id as string,
            titulo: t.titulo as string,
            secao_id: (t.secao_id as string | null) ?? null,
            score,
            motivos,
          };
        })
        .filter((t) => t.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      return { projeto, tarefas: scored, processId };
    },
  });
}
