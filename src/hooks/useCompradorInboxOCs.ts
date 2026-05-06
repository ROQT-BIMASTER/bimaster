import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { OcRecebimentoKpi } from "./useChinaRecebimentoKpis";

export type InboxFolder =
  | "todas"
  | "rascunho"
  | "aguardando"
  | "producao"
  | "patio"
  | "embarcadas"
  | "containers"
  | "transito"
  | "desembaraco"
  | "recebidas"
  | "atrasadas"
  | "divergencias"
  | "catalogo"
  | "submissoes"
  | "tabela";

export interface InboxOC extends OcRecebimentoKpi {
  ultima_movimentacao: string;
  has_divergencia: boolean;
  has_vinculo: boolean;
  embarque_status: string | null;
  marca: string | null;
  ops_numeros: string[];
  embarque_container: string | null;
}

function isAtrasada(o: OcRecebimentoKpi): boolean {
  if (!o.data_entrega_prevista) return false;
  if (o.oc_status === "concluida" || o.oc_status === "cancelada") return false;
  return o.data_entrega_prevista < new Date().toISOString().slice(0, 10);
}

export function folderMatches(o: InboxOC, folder: InboxFolder): boolean {
  switch (folder) {
    case "todas":
      return o.oc_status !== "cancelada";
    case "rascunho":
      return o.oc_status === "rascunho";
    case "aguardando":
      return o.oc_status === "aguardando_aprovacao" || o.oc_status === "pendente_aprovacao";
    case "producao":
      return ["aprovada", "em_producao", "produzindo"].includes(o.oc_status);
    case "embarcadas":
      return o.qty_embarcada > 0 && !o.data_chegada_porto;
    case "transito":
      return !!o.data_chegada_porto && !o.data_desembaraco;
    case "desembaraco":
      return !!o.data_desembaraco && !o.data_recebimento_cd;
    case "recebidas":
      return o.saldo_aberto <= 0 || o.oc_status === "concluida";
    case "atrasadas":
      return isAtrasada(o);
    case "divergencias":
      return o.has_divergencia;
    case "patio":
    case "containers":
    case "catalogo":
    case "submissoes":
      return false;
  }
}

export function useCompradorInboxOCs() {
  return useQuery({
    queryKey: ["comprador-inbox-ocs"],
    queryFn: async () => {
      const { data: kpis, error } = await supabase
        .from("vw_china_oc_recebimento_kpis" as any)
        .select("*")
        .order("data_emissao", { ascending: false })
        .limit(500);
      if (error) throw error;
      const list = (kpis || []) as unknown as OcRecebimentoKpi[];

      const ocIds = list.map((o) => o.ordem_compra_id);
      const [{ data: vincs }, { data: ncs }, { data: embarques }] = await Promise.all([
        supabase
          .from("compras_internacional_vinculos" as any)
          .select("china_ordem_compra_id")
          .in("china_ordem_compra_id", ocIds.length ? ocIds : ["00000000-0000-0000-0000-000000000000"]),
        supabase
          .from("china_nao_conformidades" as any)
          .select("ordem_compra_id, status")
          .in("ordem_compra_id", ocIds.length ? ocIds : ["00000000-0000-0000-0000-000000000000"]),
        supabase
          .from("china_embarques" as any)
          .select("ordem_compra_id, status")
          .in("ordem_compra_id", ocIds.length ? ocIds : ["00000000-0000-0000-0000-000000000000"]),
      ]);

      const vincSet = new Set((vincs || []).map((v: any) => v.china_ordem_compra_id));
      const ncSet = new Set(
        (ncs || [])
          .filter((n: any) => n.status !== "fechada" && n.status !== "resolvida")
          .map((n: any) => n.ordem_compra_id),
      );
      const embMap = new Map<string, string>();
      (embarques || []).forEach((e: any) => embMap.set(e.ordem_compra_id, e.status));

      const items: InboxOC[] = list.map((o) => ({
        ...o,
        ultima_movimentacao:
          o.data_recebimento_cd ||
          o.data_desembaraco ||
          o.data_chegada_porto ||
          o.data_emissao ||
          new Date().toISOString().slice(0, 10),
        has_divergencia: ncSet.has(o.ordem_compra_id),
        has_vinculo: vincSet.has(o.ordem_compra_id),
        embarque_status: embMap.get(o.ordem_compra_id) || null,
      }));

      items.sort((a, b) => (a.ultima_movimentacao < b.ultima_movimentacao ? 1 : -1));
      return items;
    },
    staleTime: 30_000,
  });
}

export function inboxFolderCounts(items: InboxOC[]): Record<InboxFolder, number> {
  const folders: InboxFolder[] = [
    "todas",
    "rascunho",
    "aguardando",
    "producao",
    "patio",
    "embarcadas",
    "containers",
    "transito",
    "desembaraco",
    "recebidas",
    "atrasadas",
    "divergencias",
    "catalogo",
    "submissoes",
  ];
  const counts = {} as Record<InboxFolder, number>;
  folders.forEach((f) => {
    counts[f] = items.filter((o) => folderMatches(o, f)).length;
  });
  return counts;
}
