import { useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useChinaUserContext } from "@/hooks/useChinaUserContext";
import { uniqueChannelName } from "@/lib/realtime/channelName";
import {
  evaluateAwaitingSend,
  AWAITING_SEND_REASON_LABEL,
  type AwaitingSendReason,
} from "@/lib/china/awaitingSendRule";
import {
  computeExpectedChecklistBatch,
  type ChecklistCustomCategory,
  type ChecklistCustomItem,
  type ChecklistHiddenItem,
} from "@/lib/china/mergeChecklist";

export type MailboxFolder =
  | "inbox"
  | "starred"
  | "sent"
  | "drafts"
  | "approved"
  | "rejected"
  | "trash"
  | "oc"
  // Pastas dedicadas à perspectiva China (central de comando)
  | "awaiting_send"   // Pendentes de envio (criadas, ainda não despachadas)
  | "sent_brazil"     // Enviadas ao Brasil — aguardando Brasil abrir
  | "in_analysis"     // Em análise no Brasil
  | "returned";       // Retorno: ajustes solicitados

export interface MailboxItem {
  // Documento (quando aplicável)
  documento_id: string | null;
  tipo_documento: string | null;
  doc_status: string | null;
  nome_arquivo: string | null;
  arquivo_path: string | null;
  arquivo_url: string | null;

  // Submissão (sempre)
  submissao_id: string;
  produto_codigo: string;
  produto_nome: string;
  numero_ordem: string | null;
  submissao_status: string;
  observacoes_china: string | null;
  observacoes_brasil: string | null;
  aprovado_em: string | null;
  created_at: string;

  // Derivados
  horas_pendentes: number;
  is_read: boolean;
  is_flagged: boolean;
  is_deleted: boolean;
  snooze_until: string | null;
  /** Houve pelo menos uma rejeição anterior nesta submissão (China teve que corrigir). */
  had_previous_rejection: boolean;

  // Checklist da submissão (calculado a partir de todos os documentos da submissão)
  /** Total de documentos no checklist da submissão. */
  checklist_total: number;
  /** Documentos com status `aprovado`. */
  checklist_aprovados: number;
  /** Documentos com status `pendente` / `enviado` (em curso). */
  checklist_pendentes: number;
  /** Documentos com status `rejeitado`. */
  checklist_rejeitados: number;
  /**
   * Para submissões com `submissao_status === "aprovado"`:
   *  - "total": todos os documentos do checklist estão aprovados (libera OC)
   *  - "partial": status da submissão é aprovado mas há documentos não aprovados
   *  - "empty": submissão aprovada sem documentos no checklist
   * Para outras submissões: undefined.
   */
  approval_completeness?: "total" | "partial" | "empty";

  // ── Checklist EFETIVO (Modo Foco) ──
  /**
   * Total de itens esperados no checklist da submissão (mesmo cálculo do
   * Modo Foco: padrão + custom − ocultos). Permite à Caixa de Entrada
   * mostrar "X de 29" no header do grupo, em vez de "X de 3" (somente docs já criados).
   */
  checklist_expected_total: number;
  /**
   * Itens "fantasma" — esperados pelo checklist mas ainda sem `china_produto_documentos`.
   * Renderizados em "Pendentes de envio" para refletir tudo que ainda falta criar.
   */
  is_virtual?: boolean;
  /**
   * Nome legível do `tipo_documento` resolvido via merge do checklist
   * (padrão de `CHINA_DOCUMENT_TYPES` ou `label_pt` do item custom).
   * Quando ausente, a UI cai num formatador de fallback baseado em `tipo_documento`.
   */
  tipo_documento_label?: string;
}

export type ApprovalCompleteness = "all" | "total" | "partial" | "empty";

export interface MailboxCounts {
  inbox: number;
  starred: number;
  sent: number;
  drafts: number;
  approved: number;
  rejected: number;
  trash: number;
  unread_inbox: number;
  awaiting_send: number;
  sent_brazil: number;
  in_analysis: number;
  returned: number;
  // Sub-pastas de "Aprovados" — distinguem aprovação plena vs parcial.
  approved_total: number;
  approved_partial: number;
  approved_empty: number;
  /**
   * Contagem de ITENS (documentos) por pasta — útil quando o usuário precisa
   * saber "tenho 17 itens em 4 submissões". Os outros contadores acima são
   * por SUBMISSÃO (caixa Gmail-style), o que pode confundir nas pastas China.
   */
  awaiting_send_items: number;
  sent_brazil_items: number;
  in_analysis_items: number;
  returned_items: number;
}

