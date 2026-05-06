import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface OPVinculada {
  vinculo_id: string;
  qty_alocada: number;
  op_id: string;
  numero: string;
  status: string;
  quantidade_planejada: number;
  quantidade_produzida: number | null;
  data_inicio: string | null;
  data_prevista: string | null;
  data_fim: string | null;
  lote: string | null;
  eficiencia_percentual: number | null;
  produto_id: string | null;
  produto_codigo: string | null;
  produto_nome: string | null;
  apontamentos: Array<{
    id: string;
    timestamp_evento: string;
    quantidade_apontada: number;
    operador_id: string | null;
  }>;
}

export function useFabricaOPDaOC(ocId: string | undefined) {
  return useQuery({
    queryKey: ["fabrica-op-da-oc", ocId],
    enabled: !!ocId,
    queryFn: async (): Promise<OPVinculada[]> => {
      const { data: vinculos, error } = await supabase
        .from("compras_internacional_vinculos" as any)
        .select("id, qty_alocada, fabrica_op_id")
        .eq("china_ordem_compra_id", ocId)
        .not("fabrica_op_id", "is", null);
      if (error) throw error;
      const opIds = (vinculos || []).map((v: any) => v.fabrica_op_id);
      if (opIds.length === 0) return [];

      const { data: ops, error: opErr } = await supabase
        .from("fabrica_ordens_producao" as any)
        .select("id, numero, status, quantidade_planejada, quantidade_produzida, data_inicio, data_prevista, data_fim, lote, eficiencia_percentual, produto_id")
        .in("id", opIds);
      if (opErr) throw opErr;

      const produtoIds = (ops || []).map((o: any) => o.produto_id).filter(Boolean);
      const { data: produtos } = produtoIds.length
        ? await supabase
            .from("fabrica_produtos" as any)
            .select("id, codigo, nome")
            .in("id", produtoIds)
        : { data: [] as any[] };

      const { data: apont } = await supabase
        .from("fabrica_apontamentos" as any)
        .select("id, ordem_producao_id, timestamp_evento, quantidade_apontada, operador_id")
        .in("ordem_producao_id", opIds)
        .order("timestamp_evento", { ascending: false })
        .limit(100);

      return (vinculos || []).map((v: any) => {
        const op: any = (ops as any[] || []).find((o: any) => o.id === v.fabrica_op_id);
        const prod: any = op ? (produtos as any[] || []).find((p: any) => p.id === op.produto_id) : null;
        const ap = (apont || []).filter((a: any) => a.ordem_producao_id === v.fabrica_op_id).slice(0, 5);
        return {
          vinculo_id: v.id,
          qty_alocada: Number(v.qty_alocada || 0),
          op_id: op?.id,
          numero: op?.numero,
          status: op?.status,
          quantidade_planejada: Number(op?.quantidade_planejada || 0),
          quantidade_produzida: Number(op?.quantidade_produzida || 0),
          data_inicio: op?.data_inicio || null,
          data_prevista: op?.data_prevista || null,
          data_fim: op?.data_fim || null,
          lote: op?.lote || null,
          eficiencia_percentual: op?.eficiencia_percentual ?? null,
          produto_id: op?.produto_id || null,
          produto_codigo: prod?.codigo || null,
          produto_nome: prod?.nome || null,
          apontamentos: ap as any,
        } as OPVinculada;
      }).filter((x) => !!x.op_id);
    },
    staleTime: 15_000,
  });
}
