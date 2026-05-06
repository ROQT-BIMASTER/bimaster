import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PatioOPItem {
  ordem_producao_id: string;
  op_numero: string;
  produto_id: string | null;
  produto_codigo: string | null;
  produto_nome: string | null;
  op_status: string | null;
  quantidade_planejada: number;
  quantidade_produzida: number;
  qty_alocada: number;
  qty_disponivel: number;
  lote: string | null;
  data_fim: string | null;
  dias_parado: number;
  ordem_compra_id: string | null;
}

export function usePatioProntoEmbarque() {
  return useQuery({
    queryKey: ["patio-pronto-embarque"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_op_pronto_embarque" as any)
        .select("*")
        .order("dias_parado", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as unknown as PatioOPItem[];
    },
    staleTime: 30_000,
  });
}

export interface ContainerAberto {
  id: string;
  numero_embarque: number | null;
  numero_container: string | null;
  navio: string | null;
  status: string;
  tipo_embarque: string | null;
}

export function useContainersAbertos() {
  return useQuery({
    queryKey: ["containers-abertos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("china_embarques" as any)
        .select("id, numero_embarque, numero_container, navio, status, tipo_embarque")
        .in("status", ["rascunho", "coletando", "preparando"])
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as unknown as ContainerAberto[];
    },
    staleTime: 30_000,
  });
}

export function useAlocarOPEmContainer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      embarque_id: string;
      op_id: string;
      qty: number;
      lote?: string;
      observacao?: string;
    }) => {
      const { data, error } = await supabase.rpc("rpc_alocar_op_em_container" as any, {
        p_embarque_id: params.embarque_id,
        p_op_id: params.op_id,
        p_qty: params.qty,
        p_lote: params.lote ?? null,
        p_observacao: params.observacao ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patio-pronto-embarque"] });
      qc.invalidateQueries({ queryKey: ["containers-abertos"] });
      qc.invalidateQueries({ queryKey: ["containers-consolidado"] });
      qc.invalidateQueries({ queryKey: ["containers-da-op"] });
    },
  });
}

export interface ContainerPayload {
  numero_container?: string;
  numero_bl?: string;
  booking_number?: string;
  navio?: string;
  porto_origem?: string;
  porto_destino?: string;
  data_embarque?: string;
  data_eta?: string;
  modalidade?: string;
  tipo_embarque?: string;
  observacoes?: string;
  ordem_compra_id?: string;
}

export interface ContainerItemInput {
  ordem_producao_id: string;
  qty: number;
  lote?: string;
  observacao?: string;
}

export function useCriarContainerConsolidado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { payload: ContainerPayload; itens: ContainerItemInput[] }) => {
      const { data, error } = await supabase.rpc("rpc_criar_container_consolidado" as any, {
        p_payload: params.payload as any,
        p_itens: params.itens as any,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patio-pronto-embarque"] });
      qc.invalidateQueries({ queryKey: ["containers-abertos"] });
      qc.invalidateQueries({ queryKey: ["containers-consolidado"] });
    },
  });
}

export function useFecharContainer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (embarque_id: string) => {
      const { error } = await supabase.rpc("rpc_fechar_container" as any, {
        p_embarque_id: embarque_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["containers-abertos"] });
      qc.invalidateQueries({ queryKey: ["containers-consolidado"] });
    },
  });
}

export interface ContainerConsolidado {
  embarque_id: string;
  numero_embarque: number | null;
  numero_container: string | null;
  numero_bl: string | null;
  booking_number: string | null;
  navio: string | null;
  porto_origem: string | null;
  porto_destino: string | null;
  data_embarque: string | null;
  data_eta: string | null;
  status: string;
  tipo_embarque: string | null;
  total_pecas: number;
  qtd_ops: number;
  qtd_ocs: number;
  shipsgo_status: string | null;
  shipsgo_eta_atual: string | null;
  shipsgo_dias_atraso: number | null;
  shipsgo_last_event_at: string | null;
}

export function useContainersConsolidado() {
  return useQuery({
    queryKey: ["containers-consolidado"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_container_consolidado" as any)
        .select("*")
        .order("data_embarque", { ascending: false, nullsFirst: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as unknown as ContainerConsolidado[];
    },
    staleTime: 30_000,
  });
}

export function useContainersDaOP(opId: string | undefined) {
  return useQuery({
    queryKey: ["containers-da-op", opId],
    enabled: !!opId,
    queryFn: async () => {
      const { data: itens, error } = await supabase
        .from("china_embarque_itens" as any)
        .select("embarque_id, qty_embarcada, lote")
        .eq("ordem_producao_id", opId);
      if (error) throw error;
      const ids = Array.from(new Set((itens || []).map((i: any) => i.embarque_id)));
      if (ids.length === 0) return [];
      const { data: embarques, error: e2 } = await supabase
        .from("vw_container_consolidado" as any)
        .select("*")
        .in("embarque_id", ids);
      if (e2) throw e2;
      return (embarques || []).map((e: any) => ({
        ...e,
        qty_nesta_op: (itens || [])
          .filter((i: any) => i.embarque_id === e.embarque_id)
          .reduce((s: number, i: any) => s + Number(i.qty_embarcada || 0), 0),
      })) as Array<ContainerConsolidado & { qty_nesta_op: number }>;
    },
  });
}
