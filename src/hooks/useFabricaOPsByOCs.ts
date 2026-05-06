import { supabase } from "@/integrations/supabase/client";

export async function fetchOPsByOCs(ocIds: string[]): Promise<any[]> {
  if (!ocIds.length) return [];
  const { data: vinculos, error } = await supabase
    .from("compras_internacional_vinculos" as any)
    .select("id, qty_alocada, fabrica_op_id, china_ordem_compra_id")
    .in("china_ordem_compra_id", ocIds)
    .not("fabrica_op_id", "is", null);
  if (error) throw error;
  const v = (vinculos || []) as any[];
  const opIds = v.map((x) => x.fabrica_op_id).filter(Boolean);
  if (!opIds.length) return [];
  const { data: ops } = await supabase
    .from("fabrica_ordens_producao" as any)
    .select("id, numero, status, quantidade_planejada, quantidade_produzida, lote, eficiencia_percentual, data_inicio, data_prevista, data_fim")
    .in("id", opIds);
  const { data: ocs } = await supabase
    .from("china_ordens_compra" as any)
    .select("id, numero_oc")
    .in("id", ocIds);

  return v
    .map((vi) => {
      const op: any = (ops as any[] || []).find((o: any) => o.id === vi.fabrica_op_id);
      const oc: any = (ocs as any[] || []).find((o: any) => o.id === vi.china_ordem_compra_id);
      if (!op) return null;
      return {
        numero_oc: oc?.numero_oc || "",
        qty_alocada: Number(vi.qty_alocada || 0),
        ...op,
      };
    })
    .filter(Boolean) as any[];
}
