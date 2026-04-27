import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RecebimentoNacionalAuditoria {
  id: string;
  numero_recebimento: number;
  data_recebimento: string;
  nota_fiscal: string | null;
  observacoes: string | null;
  recebido_por: string | null;
  created_at: string;
  recebedor_nome?: string | null;
  itens: Array<{
    id: string;
    qty_recebida: number;
    divergencia: number | null;
    compra_item_id: string;
    item_descricao?: string | null;
    qty_pedida?: number | null;
  }>;
}

/**
 * Histórico/auditoria de recebimentos parciais — Compras Nacionais (Brasil)
 * Inclui usuário (nome), data, NF e observações + linha por item com divergência.
 */
export function useHistoricoRecebimentosNacional(compraId?: string) {
  return useQuery({
    queryKey: ["historico-recebimentos-nacional", compraId],
    enabled: !!compraId,
    queryFn: async (): Promise<RecebimentoNacionalAuditoria[]> => {
      const { data: recs, error } = await supabase
        .from("fabrica_compra_recebimentos" as any)
        .select(
          `id, numero_recebimento, data_recebimento, nota_fiscal, observacoes,
           recebido_por, created_at,
           itens:fabrica_compra_recebimento_itens(
             id, qty_recebida, divergencia, compra_item_id,
             item:fabrica_compra_itens(descricao, qty_pedida, mp:fabrica_materias_primas(nome))
           )`,
        )
        .eq("compra_id", compraId!)
        .order("numero_recebimento", { ascending: false });
      if (error) throw error;

      const list = (recs || []) as any[];
      const userIds = Array.from(
        new Set(list.map((r) => r.recebido_por).filter(Boolean)),
      ) as string[];

      let nomes = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds);
        nomes = new Map((profs || []).map((p: any) => [p.id, p.full_name]));
      }

      return list.map((r) => ({
        id: r.id,
        numero_recebimento: r.numero_recebimento,
        data_recebimento: r.data_recebimento,
        nota_fiscal: r.nota_fiscal,
        observacoes: r.observacoes,
        recebido_por: r.recebido_por,
        created_at: r.created_at,
        recebedor_nome: r.recebido_por ? nomes.get(r.recebido_por) || null : null,
        itens: (r.itens || []).map((i: any) => ({
          id: i.id,
          qty_recebida: Number(i.qty_recebida || 0),
          divergencia: i.divergencia != null ? Number(i.divergencia) : null,
          compra_item_id: i.compra_item_id,
          item_descricao: i.item?.descricao || i.item?.mp?.nome || null,
          qty_pedida: i.item?.qty_pedida != null ? Number(i.item.qty_pedida) : null,
        })),
      }));
    },
  });
}

export interface RecebimentoInternacionalAuditoria {
  id: string;
  numero_di: string | null;
  status: string;
  data_chegada_porto: string | null;
  data_desembaraco: string | null;
  data_recebimento_cd: string | null;
  observacoes: string | null;
  conferente_id: string | null;
  conferente_nome?: string | null;
  created_at: string;
  itens: Array<{
    id: string;
    qty_esperada: number;
    qty_recebida: number;
    qty_avariada: number;
    qty_faltante: number;
    motivo_divergencia: string | null;
    ordem_item_id: string;
    item_descricao?: string | null;
  }>;
}

/**
 * Histórico/auditoria de recebimentos da Central Internacional (China → Brasil).
 */
export function useHistoricoRecebimentosInternacional(ordemCompraId?: string) {
  return useQuery({
    queryKey: ["historico-recebimentos-internacional", ordemCompraId],
    enabled: !!ordemCompraId,
    queryFn: async (): Promise<RecebimentoInternacionalAuditoria[]> => {
      const { data: recs, error } = await supabase
        .from("china_recebimentos_carga" as any)
        .select(
          `id, numero_di, status, data_chegada_porto, data_desembaraco, data_recebimento_cd,
           observacoes, conferente_id, created_at,
           itens:china_recebimento_itens(
             id, qty_esperada, qty_recebida, qty_avariada, qty_faltante,
             motivo_divergencia, ordem_item_id,
             item:china_ordem_itens(descricao_item, sku)
           )`,
        )
        .eq("ordem_compra_id", ordemCompraId!)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const list = (recs || []) as any[];
      const userIds = Array.from(
        new Set(list.map((r) => r.conferente_id).filter(Boolean)),
      ) as string[];

      let nomes = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds);
        nomes = new Map((profs || []).map((p: any) => [p.id, p.full_name]));
      }

      return list.map((r) => ({
        id: r.id,
        numero_di: r.numero_di,
        status: r.status,
        data_chegada_porto: r.data_chegada_porto,
        data_desembaraco: r.data_desembaraco,
        data_recebimento_cd: r.data_recebimento_cd,
        observacoes: r.observacoes,
        conferente_id: r.conferente_id,
        conferente_nome: r.conferente_id ? nomes.get(r.conferente_id) || null : null,
        created_at: r.created_at,
        itens: (r.itens || []).map((i: any) => ({
          id: i.id,
          qty_esperada: Number(i.qty_esperada || 0),
          qty_recebida: Number(i.qty_recebida || 0),
          qty_avariada: Number(i.qty_avariada || 0),
          qty_faltante: Number(i.qty_faltante || 0),
          motivo_divergencia: i.motivo_divergencia,
          ordem_item_id: i.ordem_item_id,
          item_descricao: i.item?.descricao_item || i.item?.sku || null,
        })),
      }));
    },
  });
}
