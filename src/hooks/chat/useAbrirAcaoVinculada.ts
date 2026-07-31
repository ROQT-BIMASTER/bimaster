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
        window.location.assign(url);
      } catch (e: any) {
        toastAcaoFalhou("aprovacao", e);
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
        window.location.assign(url);
      } catch (e: any) {
        toastAcaoFalhou("urgente", e);
      }
    },
    [ensureConversa],
  );

  return { abrirAprovacao, abrirUrgente };
}
