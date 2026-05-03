import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { uniqueChannelName } from "@/lib/realtime/channelName";

export interface AprovacaoConsolidado {
  id: string;
  config_id: string;
  tarefa_id: string | null;
  secao_id: string | null;
  projeto_id: string | null;
  lote_nome: string | null;
  titulo: string | null;
  status: string;
  etapa_atual_ordem: number;
  rodada: number;
  prazo_lote: string | null;
  created_at: string;
  created_by: string | null;
  config_nome: string | null;
  etapa_nome: string | null;
  tipo_aprovacao: string | null;
  etapa_responsavel_id: string | null;
  etapa_prazo_em: string | null;
  etapa_entrou_em: string | null;
  atrasado: boolean | null;
  dias_restantes: number | null;
  projeto_nome: string | null;
  secao_nome: string | null;
  tarefa_titulo: string | null;
  qtd_documentos: number;
}

export type EscopoAprovacao =
  | { escopo: "pessoal"; userId: string | undefined }
  | { escopo: "projeto"; projetoId: string | undefined; secaoId?: string | null }
  | { escopo: "secao"; secaoId: string | undefined };

export function useAprovacoesConsolidado(input: EscopoAprovacao) {
  const qc = useQueryClient();
  const enabled =
    (input.escopo === "pessoal" && !!input.userId) ||
    (input.escopo === "projeto" && !!input.projetoId) ||
    (input.escopo === "secao" && !!input.secaoId);

  const queryKey =
    input.escopo === "pessoal"
      ? ["aprovacoes-consolidado", "pessoal", input.userId]
      : input.escopo === "projeto"
        ? ["aprovacoes-consolidado", "projeto", input.projetoId, input.secaoId ?? null]
        : ["aprovacoes-consolidado", "secao", input.secaoId];

  const query = useQuery({
    queryKey,
    enabled,
    queryFn: async () => {
      if (input.escopo === "pessoal") {
        const { data, error } = await (supabase.rpc as any)("rpc_aprovacoes_pendentes_para", {
          _user_id: input.userId!,
        });
        if (error) throw error;
        return (data || []) as AprovacaoConsolidado[];
      }

      let q = supabase
        .from("vw_aprovacoes_consolidado" as any)
        .select("*")
        .order("atrasado", { ascending: false, nullsFirst: false })
        .order("etapa_prazo_em", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (input.escopo === "projeto") {
        q = q.eq("projeto_id", input.projetoId!);
        if (input.secaoId) q = q.eq("secao_id", input.secaoId);
      } else if (input.escopo === "secao") {
        q = q.eq("secao_id", input.secaoId!);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as AprovacaoConsolidado[];
    },
  });

  // Realtime: invalida quando muda instância ou evento
  useEffect(() => {
    if (!enabled) return;
    const ch = supabase
      .channel(uniqueChannelName(`aprovacoes-${queryKey.join("-")}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "fluxo_aprovacao_instancias" }, () => {
        qc.invalidateQueries({ queryKey });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "fluxo_aprovacao_etapa_eventos" }, () => {
        qc.invalidateQueries({ queryKey });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, JSON.stringify(queryKey)]);

  return query;
}
