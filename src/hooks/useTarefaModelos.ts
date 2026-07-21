import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  aplicarTarefaModelo,
  capturarTarefaComoModelo,
  type TarefaModeloPayload,
} from "@/lib/tarefas/duplicarTarefa";

export type TarefaModeloEscopo = "pessoal" | "departamento" | "organizacao";

export interface TarefaModelo {
  id: string;
  nome: string;
  descricao_curta: string | null;
  escopo: TarefaModeloEscopo;
  departamento_id: string | null;
  created_by: string;
  payload: TarefaModeloPayload;
  uso_count: number;
  ultimo_uso_em: string | null;
  created_at: string;
  updated_at: string;
}

const QK = ["tarefa-modelos"] as const;

/**
 * Lista modelos visíveis para o usuário. Se a migration ainda não foi aplicada
 * (ambiente antigo), devolve lista vazia silenciosamente — sem lançar erro 400
 * visível para o usuário.
 */
export function useTarefaModelos() {
  return useQuery({
    queryKey: QK,
    staleTime: 30_000,
    queryFn: async (): Promise<TarefaModelo[]> => {
      const { data, error } = await (supabase.from as any)("tarefa_modelos")
        .select("*")
        .order("uso_count", { ascending: false })
        .order("updated_at", { ascending: false });
      if (error) {
        // Fallback silencioso: tabela pode ainda não existir em ambientes stale.
        if (/does not exist|schema cache|relation/i.test(error.message)) return [];
        throw error;
      }
      return (data || []) as TarefaModelo[];
    },
  });
}

export function useSalvarTarefaComoModelo() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      tarefaId: string;
      nome: string;
      descricao_curta?: string | null;
      escopo: TarefaModeloEscopo;
      departamento_id?: string | null;
    }) => {
      if (!user?.id) throw new Error("Sessão expirada");
      const payload = await capturarTarefaComoModelo(input.tarefaId);
      const { data, error } = await (supabase.from as any)("tarefa_modelos")
        .insert({
          nome: input.nome.trim(),
          descricao_curta: input.descricao_curta?.trim() || null,
          escopo: input.escopo,
          departamento_id: input.escopo === "departamento" ? input.departamento_id : null,
          created_by: user.id,
          payload,
        })
        .select("*")
        .single();
      if (error) throw error;
      return data as TarefaModelo;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK });
      toast.success("Modelo salvo");
    },
    onError: (err: Error) => toast.error(err.message || "Falha ao salvar modelo"),
  });
}

export function useAplicarTarefaModelo() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      modeloId: string;
      projetoId: string;
      secaoId: string;
      parentTarefaId?: string | null;
    }) => {
      if (!user?.id) throw new Error("Sessão expirada");
      const { data: modelo, error } = await (supabase.from as any)("tarefa_modelos")
        .select("payload")
        .eq("id", input.modeloId)
        .single();
      if (error || !modelo) throw error || new Error("Modelo não encontrado");

      const newId = await aplicarTarefaModelo({
        payload: modelo.payload as TarefaModeloPayload,
        projetoId: input.projetoId,
        secaoId: input.secaoId,
        criadorId: user.id,
        parentTarefaId: input.parentTarefaId ?? null,
      });

      // Contador de uso (best-effort — não bloqueia sucesso).
      try {
        const { data: cur } = await (supabase.from as any)("tarefa_modelos")
          .select("uso_count")
          .eq("id", input.modeloId)
          .single();
        const next = ((cur?.uso_count as number) ?? 0) + 1;
        await (supabase.from as any)("tarefa_modelos")
          .update({ uso_count: next, ultimo_uso_em: new Date().toISOString() })
          .eq("id", input.modeloId);
      } catch {
        /* ignore */
      }

      return newId;
    },
    onSuccess: (_id, vars) => {
      qc.invalidateQueries({ queryKey: ["projeto-tarefas-v2", vars.projetoId] });
      qc.invalidateQueries({ queryKey: QK });
      toast.success("Modelo aplicado");
    },
    onError: (err: Error) => toast.error(err.message || "Falha ao aplicar modelo"),
  });
}

export function useEditarTarefaModelo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      nome?: string;
      descricao_curta?: string | null;
      escopo?: TarefaModeloEscopo;
      departamento_id?: string | null;
    }) => {
      const patch: Record<string, any> = {};
      if (typeof input.nome === "string") patch.nome = input.nome.trim();
      if ("descricao_curta" in input) patch.descricao_curta = input.descricao_curta?.trim() || null;
      if (input.escopo) patch.escopo = input.escopo;
      if ("departamento_id" in input) patch.departamento_id = input.departamento_id ?? null;
      const { error } = await (supabase.from as any)("tarefa_modelos")
        .update(patch)
        .eq("id", input.id);
      if (error) throw error;
      return input.id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK });
      toast.success("Modelo atualizado");
    },
    onError: (err: Error) => toast.error(err.message || "Falha ao atualizar modelo"),
  });
}

export function useExcluirTarefaModelo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from as any)("tarefa_modelos").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK });
      toast.success("Modelo excluído");
    },
    onError: (err: Error) => toast.error(err.message || "Falha ao excluir modelo"),
  });
}
