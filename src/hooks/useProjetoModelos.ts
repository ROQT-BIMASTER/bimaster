import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface ModeloSubtarefa {
  titulo: string;
}

export interface ModeloTarefa {
  titulo: string;
  descricao?: string;
  prazo_dias?: number;
  prioridade?: string;
  subtarefas?: ModeloSubtarefa[];
}

export interface ModeloSecao {
  nome: string;
  cor?: string;
  ordem?: number;
  tarefas?: ModeloTarefa[];
}

export interface ModeloEstrutura {
  secoes: ModeloSecao[];
}

export interface ProjetoModelo {
  id: string;
  nome: string;
  descricao: string | null;
  icone: string | null;
  cor: string | null;
  escopo: "pessoal" | "departamento" | "organizacao";
  departamento_id: string | null;
  vinculado_produto: boolean;
  estrutura: ModeloEstrutura;
  criado_por: string;
  uso_count: number;
  created_at: string;
  updated_at: string;
}

export function useProjetoModelos() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const modelos = useQuery({
    queryKey: ["projeto-modelos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_modelos" as any)
        .select("*")
        .order("uso_count", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ProjetoModelo[];
    },
    enabled: !!user,
  });

  const createModelo = useMutation({
    mutationFn: async (input: {
      nome: string;
      descricao?: string;
      icone?: string;
      cor?: string;
      escopo: "pessoal" | "departamento" | "organizacao";
      departamento_id?: string | null;
      vinculado_produto?: boolean;
      estrutura: ModeloEstrutura;
    }) => {
      if (!user) throw new Error("Não autenticado");
      const { data, error } = await supabase
        .from("projeto_modelos" as any)
        .insert({
          ...input,
          criado_por: user.id,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ProjetoModelo;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto-modelos"] });
      toast.success("Modelo de projeto salvo");
    },
    onError: (err: Error) => toast.error("Erro ao salvar modelo: " + err.message),
  });

  const updateModelo = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<ProjetoModelo> & { id: string }) => {
      const { error } = await supabase
        .from("projeto_modelos" as any)
        .update(patch as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto-modelos"] });
      toast.success("Modelo atualizado");
    },
    onError: (err: Error) => toast.error("Erro ao atualizar: " + err.message),
  });

  const deleteModelo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projeto_modelos" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto-modelos"] });
      toast.success("Modelo excluído");
    },
    onError: (err: Error) => toast.error("Erro ao excluir: " + err.message),
  });

  const incrementUso = async (id: string) => {
    // Best-effort: ler valor atual e atualizar
    const { data } = await supabase
      .from("projeto_modelos" as any)
      .select("uso_count")
      .eq("id", id)
      .single();
    const current = (data as any)?.uso_count ?? 0;
    await supabase
      .from("projeto_modelos" as any)
      .update({ uso_count: current + 1 } as any)
      .eq("id", id);
  };

  return { modelos, createModelo, updateModelo, deleteModelo, incrementUso };
}

/**
 * Captura a estrutura de um projeto existente (seções + tarefas + subtarefas)
 * para salvar como modelo. Não copia responsáveis, datas absolutas, anexos, etc.
 */
export async function capturarEstruturaProjeto(
  projetoId: string,
  opts: { incluirSubtarefas?: boolean; incluirPrazos?: boolean } = {},
): Promise<ModeloEstrutura> {
  const incluirSubtarefas = opts.incluirSubtarefas !== false;
  const incluirPrazos = opts.incluirPrazos !== false;

  const { data: secoes, error: errSec } = await supabase
    .from("projeto_secoes")
    .select("id, nome, ordem, data_inicio, data_prazo")
    .eq("projeto_id", projetoId)
    .order("ordem");
  if (errSec) throw errSec;

  const { data: tarefas, error: errTar } = await supabase
    .from("projeto_tarefas")
    .select("id, titulo, descricao, secao_id, parent_tarefa_id, prioridade, data_inicio, data_prazo, ordem")
    .eq("projeto_id", projetoId)
    .is("excluida_em", null)
    .order("ordem");
  if (errTar) throw errTar;

  const tarefasPorSecao = new Map<string, any[]>();
  const subtarefasPorParent = new Map<string, any[]>();
  for (const t of tarefas || []) {
    if (t.parent_tarefa_id) {
      const arr = subtarefasPorParent.get(t.parent_tarefa_id) || [];
      arr.push(t);
      subtarefasPorParent.set(t.parent_tarefa_id, arr);
    } else {
      const arr = tarefasPorSecao.get(t.secao_id) || [];
      arr.push(t);
      tarefasPorSecao.set(t.secao_id, arr);
    }
  }

  const calcDias = (inicio?: string | null, prazo?: string | null): number | undefined => {
    if (!incluirPrazos || !inicio || !prazo) return undefined;
    const a = new Date(inicio);
    const b = new Date(prazo);
    const diff = Math.round((b.getTime() - a.getTime()) / 86400000);
    return diff > 0 ? diff : undefined;
  };

  const estrutura: ModeloEstrutura = {
    secoes: (secoes || []).map((s, idx) => ({
      nome: s.nome,
      ordem: s.ordem ?? idx,
      tarefas: (tarefasPorSecao.get(s.id) || []).map((t) => ({
        titulo: t.titulo,
        descricao: t.descricao || undefined,
        prioridade: t.prioridade || undefined,
        prazo_dias: calcDias(t.data_inicio, t.data_prazo),
        subtarefas: incluirSubtarefas
          ? (subtarefasPorParent.get(t.id) || []).map((st) => ({ titulo: st.titulo }))
          : [],
      })),
    })),
  };

  return estrutura;
}
