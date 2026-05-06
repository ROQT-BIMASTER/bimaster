import type { OcRecebimentoKpi } from "@/hooks/useChinaRecebimentoKpis";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";

export type StatusBucket =
  | "todas"
  | "pendente"
  | "producao"
  | "patio"
  | "embarcada"
  | "transito"
  | "recebida"
  | "atrasada"
  | "divergencia";

/**
 * Atrasada quando:
 *  - tem ETA (data_entrega_prevista) e
 *  - OC não está cancelada;
 *  - se já foi recebida (data_recebimento_cd) e a recebeu DEPOIS da ETA → atrasada;
 *  - se ainda não foi recebida e a ETA passou em relação a hoje → atrasada.
 */
export function isAtrasada(o: Pick<OcRecebimentoKpi, "data_entrega_prevista" | "oc_status" | "data_recebimento_cd">): boolean {
  if (!o.data_entrega_prevista) return false;
  if (o.oc_status === "cancelada") return false;

  const eta = parseLocalDate(o.data_entrega_prevista);
  if (!eta) return false;

  if (o.data_recebimento_cd) {
    const recebimento = parseLocalDate(o.data_recebimento_cd);
    return !!recebimento && recebimento.getTime() > eta.getTime();
  }
  if (o.oc_status === "concluida") return false;

  const hoje = parseLocalDate(new Date().toISOString().slice(0, 10))!;
  return eta.getTime() < hoje.getTime();
}

export function statusBucket(
  o: OcRecebimentoKpi & { has_divergencia?: boolean; data_chegada_porto?: string | null; data_desembaraco?: string | null },
): StatusBucket {
  if (o.has_divergencia) return "divergencia";
  if (isAtrasada(o)) return "atrasada";
  if (o.saldo_aberto <= 0 || o.oc_status === "concluida" || o.data_recebimento_cd) return "recebida";
  if (o.data_desembaraco && !o.data_recebimento_cd) return "patio";
  if (o.data_chegada_porto && !o.data_desembaraco) return "transito";
  if (o.qty_embarcada > 0 && !o.data_chegada_porto) return "embarcada";
  if (["aprovada", "em_producao", "produzindo"].includes(o.oc_status)) return "producao";
  if (["aguardando_aprovacao", "pendente_aprovacao", "rascunho"].includes(o.oc_status)) return "pendente";
  return "pendente";
}