interface UseChinaMailboxResult {
  items: MailboxItem[];
  counts: MailboxCounts;
  isLoading: boolean;
  isFetching: boolean;
  refetch: () => void;
}

const ZERO_COUNTS: MailboxCounts = {
  inbox: 0,
  starred: 0,
  sent: 0,
  drafts: 0,
  approved: 0,
  rejected: 0,
  trash: 0,
  unread_inbox: 0,
  awaiting_send: 0,
  sent_brazil: 0,
  in_analysis: 0,
  returned: 0,
  approved_total: 0,
  approved_partial: 0,
  approved_empty: 0,
  awaiting_send_items: 0,
  sent_brazil_items: 0,
  in_analysis_items: 0,
  returned_items: 0,
};

export function useChinaMailbox(folder: MailboxFolder): UseChinaMailboxResult {
  const queryClient = useQueryClient();
  const { isChinaUser, isBrasilUser } = useChinaUserContext();

  const enabled = isChinaUser || isBrasilUser;

  // Carregamos dataset base único (submissões + documentos) e classificamos no client.
  // Volume típico do módulo China cabe nesse modelo (até ~500 submissões ativas).
  const query = useQuery({
    queryKey: ["china-mailbox-dataset", isChinaUser, isBrasilUser],
    enabled,
    staleTime: 15_000,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const uid = user?.id ?? null;

      // Reconciliação automática: normaliza status legado "enviado" → "enviado_brasil"
      // toda vez que a Caixa de Entrada é (re)carregada. Falha silenciosa: não bloqueia
      // o carregamento se a função não existir ou der erro de rede.
      try {
        await (supabase as any).rpc("rpc_china_normalize_legacy_status");
      } catch (_err) {
        // ignorado de propósito — log fica no servidor
      }

      const [subsRes, docsRes, readRes, flagsRes, snoozeRes] = await Promise.all([
        (supabase
          .from("china_produto_submissoes" as any)
          .select(
            "id, produto_codigo, produto_nome, numero_ordem, status, created_by, observacoes_china, observacoes_brasil, aprovado_em, created_at, deleted_at",
          )
          .order("created_at", { ascending: false })
          .limit(500) as any),
        (supabase
          .from("china_produto_documentos" as any)
          .select(
            "id, submissao_id, tipo_documento, status, nome_arquivo, arquivo_path, arquivo_url, created_at",
          )
          .order("created_at", { ascending: false })
          .limit(1000) as any),
        uid
          ? (supabase
              .from("china_inbox_read_state" as any)
              .select("documento_id")
              .eq("usuario_id", uid) as any)
          : Promise.resolve({ data: [] }),
        uid
          ? (supabase
              .from("china_submissao_user_flags" as any)
              .select("submissao_id")
              .eq("usuario_id", uid) as any)
          : Promise.resolve({ data: [] }),
        uid
          ? (supabase
              .from("china_inbox_snooze" as any)
              .select("submissao_id, snooze_until")
              .eq("usuario_id", uid) as any)
          : Promise.resolve({ data: [] }),
      ]);

      const snoozeMap = new Map<string, string>();
      for (const r of (snoozeRes.data || []) as any[]) snoozeMap.set(r.submissao_id, r.snooze_until);

      // Customizações de checklist (Modo Foco) por submissão — usadas para
      // calcular o total ESPERADO (denominador "X de N") e gerar itens
      // virtuais ("fantasma") em "Pendentes de envio" quando ainda nem
      // foram criados em `china_produto_documentos`.
      const subIds = ((subsRes.data || []) as any[]).map((s) => s.id);
      let customCats: ChecklistCustomCategory[] = [];
      let customItems: ChecklistCustomItem[] = [];
      let hidden: ChecklistHiddenItem[] = [];
      if (subIds.length > 0) {
        const [ccRes, ciRes, hRes] = await Promise.all([
          (supabase as any)
            .from("china_checklist_custom_categorias")
            .select("id, submissao_id, fluxo, label_pt, label_cn, ordem")
            .in("submissao_id", subIds),
          (supabase as any)
            .from("china_checklist_custom_itens")
            .select("id, submissao_id, tipo_key, label_pt, label_cn, categoria_default_key, categoria_custom_id")
            .in("submissao_id", subIds),
          (supabase as any)
            .from("china_checklist_itens_ocultos")
            .select("submissao_id, tipo_key")
            .in("submissao_id", subIds),
        ]);
        customCats = (ccRes.data || []) as ChecklistCustomCategory[];
        customItems = (ciRes.data || []) as ChecklistCustomItem[];
        hidden = (hRes.data || []) as ChecklistHiddenItem[];
      }
      const expectedBySub = computeExpectedChecklistBatch(
        subIds,
        customCats,
        customItems,
        hidden,
      );

      return {
        uid,
        subs: (subsRes.data || []) as any[],
        docs: (docsRes.data || []) as any[],
        read: new Set<string>(((readRes.data || []) as any[]).map((r) => r.documento_id)),
        flagged: new Set<string>(((flagsRes.data || []) as any[]).map((r) => r.submissao_id)),
        snoozeMap,
        expectedBySub,
      };
    },
  });

  // Realtime
  useEffect(() => {
    if (!enabled) return;
    const ch = supabase
      .channel(uniqueChannelName("china-mailbox-rt"))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "china_produto_documentos" },
        () => queryClient.invalidateQueries({ queryKey: ["china-mailbox-dataset"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "china_produto_submissoes" },
        () => queryClient.invalidateQueries({ queryKey: ["china-mailbox-dataset"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "china_inbox_read_state" },
        () => queryClient.invalidateQueries({ queryKey: ["china-mailbox-dataset"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "china_submissao_user_flags" },
        () => queryClient.invalidateQueries({ queryKey: ["china-mailbox-dataset"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [enabled, queryClient]);

  const { items, counts, allAwaitingPending } = useMemo(() => {
    const data = query.data;
    if (!data)
      return {
        items: [] as MailboxItem[],
        counts: ZERO_COUNTS,
        allAwaitingPending: [] as MailboxItem[],
      };

    const { uid, subs, docs, read, flagged, snoozeMap, expectedBySub } = data;
    const now = Date.now();
    const subsById = new Map(subs.map((s) => [s.id, s]));

    // Submissões que já tiveram pelo menos uma rejeição em qualquer doc.
    const rejectedSubs = new Set<string>();
    // Estatísticas de checklist por submissão (total / aprovados / pendentes / rejeitados).
    const subStats = new Map<string, { total: number; aprovados: number; pendentes: number; rejeitados: number }>();
    // Tipos de documento JÁ criados (china_produto_documentos) por submissão —
    // usado para descobrir o que ainda falta criar (virtuais "fantasma").
    const realTiposBySub = new Map<string, Set<string>>();
    for (const d of docs) {
      if (d.status === "rejeitado") rejectedSubs.add(d.submissao_id);
      const s = subStats.get(d.submissao_id) ?? { total: 0, aprovados: 0, pendentes: 0, rejeitados: 0 };
      s.total += 1;
      if (d.status === "aprovado") s.aprovados += 1;
      else if (d.status === "rejeitado") s.rejeitados += 1;
      else s.pendentes += 1;
      subStats.set(d.submissao_id, s);
      if (d.tipo_documento) {
        const ts = realTiposBySub.get(d.submissao_id) ?? new Set<string>();
        ts.add(d.tipo_documento);
        realTiposBySub.set(d.submissao_id, ts);
      }
    }

    const completenessFor = (subId: string, subStatus: string): "total" | "partial" | "empty" | undefined => {
      if (subStatus !== "aprovado") return undefined;
      const s = subStats.get(subId);
      if (!s || s.total === 0) return "empty";
      if (s.aprovados === s.total) return "total";
      return "partial";
    };

    /** Total esperado pelo Modo Foco (29 no exemplo). Cai no real se não houver checklist customizado. */
    const expectedTotalFor = (subId: string): number => {
      const exp = expectedBySub.get(subId);
      if (exp && exp.total > 0) return exp.total;
      return subStats.get(subId)?.total ?? 0;
    };

    /** Resolve label legível do tipo_documento usando o mapa do Modo Foco. */
    const labelFor = (subId: string, tipo: string | null | undefined): string | undefined => {
      if (!tipo) return undefined;
      return expectedBySub.get(subId)?.labels.get(tipo)?.pt;
    };

    // Construímos um item por documento; submissões sem doc viram um item "submissão".
    const allItems: MailboxItem[] = [];
    const seenSubs = new Set<string>();

    const snoozedActive = (subId: string) => {
      const u = snoozeMap.get(subId);
      if (!u) return null;
      return new Date(u).getTime() > now ? u : null;
    };

    for (const d of docs) {
      const sub = subsById.get(d.submissao_id);
      if (!sub) continue;
      seenSubs.add(sub.id);
      const created = new Date(d.created_at).getTime();
      allItems.push({
        documento_id: d.id,
        tipo_documento: d.tipo_documento,
        doc_status: d.status,
        nome_arquivo: d.nome_arquivo,
        arquivo_path: d.arquivo_path,
        arquivo_url: d.arquivo_url,
        submissao_id: sub.id,
        produto_codigo: sub.produto_codigo || "—",
        produto_nome: sub.produto_nome || "—",
        numero_ordem: sub.numero_ordem || null,
        submissao_status: sub.status,
        observacoes_china: sub.observacoes_china || null,
        observacoes_brasil: sub.observacoes_brasil || null,
        aprovado_em: sub.aprovado_em || null,
        created_at: d.created_at,
        horas_pendentes: Math.floor((now - created) / 3_600_000),
        is_read: read.has(d.id),
        is_flagged: flagged.has(sub.id),
        is_deleted: !!sub.deleted_at,
        snooze_until: snoozedActive(sub.id),
        had_previous_rejection: rejectedSubs.has(sub.id) && d.status !== "rejeitado",
        checklist_total: subStats.get(sub.id)?.total ?? 0,
        checklist_aprovados: subStats.get(sub.id)?.aprovados ?? 0,
        checklist_pendentes: subStats.get(sub.id)?.pendentes ?? 0,
        checklist_rejeitados: subStats.get(sub.id)?.rejeitados ?? 0,
        approval_completeness: completenessFor(sub.id, sub.status),
        checklist_expected_total: expectedTotalFor(sub.id),
        tipo_documento_label: labelFor(sub.id, d.tipo_documento),
      });
    }

    // Submissões sem nenhum doc (rascunho típico)
    for (const sub of subs) {
      if (seenSubs.has(sub.id)) continue;
      const created = new Date(sub.created_at).getTime();
      allItems.push({
        documento_id: null,
        tipo_documento: null,
        doc_status: null,
        nome_arquivo: null,
        arquivo_path: null,
        arquivo_url: null,
        submissao_id: sub.id,
        produto_codigo: sub.produto_codigo || "—",
        produto_nome: sub.produto_nome || "—",
        numero_ordem: sub.numero_ordem || null,
        submissao_status: sub.status,
        observacoes_china: sub.observacoes_china || null,
        observacoes_brasil: sub.observacoes_brasil || null,
        aprovado_em: sub.aprovado_em || null,
        created_at: sub.created_at,
        horas_pendentes: Math.floor((now - created) / 3_600_000),
        is_read: true,
        is_flagged: flagged.has(sub.id),
        is_deleted: !!sub.deleted_at,
        snooze_until: snoozedActive(sub.id),
        had_previous_rejection: false,
        checklist_total: 0,
        checklist_aprovados: 0,
        checklist_pendentes: 0,
        checklist_rejeitados: 0,
        approval_completeness: completenessFor(sub.id, sub.status),
        checklist_expected_total: expectedTotalFor(sub.id),
      });
    }

    // ── Itens VIRTUAIS ("fantasma") ──
    // Para cada submissão NÃO finalizada, geramos um item por tipo esperado
    // pelo Modo Foco que ainda não tem `china_produto_documentos`. Eles
    // alimentam APENAS a pasta "Pendentes de envio" (regra `awaitingSend`
    // os captura porque não têm documento + não têm parecer técnico).
    const virtualItems: MailboxItem[] = [];
    for (const sub of subs) {
      if (sub.deleted_at) continue;
      if (sub.status === "aprovado" || sub.status === "rejeitado") continue;
      const exp = expectedBySub.get(sub.id);
      if (!exp || exp.tipos.size === 0) continue;
      const realTipos = realTiposBySub.get(sub.id) ?? new Set<string>();
      const created = new Date(sub.created_at).getTime();
      for (const tipo of exp.tipos) {
        if (realTipos.has(tipo)) continue;
        virtualItems.push({
          documento_id: null,
          tipo_documento: tipo,
          doc_status: null,
          nome_arquivo: null,
          arquivo_path: null,
          arquivo_url: null,
          submissao_id: sub.id,
          produto_codigo: sub.produto_codigo || "—",
          produto_nome: sub.produto_nome || "—",
          numero_ordem: sub.numero_ordem || null,
          submissao_status: sub.status,
          observacoes_china: null,
          observacoes_brasil: sub.observacoes_brasil || null,
          aprovado_em: sub.aprovado_em || null,
          created_at: sub.created_at,
          horas_pendentes: Math.floor((now - created) / 3_600_000),
          is_read: true,
          is_flagged: flagged.has(sub.id),
          is_deleted: false,
          snooze_until: snoozedActive(sub.id),
          had_previous_rejection: false,
          checklist_total: subStats.get(sub.id)?.total ?? 0,
          checklist_aprovados: subStats.get(sub.id)?.aprovados ?? 0,
          checklist_pendentes: subStats.get(sub.id)?.pendentes ?? 0,
          checklist_rejeitados: subStats.get(sub.id)?.rejeitados ?? 0,
          approval_completeness: undefined,
          checklist_expected_total: exp.total,
          is_virtual: true,
          tipo_documento_label: exp.labels.get(tipo)?.pt,
        });
      }
    }

    // Classificadores por pasta (aplicam à lista total para os contadores)
    // Itens deletados só aparecem em "trash". Snooze ativo esconde de "inbox".
    const matchInbox = (i: MailboxItem) => {
      if (i.is_deleted) return false;
      if (i.snooze_until) return false;
      if (i.submissao_status === "aprovado" || i.submissao_status === "rejeitado") return false;
      if (isBrasilUser) {
        return i.doc_status
          ? ["pendente", "enviado", "contestado"].includes(i.doc_status)
          : i.submissao_status === "em_revisao" || i.submissao_status === "pendente";
      }
      return i.doc_status === "rejeitado" || i.submissao_status === "em_revisao";
    };
    const matchSent = (i: MailboxItem) => {
      if (i.is_deleted) return false;
      if (isChinaUser) {
        return ["em_revisao", "pendente"].includes(i.submissao_status);
      }
      return i.doc_status === "aprovado" || i.doc_status === "rejeitado";
    };
    const matchDrafts = (i: MailboxItem) => !i.is_deleted && i.submissao_status === "rascunho";
    const matchApproved = (i: MailboxItem) => !i.is_deleted && i.submissao_status === "aprovado";
    const matchRejected = (i: MailboxItem) => !i.is_deleted && i.submissao_status === "rejeitado";
    const matchTrash = (i: MailboxItem) => i.is_deleted;
    const matchStarred = (i: MailboxItem) => !i.is_deleted && i.is_flagged;

    // Pastas dedicadas à perspectiva China — central de comando
    // Pendentes de envio: regra centralizada em `awaitingSendRule` (parametrizável + testada).
    const matchAwaitingSend = (i: MailboxItem) => evaluateAwaitingSend(i).matches;
    // Enviadas ao Brasil: despachadas, doc ainda pendente (Brasil não abriu)
    // Inclui status legado "enviado" como sinônimo de "enviado_brasil".
    const matchSentBrazil = (i: MailboxItem) =>
      !i.is_deleted &&
      (i.submissao_status === "enviado_brasil" || i.submissao_status === "enviado") &&
      i.doc_status === "pendente";
    // Em análise no Brasil: SOMENTE itens de checklist que o Brasil já abriu/contestou.
    // Não inclui mais a submissão inteira em `em_revisao`, porque isso fazia
    // itens novos (rascunho) caírem aqui em vez de "Pendentes de envio".
    const matchInAnalysis = (i: MailboxItem) =>
      !i.is_deleted &&
      (i.doc_status === "enviado" || i.doc_status === "contestado");
    // Retorno: ajustes solicitados pelo Brasil
    const matchReturned = (i: MailboxItem) =>
      !i.is_deleted &&
      (i.doc_status === "rejeitado" || i.submissao_status === "rejeitado");

    const counts: MailboxCounts = { ...ZERO_COUNTS };

    // Contadores por SUBMISSÃO única, não por documento
    const seenForCount: Record<keyof MailboxCounts, Set<string>> = {
      inbox: new Set(),
      starred: new Set(),
      sent: new Set(),
      drafts: new Set(),
      approved: new Set(),
      rejected: new Set(),
      trash: new Set(),
      unread_inbox: new Set(),
      awaiting_send: new Set(),
      sent_brazil: new Set(),
      in_analysis: new Set(),
      returned: new Set(),
      approved_total: new Set(),
      approved_partial: new Set(),
      approved_empty: new Set(),
      // Contadores por ITEM (documento) — usam set de documento_id (ou submissao_id)
      awaiting_send_items: new Set(),
      sent_brazil_items: new Set(),
      in_analysis_items: new Set(),
      returned_items: new Set(),
    };

    const bumpCount = (
      key: keyof MailboxCounts,
      i: MailboxItem,
      match: (it: MailboxItem) => boolean,
    ) => {
      if (match(i) && !seenForCount[key].has(i.submissao_id)) {
        counts[key] += 1;
        seenForCount[key].add(i.submissao_id);
      }
    };

    const bumpItemCount = (
      key: "awaiting_send_items" | "sent_brazil_items" | "in_analysis_items" | "returned_items",
      i: MailboxItem,
      match: (it: MailboxItem) => boolean,
    ) => {
      if (!match(i)) return;
      const k = i.documento_id ?? i.submissao_id;
      if (seenForCount[key].has(k)) return;
      counts[key] += 1;
      seenForCount[key].add(k);
    };

    for (const i of allItems) {
      if (matchInbox(i)) {
        if (!seenForCount.inbox.has(i.submissao_id)) {
          counts.inbox += 1;
          seenForCount.inbox.add(i.submissao_id);
        }
        if (!i.is_read && !seenForCount.unread_inbox.has(i.submissao_id)) {
          counts.unread_inbox += 1;
          seenForCount.unread_inbox.add(i.submissao_id);
        }
      }
      bumpCount("starred", i, matchStarred);
      bumpCount("sent", i, matchSent);
      bumpCount("drafts", i, matchDrafts);
      bumpCount("approved", i, matchApproved);
      bumpCount("rejected", i, matchRejected);
      bumpCount("trash", i, matchTrash);
      bumpCount("awaiting_send", i, matchAwaitingSend);
      bumpCount("sent_brazil", i, matchSentBrazil);
      bumpCount("in_analysis", i, matchInAnalysis);
      bumpCount("returned", i, matchReturned);
      bumpItemCount("awaiting_send_items", i, matchAwaitingSend);
      bumpItemCount("sent_brazil_items", i, matchSentBrazil);
      bumpItemCount("in_analysis_items", i, matchInAnalysis);
      bumpItemCount("returned_items", i, matchReturned);
      // Sub-categorização da pasta "Aprovados" por completude do checklist.
      if (matchApproved(i)) {
        const c = i.approval_completeness;
        if (c === "total") bumpCount("approved_total", i, () => true);
        else if (c === "partial") bumpCount("approved_partial", i, () => true);
        else if (c === "empty") bumpCount("approved_empty", i, () => true);
      }
    }

    // Itens virtuais entram APENAS no contador de awaiting_send (submissões
    // já estão contadas pelo loop acima; aqui contamos itens-fantasma).
    for (const v of virtualItems) {
      if (!matchAwaitingSend(v)) continue;
      // Submissão por bumpCount já estará marcada (set bloqueia duplicata),
      // só precisamos contabilizar items.
      bumpCount("awaiting_send", v, matchAwaitingSend);
      // Para itens, usamos chave virtual única.
      const k = `${v.submissao_id}:virtual:${v.tipo_documento}`;
      if (!seenForCount.awaiting_send_items.has(k)) {
        counts.awaiting_send_items += 1;
        seenForCount.awaiting_send_items.add(k);
      }
    }

    // Filtro da pasta atual
    const matcher: Record<MailboxFolder, (i: MailboxItem) => boolean> = {
      inbox: matchInbox,
      starred: matchStarred,
      sent: matchSent,
      drafts: matchDrafts,
      approved: matchApproved,
      rejected: matchRejected,
      trash: matchTrash,
      oc: () => false, // pasta "oc" tem dataset próprio (useChinaInboxOCs)
      awaiting_send: matchAwaitingSend,
      sent_brazil: matchSentBrazil,
      in_analysis: matchInAnalysis,
      returned: matchReturned,
    };
    const baseItems = allItems.filter(matcher[folder]);
    // Em "Pendentes de envio", anexamos os itens VIRTUAIS para que o
    // denominador "X de N" reflita o checklist completo (Modo Foco).
    const items =
      folder === "awaiting_send"
        ? [...baseItems, ...virtualItems.filter(matchAwaitingSend)]
        : baseItems;
    // Conjunto COMPLETO de itens (reais + virtuais) — usado pela UI para
    // calcular o progresso por submissão de forma consistente entre pastas
    // (ex.: "Pendentes de envio" precisa saber quantos já foram enviados/aprovados,
    // mesmo que esses itens não estejam visíveis na pasta atual).
    const progressItems = [...allItems, ...virtualItems];
    // Lista global de pendentes-por-falta-de-doc/parecer (independe da pasta atual)
    // — usada para emitir notificações. Virtuais ficam de fora para evitar
    // spam (1 toast por tipo esperado).
    const allAwaitingPending = allItems.filter((i) => {
      if (i.is_virtual) return false;
      const ev = evaluateAwaitingSend(i);
      if (!ev.matches) return false;
      return ev.reasons.some((r) => r === "sem_documento" || r === "sem_parecer");
    });

    return { items, counts, allAwaitingPending, progressItems };
  }, [query.data, folder, isBrasilUser, isChinaUser]);

  // Notificação: avisar a China quando um novo checklist passa a ficar pendente
  // de envio por falta de documento + parecer. Roda uma vez por submissão e
  // ignora a primeira carga (snapshot inicial).
  const notifiedRef = useRef<{ initialized: boolean; seen: Set<string> }>({
    initialized: false,
    seen: new Set(),
  });
  useEffect(() => {
    if (!isChinaUser || !query.data) return;
    const newlyPending: { id: string; produto: string; reasons: AwaitingSendReason[] }[] = [];
    const seenNow = new Set<string>();
    const seenSubsLocal = new Set<string>();
    for (const item of allAwaitingPending) {
      if (seenSubsLocal.has(item.submissao_id)) continue;
      seenSubsLocal.add(item.submissao_id);
      const ev = evaluateAwaitingSend(item);
      const motivos = ev.reasons.filter(
        (r) => r === "sem_documento" || r === "sem_parecer",
      );
      seenNow.add(item.submissao_id);
      if (!notifiedRef.current.seen.has(item.submissao_id)) {
        newlyPending.push({
          id: item.submissao_id,
          produto: `${item.produto_codigo} — ${item.produto_nome}`,
          reasons: motivos,
        });
      }
    }
    if (notifiedRef.current.initialized) {
      for (const np of newlyPending) {
        const motivo = np.reasons.map((r) => AWAITING_SEND_REASON_LABEL[r]).join(" + ");
        toast.warning(`Checklist pendente de envio: ${np.produto}`, {
          description: `Motivo: ${motivo}. Anexe documento e parecer técnico para despachar ao Brasil.`,
          id: `awaiting-send-${np.id}`,
        });
      }
    }
    notifiedRef.current.seen = seenNow;
    notifiedRef.current.initialized = true;
  }, [allAwaitingPending, isChinaUser, query.data]);

  return {
    items,
    counts,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    refetch: () => query.refetch(),
  };
}
