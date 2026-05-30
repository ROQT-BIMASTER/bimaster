/**
 * useCentralAprovacoes — lista as aprovações do chat encaminhadas para a
 * Central (chat_aprovacoes.enviado_central = true). A RLS já limita o escopo:
 * participante da conversa vê as suas; admin vê todas. Resolve nomes de
 * solicitante/decisor via get_chat_directory (RPC) e conta os documentos.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CentralAprovacao {
  id: string;
  conversa_id: string;
  titulo: string;
  descricao: string | null;
  status: "pendente" | "aprovado" | "rejeitado" | "cancelado";
  solicitante_id: string;
  solicitante_nome: string;
  decidido_por: string | null;
  decidido_nome: string | null;
  decidido_em: string | null;
  enviado_central_em: string | null;
  created_at: string;
  docs_count: number;
}

export function useCentralAprovacoes() {
  const query = useQuery({
    queryKey: ["central-aprovacoes"],
    staleTime: 15_000,
    queryFn: async (): Promise<CentralAprovacao[]> => {
      const { data: aprovacoes, error } = await supabase
        .from("chat_aprovacoes" as any)
        .select("id, conversa_id, titulo, descricao, status, solicitante_id, decidido_por, decidido_em, enviado_central_em, created_at")
        .eq("enviado_central", true)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const rows = (aprovacoes as any[]) ?? [];
      if (rows.length === 0) return [];

      const ids = rows.map((r) => r.id);

      // contagem de documentos por aprovação
      const { data: docs } = await supabase
        .from("chat_aprovacao_documentos" as any)
        .select("aprovacao_id")
        .in("aprovacao_id", ids);
      const countByAprovacao = new Map<string, number>();
      (docs as any[] | null)?.forEach((d) => {
        countByAprovacao.set(d.aprovacao_id, (countByAprovacao.get(d.aprovacao_id) ?? 0) + 1);
      });

      // nomes (solicitante + decisor)
      const personIds = Array.from(
        new Set(rows.flatMap((r) => [r.solicitante_id, r.decidido_por]).filter(Boolean)),
      ) as string[];
      const nameMap = new Map<string, string>();
      if (personIds.length) {
        // get_chat_directory (SECURITY DEFINER) — consistente com o resto do chat.
        const { data: dir } = await (supabase.rpc as any)("get_chat_directory", { _ids: personIds });
        (dir as any[] | null)?.forEach((p) => nameMap.set(p.id, p.nome ?? "—"));
      }

      return rows.map((r) => ({
        ...r,
        solicitante_nome: nameMap.get(r.solicitante_id) ?? "—",
        decidido_nome: r.decidido_por ? (nameMap.get(r.decidido_por) ?? "—") : null,
        docs_count: countByAprovacao.get(r.id) ?? 0,
      })) as CentralAprovacao[];
    },
  });

  const porStatus = useMemo(() => {
    const all = query.data ?? [];
    return {
      pendente: all.filter((a) => a.status === "pendente"),
      aprovado: all.filter((a) => a.status === "aprovado"),
      rejeitado: all.filter((a) => a.status === "rejeitado" || a.status === "cancelado"),
    };
  }, [query.data]);

  return { ...query, porStatus };
}
