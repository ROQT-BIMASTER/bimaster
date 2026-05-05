import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useChinaUserContext } from "@/hooks/useChinaUserContext";
import { uniqueChannelName } from "@/lib/realtime/channelName";

export type MailboxFolder =
  | "inbox"
  | "starred"
  | "sent"
  | "drafts"
  | "approved"
  | "rejected"
  | "trash";

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
}

export interface MailboxCounts {
  inbox: number;
  starred: number;
  sent: number;
  drafts: number;
  approved: number;
  rejected: number;
  trash: number;
  unread_inbox: number;
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

      return {
        uid,
        subs: (subsRes.data || []) as any[],
        docs: (docsRes.data || []) as any[],
        read: new Set<string>(((readRes.data || []) as any[]).map((r) => r.documento_id)),
        flagged: new Set<string>(((flagsRes.data || []) as any[]).map((r) => r.submissao_id)),
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

  const { items, counts } = useMemo(() => {
    const data = query.data;
    if (!data) return { items: [] as MailboxItem[], counts: ZERO_COUNTS };

    const { uid, subs, docs, read, flagged } = data;
    const now = Date.now();
    const subsById = new Map(subs.map((s) => [s.id, s]));

    // Construímos um item por documento; submissões sem doc viram um item "submissão".
    const allItems: MailboxItem[] = [];
    const seenSubs = new Set<string>();

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
      });
    }

    // Classificadores por pasta (aplicam à lista total para os contadores)
    const matchInbox = (i: MailboxItem) => {
      if (i.submissao_status === "aprovado" || i.submissao_status === "rejeitado") return false;
      if (isBrasilUser) {
        return i.doc_status
          ? ["pendente", "enviado", "contestado"].includes(i.doc_status)
          : i.submissao_status === "em_revisao" || i.submissao_status === "pendente";
      }
      // China: precisa ajustar
      return i.doc_status === "rejeitado" || i.submissao_status === "em_revisao";
    };
    const matchSent = (i: MailboxItem) => {
      if (isChinaUser) {
        return ["em_revisao", "pendente"].includes(i.submissao_status);
      }
      // Brasil: enviou ajuste/aprovação → docs aprovados/rejeitados
      return i.doc_status === "aprovado" || i.doc_status === "rejeitado";
    };
    const matchDrafts = (i: MailboxItem) => i.submissao_status === "rascunho";
    const matchApproved = (i: MailboxItem) => i.submissao_status === "aprovado";
    const matchRejected = (i: MailboxItem) => i.submissao_status === "rejeitado";
    const matchTrash = () => false; // deleted_at não exposto no select padrão; placeholder
    const matchStarred = (i: MailboxItem) => i.is_flagged;

    const counts: MailboxCounts = {
      inbox: 0,
      starred: 0,
      sent: 0,
      drafts: 0,
      approved: 0,
      rejected: 0,
      trash: 0,
      unread_inbox: 0,
    };

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
      if (matchStarred(i) && !seenForCount.starred.has(i.submissao_id)) {
        counts.starred += 1;
        seenForCount.starred.add(i.submissao_id);
      }
      if (matchSent(i) && !seenForCount.sent.has(i.submissao_id)) {
        counts.sent += 1;
        seenForCount.sent.add(i.submissao_id);
      }
      if (matchDrafts(i) && !seenForCount.drafts.has(i.submissao_id)) {
        counts.drafts += 1;
        seenForCount.drafts.add(i.submissao_id);
      }
      if (matchApproved(i) && !seenForCount.approved.has(i.submissao_id)) {
        counts.approved += 1;
        seenForCount.approved.add(i.submissao_id);
      }
      if (matchRejected(i) && !seenForCount.rejected.has(i.submissao_id)) {
        counts.rejected += 1;
        seenForCount.rejected.add(i.submissao_id);
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
    };
    const items = allItems.filter(matcher[folder]);

    return { items, counts };
  }, [query.data, folder, isBrasilUser, isChinaUser]);

  return {
    items,
    counts,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    refetch: () => query.refetch(),
  };
}
