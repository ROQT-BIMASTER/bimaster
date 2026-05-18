import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CenarioProduto {
  id: string;
  codigo: string;
  nome: string;
  cenario_label: string | null;
  grupo_cenario_id: string | null;
  modo: string;
  tipo: string | null;
  marca: string | null;
  linha: string | null;
  foto_url: string | null;
  custo_unitario: number | null;
  preco_minimo: number | null;
  preco_maximo: number | null;
  created_at: string;
  created_by: string | null;
  ativo: boolean | null;
}

export interface CenarioGrupoResumo {
  grupo_cenario_id: string;
  total: number;
  primeiro_nome: string;
  cenarios: CenarioProduto[];
  created_at: string;
}

const SELECT_COLS =
  "id, codigo, nome, cenario_label, grupo_cenario_id, modo, tipo, marca, linha, foto_url, custo_unitario, preco_minimo, preco_maximo, created_at, created_by, ativo";

/** Lista todos os grupos de cenários ainda não promovidos (apenas modo='cenario'). */
export function useGruposCenarios() {
  return useQuery({
    queryKey: ["fabrica-cenarios-grupos"],
    queryFn: async (): Promise<CenarioGrupoResumo[]> => {
      const { data, error } = await supabase
        .from("fabrica_produtos")
        .select(SELECT_COLS)
        .eq("modo", "cenario")
        .not("grupo_cenario_id", "is", null)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const grupos = new Map<string, CenarioGrupoResumo>();
      (data as CenarioProduto[] | null)?.forEach((p) => {
        const gid = p.grupo_cenario_id!;
        const g = grupos.get(gid);
        if (!g) {
          grupos.set(gid, {
            grupo_cenario_id: gid,
            total: 1,
            primeiro_nome: p.nome,
            cenarios: [p],
            created_at: p.created_at,
          });
        } else {
          g.cenarios.push(p);
          g.total += 1;
          if (p.created_at > g.created_at) g.created_at = p.created_at;
        }
      });
      return Array.from(grupos.values());
    },
  });
}

/** Itens de um grupo específico (inclui arquivados se includeArquivados=true). */
export function useGrupoCenario(grupoId: string | null, includeArquivados = false) {
  return useQuery({
    queryKey: ["fabrica-cenarios-grupo", grupoId, includeArquivados],
    enabled: !!grupoId,
    queryFn: async (): Promise<CenarioProduto[]> => {
      const q = supabase
        .from("fabrica_produtos")
        .select(SELECT_COLS)
        .eq("grupo_cenario_id", grupoId!)
        .order("created_at", { ascending: true });
      const { data, error } = includeArquivados
        ? await q
        : await q.in("modo", ["cenario"]);
      if (error) throw error;
      return (data as CenarioProduto[] | null) ?? [];
    },
  });
}

/** Lista grupos arquivados (após promoção de algum vencedor). */
export function useGruposArquivados() {
  return useQuery({
    queryKey: ["fabrica-cenarios-arquivados"],
    queryFn: async (): Promise<CenarioProduto[]> => {
      const { data, error } = await supabase
        .from("fabrica_produtos")
        .select(SELECT_COLS)
        .eq("modo", "arquivado")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as CenarioProduto[] | null) ?? [];
    },
  });
}
