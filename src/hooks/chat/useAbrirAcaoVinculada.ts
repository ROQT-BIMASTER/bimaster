/**
 * useAbrirAcaoVinculada — abre uma ação (aprovação ou chamar atenção) no
 * chat de Pessoas a partir de Briefings/Projetos/Submissões.
 *
 * Fluxo:
 *  1. Chama rpc_get_or_create_conversa_vinculada(tipo, refId, titulo) →
 *     retorna o id da conversa de Pessoas vinculada ao item.
 *  2. Navega para /dashboard/chat com query params (?conversaId=...&abrir=aprovacao|urgente).
 *  3. ChatLayout lê esses params no mount e força modo='pessoas', seleciona
 *     a conversa e dispara a abertura do dialog apropriado em MessageInput.
 */
import { supabase } from "@/integrations/supabase/client";
import { toastAcaoIniciada, toastAcaoFalhou } from "@/lib/chat/acoesFeedback";
import { registrarAcaoChat } from "@/lib/chat/acoesAuditoria";
import { useCallback } from "react";

export type VinculoTipo = "briefing" | "projeto" | "submissao" | "tarefa" | "processo";

interface Args {
  tipo: VinculoTipo;
  refId: string;
  titulo: string;
}

export function useAbrirAcaoVinculada() {
  const ensureConversa = useCallback(async ({ tipo, refId, titulo }: Args) => {
    const { data, error } = await (supabase.rpc as any)(
      "rpc_get_or_create_conversa_vinculada",
      { p_tipo: tipo, p_ref_id: refId, p_titulo: titulo },
    );
    if (error) throw error;
    return data as string;
  }, []);

  const abrirAprovacao = useCallback(
    async (args: Args) => {
      try {
        const conversaId = await ensureConversa(args);
        const url = `/dashboard/chat?conversaId=${encodeURIComponent(conversaId)}&abrir=aprovacao`;
        toastAcaoIniciada("aprovacao", args.tipo);
        void registrarAcaoChat({
          acao: "aprovacao",
          fase: "iniciada",
          entidadeTipo: args.tipo,
          entidadeId: args.refId,
          conversaId,
          detalhe: args.titulo,
        });
        window.location.assign(url);
      } catch (e: any) {
        toastAcaoFalhou("aprovacao", e);
        void registrarAcaoChat({
          acao: "aprovacao",
          fase: "falhou",
          entidadeTipo: args.tipo,
          entidadeId: args.refId,
          detalhe: args.titulo,
          erro: e,
        });
      }
    },
    [ensureConversa],
  );

  const abrirUrgente = useCallback(
    async (args: Args) => {
      try {
        const conversaId = await ensureConversa(args);
        const url = `/dashboard/chat?conversaId=${encodeURIComponent(conversaId)}&abrir=urgente`;
        toastAcaoIniciada("urgente", args.tipo);
        void registrarAcaoChat({
          acao: "urgente",
          fase: "iniciada",
          entidadeTipo: args.tipo,
          entidadeId: args.refId,
          conversaId,
          detalhe: args.titulo,
        });
        window.location.assign(url);
      } catch (e: any) {
        toastAcaoFalhou("urgente", e);
        void registrarAcaoChat({
          acao: "urgente",
          fase: "falhou",
          entidadeTipo: args.tipo,
          entidadeId: args.refId,
          detalhe: args.titulo,
          erro: e,
        });
      }
    },
    [ensureConversa],
  );

  return { abrirAprovacao, abrirUrgente };
}
