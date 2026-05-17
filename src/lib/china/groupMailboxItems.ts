import type { MailboxItem } from "@/hooks/useChinaMailbox";
import { evaluateAwaitingSend } from "@/lib/china/awaitingSendRule";

export interface MailboxGroupProgress {
  /** Total de itens do checklist visíveis no grupo. */
  total: number;
  /** Itens já enviados ao Brasil (qualquer status posterior a rascunho/sem doc). */
  enviados: number;
  /** Itens que o Brasil já abriu (`enviado`/`contestado`). */
  em_analise: number;
  /** Itens aprovados pelo Brasil. */
  aprovados: number;
  /** Itens rejeitados pelo Brasil (precisam de ajuste). */
  rejeitados: number;
  /** Itens ainda pendentes de envio (regra `evaluateAwaitingSend`). */
  pendentes: number;
  /**
   * Sub-contagem de `pendentes`: itens que JÁ TÊM documento anexado
   * (`documento_id` preenchido) mas ainda não foram despachados ao Brasil
   * — tipicamente em rascunho ou sem parecer técnico da China.
   * Usado pela UI para distinguir "ainda não criado" de "anexado em rascunho".
   */
  anexados_rascunho: number;
}

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
  /** Agregado de progresso enviado/aprovado/pendente do checklist da submissão. */
  progress: MailboxGroupProgress;
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

function emptyProgress(): MailboxGroupProgress {
  return { total: 0, enviados: 0, em_analise: 0, aprovados: 0, rejeitados: 0, pendentes: 0 };
}

function classifyForProgress(item: MailboxItem): keyof Omit<MailboxGroupProgress, "total"> {
  // Itens "fantasma" (submissão sem nenhum documento) só são pendentes se
  // a regra de pendência os marca; caso contrário, aprovados/rejeitados/enviados.
  if (item.doc_status === "aprovado") return "aprovados";
  if (item.doc_status === "rejeitado" || item.submissao_status === "rejeitado") return "rejeitados";
  if (item.doc_status === "enviado" || item.doc_status === "contestado") return "em_analise";
  if (evaluateAwaitingSend(item).matches) return "pendentes";
  if (item.doc_status === "pendente") return "enviados";
  // fallback razoável: se já tem doc anexado e não é rascunho, considera enviado.
  if (item.documento_id && item.doc_status && item.doc_status !== "rascunho") return "enviados";
  return "pendentes";
}

/**
 * Agrupa itens da caixa por `submissao_id`, preservando a ordenação por
 * documento mais recente (latest_at desc). Não filtra nada — apenas reorganiza.
 *
 * O agregado `progress` permite à UI exibir, por submissão, quanto do checklist
 * já foi enviado / aprovado / rejeitado / ainda pendente (caso típico da fase
 * inicial: 17 itens, 2 enviados, 15 pendentes).
 */
export function groupBySubmissao(
  items: MailboxItem[],
  progressSource?: MailboxItem[],
): MailboxGroup[] {
  const map = new Map<string, MailboxGroup>();

  for (const it of items) {
    const existing = map.get(it.submissao_id);
    if (!existing) {
      const g: MailboxGroup = {
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
        progress: emptyProgress(),
      };
      map.set(it.submissao_id, g);
    } else {
      existing.docs.push(it);
      if (new Date(it.created_at).getTime() > new Date(existing.latest_at).getTime()) {
        existing.latest_at = it.created_at;
        existing.horas_pendentes = Math.min(existing.horas_pendentes, it.horas_pendentes);
      }
      existing.worst_status = pickWorst(existing.worst_status, it.doc_status ?? it.submissao_status);
      existing.has_unread = existing.has_unread || !it.is_read;
      existing.is_flagged = existing.is_flagged || it.is_flagged;
    }
  }

  // Indexa fonte de progresso por submissão (se fornecida) para que cada grupo
  // calcule enviados/aprovados/pendentes a partir do checklist COMPLETO da
  // submissão, não apenas dos itens visíveis na pasta atual. Isso garante que
  // as pastas "Pendentes de envio" e "Enviadas ao Brasil" mostrem números
  // consistentes (ex.: 4 enviados / 25 pendentes / 29 totais em ambas).
  const progressBySub = new Map<string, MailboxItem[]>();
  if (progressSource && progressSource.length > 0) {
    for (const it of progressSource) {
      const arr = progressBySub.get(it.submissao_id) ?? [];
      arr.push(it);
      progressBySub.set(it.submissao_id, arr);
    }
  }

  for (const g of map.values()) {
    g.docs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const sourceDocs = progressBySub.get(g.submissao_id) ?? g.docs;
    for (const d of sourceDocs) {
      const bucket = classifyForProgress(d);
      g.progress[bucket] += 1;
      g.progress.total += 1;
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.latest_at).getTime() - new Date(a.latest_at).getTime(),
  );
}
