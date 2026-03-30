import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export type OmsStatus = 
  | 'recebido' | 'credito_pendente' | 'credito_aprovado' 
  | 'enviado_wms' | 'separando' | 'faturado' 
  | 'expedido' | 'entregue' | 'rejeitado' | 'cancelado';

export interface OmsPedido {
  id: string;
  numero: number;
  cliente_codigo: string;
  cliente_nome: string | null;
  vendedor_cod: number | null;
  vendedor_nome: string | null;
  empresa_id: number | null;
  status: OmsStatus;
  canal_origem: string;
  valor_total: number;
  desconto_total: number;
  observacao: string | null;
  motivo_rejeicao: string | null;
  condicao_pagamento_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface OmsPedidoItem {
  id: string;
  pedido_id: string;
  produto_codigo: string;
  produto_nome: string | null;
  quantidade: number;
  preco_unitario: number;
  desconto_percentual: number;
  valor_total: number;
  estoque_reservado: boolean;
}

export interface OmsStatusLog {
  id: string;
  pedido_id: string;
  status_anterior: string | null;
  status_novo: string;
  usuario_id: string | null;
  usuario_nome: string | null;
  observacao: string | null;
  created_at: string;
}

export interface OmsCondicaoPagamento {
  id: string;
  codigo: string;
  descricao: string;
  parcelas: number;
  dias_entre_parcelas: number;
  dias_primeira_parcela: number;
  ativo: boolean;
}

export const OMS_STATUS_CONFIG: Record<OmsStatus, { label: string; color: string; bgClass: string }> = {
  recebido: { label: 'Recebido', color: 'text-primary', bgClass: 'bg-primary/10 text-primary border-primary/30' },
  credito_pendente: { label: 'Crédito Pendente', color: 'text-warning', bgClass: 'bg-warning/10 text-warning border-warning/30' },
  credito_aprovado: { label: 'Crédito Aprovado', color: 'text-success', bgClass: 'bg-success/10 text-success border-success/30' },
  enviado_wms: { label: 'Enviado WMS', color: 'text-primary', bgClass: 'bg-primary/10 text-primary border-primary/30' },
  separando: { label: 'Separando', color: 'text-warning', bgClass: 'bg-warning/10 text-warning border-warning/30' },
  faturado: { label: 'Faturado', color: 'text-success', bgClass: 'bg-success/10 text-success border-success/30' },
  expedido: { label: 'Expedido', color: 'text-primary', bgClass: 'bg-primary/10 text-primary border-primary/30' },
  entregue: { label: 'Entregue', color: 'text-success', bgClass: 'bg-success/10 text-success border-success/30' },
  rejeitado: { label: 'Rejeitado', color: 'text-destructive', bgClass: 'bg-destructive/10 text-destructive border-destructive/30' },
  cancelado: { label: 'Cancelado', color: 'text-muted-foreground', bgClass: 'bg-muted text-muted-foreground border-border' },
};

interface UseOmsPedidosOptions {
  status?: OmsStatus | null;
  search?: string;
  page?: number;
  pageSize?: number;
}

export function useOmsPedidos(options: UseOmsPedidosOptions = {}) {
  const { status, search, page = 0, pageSize = 50 } = options;

  return useQuery({
    queryKey: ['oms-pedidos', status, search, page, pageSize],
    queryFn: async () => {
      let query = supabase
        .from('oms_pedidos')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (status) query = query.eq('status', status);
      if (search) {
        query = query.or(`cliente_nome.ilike.%${search}%,numero.eq.${parseInt(search) || 0},cliente_codigo.ilike.%${search}%`);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: data as unknown as OmsPedido[], count: count ?? 0 };
    },
    staleTime: 30_000,
  });
}

export function useOmsPedidoDetalhe(pedidoId: string | undefined) {
  return useQuery({
    queryKey: ['oms-pedido', pedidoId],
    queryFn: async () => {
      if (!pedidoId) throw new Error('ID não informado');
      
      const [pedidoRes, itensRes, logRes] = await Promise.all([
        supabase.from('oms_pedidos').select('*').eq('id', pedidoId).single(),
        supabase.from('oms_pedido_itens').select('*').eq('pedido_id', pedidoId).order('created_at'),
        supabase.from('oms_pedido_status_log').select('*').eq('pedido_id', pedidoId).order('created_at', { ascending: false }),
      ]);

      if (pedidoRes.error) throw pedidoRes.error;

      return {
        pedido: pedidoRes.data as unknown as OmsPedido,
        itens: (itensRes.data ?? []) as unknown as OmsPedidoItem[],
        statusLog: (logRes.data ?? []) as unknown as OmsStatusLog[],
      };
    },
    enabled: !!pedidoId,
  });
}

export function useOmsUpdateStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ pedidoId, novoStatus, observacao }: { pedidoId: string; novoStatus: OmsStatus; observacao?: string }) => {
      const { error } = await supabase
        .from('oms_pedidos')
        .update({ status: novoStatus } as any)
        .eq('id', pedidoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['oms-pedidos'] });
      queryClient.invalidateQueries({ queryKey: ['oms-pedido'] });
      toast.success('Status atualizado com sucesso');
    },
    onError: (err: any) => {
      toast.error('Erro ao atualizar status: ' + err.message);
    },
  });
}

export function useOmsKpis() {
  return useQuery({
    queryKey: ['oms-kpis'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('oms_pedidos')
        .select('status, valor_total');
      if (error) throw error;

      const pedidos = data as unknown as { status: string; valor_total: number }[];
      const total = pedidos.length;
      const valorTotal = pedidos.reduce((s, p) => s + (p.valor_total || 0), 0);
      const pendentes = pedidos.filter(p => ['recebido', 'credito_pendente'].includes(p.status)).length;
      const faturados = pedidos.filter(p => p.status === 'faturado').length;
      const cancelados = pedidos.filter(p => ['rejeitado', 'cancelado'].includes(p.status)).length;

      return { total, valorTotal, pendentes, faturados, cancelados };
    },
    staleTime: 60_000,
  });
}

export function useOmsCondicoesPagamento() {
  return useQuery({
    queryKey: ['oms-condicoes-pagamento'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('oms_condicoes_pagamento')
        .select('*')
        .order('codigo');
      if (error) throw error;
      return data as unknown as OmsCondicaoPagamento[];
    },
  });
}

export function useOmsCondicaoPagamentoMutations() {
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: async (values: Omit<OmsCondicaoPagamento, 'id'>) => {
      const { error } = await supabase.from('oms_condicoes_pagamento').insert(values as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['oms-condicoes-pagamento'] });
      toast.success('Condição criada com sucesso');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...values }: Partial<OmsCondicaoPagamento> & { id: string }) => {
      const { error } = await supabase.from('oms_condicoes_pagamento').update(values as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['oms-condicoes-pagamento'] });
      toast.success('Condição atualizada');
    },
    onError: (err: any) => toast.error(err.message),
  });

  return { create, update };
}
