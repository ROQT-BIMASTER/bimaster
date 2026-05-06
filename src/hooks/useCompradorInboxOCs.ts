import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { OcRecebimentoKpi } from "./useChinaRecebimentoKpis";
import { isAtrasada as isAtrasadaShared } from "@/lib/compras/inboxStatus";
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
    case "tabela":
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
      const submissaoIds = Array.from(new Set(list.map((o) => o.submissao_id).filter(Boolean)));
      const safeOcIds = ocIds.length ? ocIds : ["00000000-0000-0000-0000-000000000000"];
      const safeSubIds = submissaoIds.length ? submissaoIds : ["00000000-0000-0000-0000-000000000000"];

      const [{ data: vincs }, { data: ncs }, { data: embarques }, { data: submissoes }, { data: ocsRow }] = await Promise.all([
        supabase
          .from("compras_internacional_vinculos" as any)
          .select("china_ordem_compra_id")
          .in("china_ordem_compra_id", safeOcIds),
        supabase
          .from("china_nao_conformidades" as any)
          .select("ordem_compra_id, status")
          .in("ordem_compra_id", safeOcIds),
        supabase
          .from("china_embarques" as any)
          .select("ordem_compra_id, status, numero_container, numero_bl, data_embarque")
          .in("ordem_compra_id", safeOcIds)
          .order("data_embarque", { ascending: false }),
        supabase
          .from("china_produto_submissoes" as any)
          .select("id, linha_produto")
          .in("id", safeSubIds),
        supabase
          .from("china_ordens_compra" as any)
          .select("id")
          .in("id", safeOcIds),
      ]);

      // OPs vinculadas por OC via china_embarque_itens -> fabrica_ordens_producao
      const embIds = (embarques || []).map((e: any) => e.id).filter(Boolean);
      const opsByOc = new Map<string, Set<string>>();
      if (embIds.length || ocIds.length) {
        const { data: embItens } = await supabase
          .from("china_embarque_itens" as any)
          .select("ordem_producao_id, embarque_id, fabrica_ordens_producao(numero)")
          .not("ordem_producao_id", "is", null);
        const embToOc = new Map<string, string>();
        (embarques || []).forEach((e: any) => e.id && embToOc.set(e.id, e.ordem_compra_id));
        (embItens || []).forEach((it: any) => {
          const ocId = embToOc.get(it.embarque_id);
          const numero = it.fabrica_ordens_producao?.numero;
          if (!ocId || !numero) return;
          if (!opsByOc.has(ocId)) opsByOc.set(ocId, new Set());
          opsByOc.get(ocId)!.add(numero);
        });
      }

      const vincSet = new Set((vincs || []).map((v: any) => v.china_ordem_compra_id));
      const ncSet = new Set(
        (ncs || [])
          .filter((n: any) => n.status !== "fechada" && n.status !== "resolvida")
          .map((n: any) => n.ordem_compra_id),
      );
      const embMap = new Map<string, string>();
      const containerMap = new Map<string, string>();
      (embarques || []).forEach((e: any) => {
        if (!embMap.has(e.ordem_compra_id)) embMap.set(e.ordem_compra_id, e.status);
        if (!containerMap.has(e.ordem_compra_id) && (e.numero_container || e.numero_bl)) {
          containerMap.set(e.ordem_compra_id, e.numero_container || e.numero_bl);
        }
      });
      const marcaMap = new Map<string, string>();
      (submissoes || []).forEach((s: any) => s.linha_produto && marcaMap.set(s.id, s.linha_produto));

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
        marca: marcaMap.get(o.submissao_id) || null,
        ops_numeros: Array.from(opsByOc.get(o.ordem_compra_id) || []),
        embarque_container: containerMap.get(o.ordem_compra_id) || null,
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
    "tabela",
  ];
  const counts = {} as Record<InboxFolder, number>;
  folders.forEach((f) => {
    counts[f] = items.filter((o) => folderMatches(o, f)).length;
  });
  return counts;
}
