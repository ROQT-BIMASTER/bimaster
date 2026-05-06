import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ChinaOCSubTab =
  | "pendente"
  | "producao"
  | "pronto_embarque"
  | "embarcada"
  | "concluida";

export interface ChinaInboxOC {
  ordem_compra_id: string;
  numero_oc: string;
  produto_codigo: string;
  produto_nome: string;
  qty_total: number;
  qty_produzida: number;
  data_emissao: string;
  data_entrega_prevista: string | null;
  status: string;
  aceita_em: string | null;
  recusada_em: string | null;
  motivo_recusa: string | null;
  has_embarque: boolean;
  embarque_status: string | null;
  data_embarque: string | null;
  data_eta: string | null;
  data_entrega_real: string | null;
  observacoes: string | null;
}

export function ocSubTabMatches(o: ChinaInboxOC, tab: ChinaOCSubTab): boolean {
  switch (tab) {
    case "pendente":
      return !o.aceita_em && !o.recusada_em && !["cancelada", "concluida"].includes(o.status);
    case "producao":
      return !!o.aceita_em && !o.has_embarque && !o.data_entrega_real && o.qty_produzida < o.qty_total;
    case "pronto_embarque":
      return !!o.aceita_em && !o.has_embarque && o.qty_produzida >= o.qty_total && !o.data_entrega_real;
    case "embarcada":
      return o.has_embarque && !o.data_entrega_real;
    case "concluida":
      return !!o.data_entrega_real || o.status === "concluida";
  }
}

export function useChinaInboxOCs() {
  return useQuery({
    queryKey: ["china-inbox-ocs"],
    queryFn: async () => {
      const { data: ocs, error } = await supabase
        .from("china_ordens_compra")
        .select(
          "id, numero_oc, produto_codigo, produto_nome, qty_total, qty_produzida, data_emissao, data_entrega_prevista, data_entrega_real, status, aceita_em, recusada_em, motivo_recusa, observacoes",
        )
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;

      const ids = (ocs || []).map((o) => o.id);
      const { data: embarques } = await supabase
        .from("china_embarques")
        .select("ordem_compra_id, status, data_embarque, data_eta")
        .in("ordem_compra_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

      const embMap = new Map<string, { status: string | null; data_embarque: string | null; data_eta: string | null }>();
      (embarques || []).forEach((e: any) => {
        if (!embMap.has(e.ordem_compra_id)) {
          embMap.set(e.ordem_compra_id, {
            status: e.status,
            data_embarque: e.data_embarque,
            data_eta: e.data_eta,
          });
        }
      });

      const items: ChinaInboxOC[] = (ocs || []).map((o: any) => {
        const emb = embMap.get(o.id);
        return {
          ordem_compra_id: o.id,
          numero_oc: o.numero_oc,
          produto_codigo: o.produto_codigo,
          produto_nome: o.produto_nome,
          qty_total: o.qty_total,
          qty_produzida: o.qty_produzida,
          data_emissao: o.data_emissao,
          data_entrega_prevista: o.data_entrega_prevista,
          data_entrega_real: o.data_entrega_real,
          status: o.status,
          aceita_em: o.aceita_em,
          recusada_em: o.recusada_em,
          motivo_recusa: o.motivo_recusa,
          observacoes: o.observacoes,
          has_embarque: !!emb,
          embarque_status: emb?.status ?? null,
          data_embarque: emb?.data_embarque ?? null,
          data_eta: emb?.data_eta ?? null,
        };
      });
      return items;
    },
    staleTime: 30_000,
  });
}

export function chinaInboxOCCounts(items: ChinaInboxOC[]): Record<ChinaOCSubTab, number> {
  const tabs: ChinaOCSubTab[] = ["pendente", "producao", "pronto_embarque", "embarcada", "concluida"];
  const out = {} as Record<ChinaOCSubTab, number>;
  tabs.forEach((t) => {
    out[t] = items.filter((o) => ocSubTabMatches(o, t)).length;
  });
  return out;
}
