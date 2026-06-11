import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EstoqueEtiqueta {
  id: string;
  nome: string;
  cor_hex: string;
  descricao: string | null;
  vigencia_inicio: string | null;
  vigencia_fim: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface EtiquetaProdutoVinculo {
  id: string;
  etiqueta_id: string;
  cod_produto: number;
  created_at: string;
}

export function useEstoqueEtiquetas(somenteAtivas = false) {
  return useQuery({
    queryKey: ['estoque-etiquetas', { somenteAtivas }],
    staleTime: 60_000,
    queryFn: async () => {
      let q = (supabase as any).from('estoque_etiquetas').select('*').order('nome');
      if (somenteAtivas) q = q.eq('ativo', true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as EstoqueEtiqueta[];
    },
  });
}

export function useEtiquetasDoProduto(codProduto: number | null | undefined) {
  return useQuery({
    queryKey: ['estoque-etiqueta-produto', codProduto],
    enabled: codProduto != null,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('estoque_etiqueta_produtos')
        .select('id, etiqueta_id, cod_produto, created_at')
        .eq('cod_produto', codProduto!);
      if (error) throw error;
      return (data ?? []) as EtiquetaProdutoVinculo[];
    },
  });
}

export function useEtiquetaProdutosBatch(codProdutos: number[]) {
  return useQuery({
    queryKey: ['estoque-etiqueta-produto-batch', codProdutos.sort()],
    enabled: codProdutos.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('estoque_etiqueta_produtos')
        .select('etiqueta_id, cod_produto')
        .in('cod_produto', codProdutos);
      if (error) throw error;
      const map = new Map<number, string[]>();
      for (const r of (data ?? []) as { etiqueta_id: string; cod_produto: number }[]) {
        const arr = map.get(r.cod_produto) ?? [];
        arr.push(r.etiqueta_id);
        map.set(r.cod_produto, arr);
      }
      return map;
    },
  });
}

export function useCreateEtiqueta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<EstoqueEtiqueta> & { nome: string }) => {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await (supabase as any)
        .from('estoque_etiquetas')
        .insert({ ...input, created_by: u.user?.id })
        .select()
        .single();
      if (error) throw error;
      return data as EstoqueEtiqueta;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['estoque-etiquetas'] }),
  });
}

export function useUpdateEtiqueta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<EstoqueEtiqueta> & { id: string }) => {
      const { error } = await (supabase as any).from('estoque_etiquetas').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['estoque-etiquetas'] }),
  });
}

export function useDeleteEtiqueta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('estoque_etiquetas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['estoque-etiquetas'] }),
  });
}

export function useToggleEtiquetaProduto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ etiquetaId, codProduto, marcar }: { etiquetaId: string; codProduto: number; marcar: boolean }) => {
      if (marcar) {
        const { data: u } = await supabase.auth.getUser();
        const { error } = await (supabase as any)
          .from('estoque_etiqueta_produtos')
          .insert({ etiqueta_id: etiquetaId, cod_produto: codProduto, created_by: u.user?.id });
        if (error && !error.message?.includes('duplicate')) throw error;
      } else {
        const { error } = await (supabase as any)
          .from('estoque_etiqueta_produtos')
          .delete()
          .eq('etiqueta_id', etiquetaId)
          .eq('cod_produto', codProduto);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['estoque-etiqueta-produto'] });
      qc.invalidateQueries({ queryKey: ['estoque-etiqueta-produto-batch'] });
      qc.invalidateQueries({ queryKey: ['estoque-cores'] });
    },
  });
}
