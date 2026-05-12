import type { MailboxItem } from "@/hooks/useChinaMailbox";

export interface MailboxGroup {
  submissao_id: string;
  produto_codigo: string;
  produto_nome: string;
  numero_ordem: string | null;
  submissao_status: string;
  is_flagged: boolean;
  is_deleted: boolean;
  /** ISO do documento mais recente do grupo. */
  latest_at: string;
  /** Idade em horas do documento mais recente (mín. entre os docs). */
  horas_pendentes: number;
  /** Pior status agregado entre os documentos do grupo. */
  worst_status: string;
  /** True quando algum documento ainda não foi lido. */
  has_unread: boolean;
  /** Documentos da submissão, ordenados por created_at desc. */
  docs: MailboxItem[];
}

// Quanto MENOR o índice, MAIS urgente.
const STATUS_PRIORITY: Record<string, number> = {
  rejeitado: 0,
  contestado: 1,
  pendente: 2,
  rascunho: 3,
  enviado: 4,
  em_revisao: 5,
  aprovado: 6,
};

function pickWorst(a: string | null | undefined, b: string | null | undefined): string {
  const ak = a ?? "";
  const bk = b ?? "";
  const ap = STATUS_PRIORITY[ak] ?? 99;
  const bp = STATUS_PRIORITY[bk] ?? 99;
  return ap <= bp ? ak : bk;
}

/**
 * Agrupa itens da caixa por `submissao_id`, preservando a ordenação por
 * documento mais recente (latest_at desc). Não filtra nada — apenas reorganiza.
 */
export function groupBySubmissao(items: MailboxItem[]): MailboxGroup[] {
  const map = new Map<string, MailboxGroup>();

  for (const it of items) {
    const existing = map.get(it.submissao_id);
    if (!existing) {
      map.set(it.submissao_id, {
        submissao_id: it.submissao_id,
        produto_codigo: it.produto_codigo,
        produto_nome: it.produto_nome,
        numero_ordem: it.numero_ordem,
        submissao_status: it.submissao_status,
        is_flagged: it.is_flagged,
        is_deleted: it.is_deleted,
        latest_at: it.created_at,
        horas_pendentes: it.horas_pendentes,
        worst_status: pickWorst(it.doc_status, it.submissao_status),
        has_unread: !it.is_read,
        docs: [it],
      });
      continue;
    }
    existing.docs.push(it);
    if (new Date(it.created_at).getTime() > new Date(existing.latest_at).getTime()) {
      existing.latest_at = it.created_at;
      existing.horas_pendentes = Math.min(existing.horas_pendentes, it.horas_pendentes);
    }
    existing.worst_status = pickWorst(existing.worst_status, it.doc_status ?? it.submissao_status);
    existing.has_unread = existing.has_unread || !it.is_read;
    existing.is_flagged = existing.is_flagged || it.is_flagged;
  }

  for (const g of map.values()) {
    g.docs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.latest_at).getTime() - new Date(a.latest_at).getTime(),
  );
}
