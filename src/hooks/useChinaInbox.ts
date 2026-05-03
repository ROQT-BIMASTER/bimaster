import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useChinaUserContext } from "@/hooks/useChinaUserContext";
import { uniqueChannelName } from "@/lib/realtime/channelName";

/**
 * Item unificado da Caixa de Entrada China — qualquer documento que
 * exija ação do usuário corrente (Brasil ou China), ordenado por urgência.
 *
 * Regras:
 *  - Brasil vê documentos com status "pendente" / "enviado" / "contestado"
 *    (precisa aprovar/rejeitar/responder).
 *  - China vê documentos com status "rejeitado" (precisa corrigir) ou
 *    documentos enviados pelo Brasil aguardando ciência.
 */
export interface ChinaInboxItem {
  documento_id: string;
  submissao_id: string;
  tipo_documento: string;
  status: string;
  nome_arquivo: string | null;
  arquivo_path: string | null;
  arquivo_url: string | null;
  produto_codigo: string;
  produto_nome: string;
  numero_ordem: string | null;
  created_at: string;
  submissao_status: string;
  // Tempo desde criação em horas
  horas_pendentes: number;
}

export function useChinaInbox(filter: "todos" | "pendente" | "ajuste" = "todos") {
  const queryClient = useQueryClient();
  const { isChinaUser, isBrasilUser } = useChinaUserContext();

  const query = useQuery({
    queryKey: ["china-inbox", filter, isChinaUser, isBrasilUser],
    queryFn: async (): Promise<ChinaInboxItem[]> => {
      // Statuses que requerem ação por papel
      const targetStatuses: string[] = isBrasilUser
        ? ["pendente", "enviado", "contestado"]
        : ["rejeitado"];

      const { data, error } = await (supabase
        .from("china_produto_documentos" as any)
        .select(`
          id, submissao_id, tipo_documento, status, nome_arquivo,
          arquivo_path, arquivo_url, created_at,
          china_produto_submissoes:submissao_id (
            produto_codigo, produto_nome, numero_ordem, status
          )
        `)
        .in("status", targetStatuses)
        .order("created_at", { ascending: false })
        .limit(200) as any);

      if (error) throw error;

      const now = Date.now();
      const items: ChinaInboxItem[] = (data || []).map((d: any) => {
        const sub = d.china_produto_submissoes || {};
        const created = new Date(d.created_at).getTime();
        return {
          documento_id: d.id,
          submissao_id: d.submissao_id,
          tipo_documento: d.tipo_documento,
          status: d.status,
          nome_arquivo: d.nome_arquivo,
          arquivo_path: d.arquivo_path,
          arquivo_url: d.arquivo_url,
          produto_codigo: sub.produto_codigo || "—",
          produto_nome: sub.produto_nome || "—",
          numero_ordem: sub.numero_ordem || null,
          submissao_status: sub.status || "—",
          created_at: d.created_at,
          horas_pendentes: Math.floor((now - created) / (1000 * 60 * 60)),
        };
      });

      // Filtros adicionais via UI
      if (filter === "pendente") {
        return items.filter((i) => ["pendente", "enviado"].includes(i.status));
      }
      if (filter === "ajuste") {
        return items.filter((i) => ["rejeitado", "contestado"].includes(i.status));
      }
      return items;
    },
    enabled: isChinaUser || isBrasilUser,
    staleTime: 15_000,
  });

  // Realtime: invalida a fila quando docs/submissões mudam
  useEffect(() => {
    if (!isChinaUser && !isBrasilUser) return;
    const ch = supabase
      .channel(uniqueChannelName("china-inbox-rt"))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "china_produto_documentos" },
        () => queryClient.invalidateQueries({ queryKey: ["china-inbox"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "china_produto_submissoes" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["china-inbox"] });
          queryClient.invalidateQueries({ queryKey: ["china-stats"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [isChinaUser, isBrasilUser, queryClient]);

  return query;
}

/**
 * Contador rápido para badge da sidebar / sino piscando.
 * Não invalida cache extra — espelha o useChinaInbox.
 */
export function useChinaInboxCount() {
  const { data = [] } = useChinaInbox("todos");
  return data.length;
}
