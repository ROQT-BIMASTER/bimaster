import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface TradeMaterial {
  id: string;
  nome: string;
  descricao: string | null;
  categoria: string;
  foto_url: string | null;
  fotos_extras: string[];
  estoque_total: number;
  estoque_minimo: number;
  estoque_atual: number;
  max_por_solicitacao: number | null;
  max_por_loja_mes: number | null;
  prazo_entrega: string | null;
  politica_uso: string | null;
  exibir_estoque: boolean;
  permitir_sem_estoque: boolean;
  requer_aprovacao: boolean;
  ativo: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type MaterialSolicitacaoStatus = 'pendente' | 'aprovado' | 'em_separacao' | 'enviado' | 'entregue' | 'recusado';

export interface TradeMaterialSolicitacao {
  id: string;
  material_id: string;
  user_id: string;
  loja_id: string | null;
  loja_nome: string | null;
  quantidade: number;
  observacoes: string | null;
  status: MaterialSolicitacaoStatus;
  motivo_recusa: string | null;
  codigo_rastreio: string | null;
  obs_interna: string | null;
  aprovado_por: string | null;
  created_at: string;
  updated_at: string;
  trade_materiais?: TradeMaterial;
}

// ── Materiais ──

export function useTradeMateriais() {
  return useQuery({
    queryKey: ["trade-materiais"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_materiais" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as TradeMaterial[];
    },
  });
}

export function useActiveTradeMateriais() {
  return useQuery({
    queryKey: ["trade-materiais-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_materiais" as any)
        .select("*")
        .eq("ativo", true)
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as TradeMaterial[];
    },
  });
}

export function useCreateMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (material: Partial<TradeMaterial>) => {
      const { data, error } = await supabase
        .from("trade_materiais" as any)
        .insert(material as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as TradeMaterial;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trade-materiais"] });
      toast.success("Material criado com sucesso!");
    },
    onError: (e: Error) => toast.error("Erro ao criar material: " + e.message),
  });
}

export function useUpdateMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TradeMaterial> & { id: string }) => {
      const { data, error } = await supabase
        .from("trade_materiais" as any)
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as TradeMaterial;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trade-materiais"] });
      toast.success("Material atualizado!");
    },
    onError: (e: Error) => toast.error("Erro ao atualizar: " + e.message),
  });
}

export function useDeleteMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("trade_materiais" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trade-materiais"] });
      toast.success("Material excluído!");
    },
    onError: (e: Error) => toast.error("Erro ao excluir: " + e.message),
  });
}

// ── Solicitações ──

export function useMaterialSolicitacoes(filters?: { status?: string; materialId?: string }) {
  return useQuery({
    queryKey: ["trade-material-solicitacoes", filters],
    queryFn: async () => {
      let query = supabase
        .from("trade_material_solicitacoes" as any)
        .select("*, trade_materiais(*)")
        .order("created_at", { ascending: false });
      if (filters?.status) query = query.eq("status", filters.status);
      if (filters?.materialId) query = query.eq("material_id", filters.materialId);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as TradeMaterialSolicitacao[];
    },
  });
}

export function useCreateSolicitacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sol: Partial<TradeMaterialSolicitacao>) => {
      const { data, error } = await supabase
        .from("trade_material_solicitacoes" as any)
        .insert(sol as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as TradeMaterialSolicitacao;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trade-material-solicitacoes"] });
      toast.success("Solicitação enviada!");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });
}

export function useUpdateSolicitacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TradeMaterialSolicitacao> & { id: string }) => {
      const { data, error } = await supabase
        .from("trade_material_solicitacoes" as any)
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as TradeMaterialSolicitacao;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trade-material-solicitacoes"] });
      toast.success("Solicitação atualizada!");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });
}
