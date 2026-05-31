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
import { toast } from "sonner";
import { useCallback } from "react";

export type VinculoTipo = "briefing" | "projeto" | "submissao";

interface Args {
  tipo: VinculoTipo;
  refId: string;
  titulo: string;
}

export function useAbrirAcaoVinculada() {
  const labelEscopo = (t: VinculoTipo) =>
    t === "briefing" ? "briefing" : t === "projeto" ? "projeto" : "submissão";

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
        toast.success(`Aprovação será aberta no chat vinculado ao ${labelEscopo(args.tipo)}`);
        window.location.assign(url);
      } catch (e: any) {
        toast.error("Não foi possível abrir a aprovação: " + (e?.message ?? ""));
      }
    },
    [ensureConversa],
  );

  const abrirUrgente = useCallback(
    async (args: Args) => {
      try {
        const conversaId = await ensureConversa(args);
        const url = `/dashboard/chat?conversaId=${encodeURIComponent(conversaId)}&abrir=urgente`;
        toast.success(`Chamada de atenção será aberta no chat vinculado ao ${labelEscopo(args.tipo)}`);
        window.location.assign(url);
      } catch (e: any) {
        toast.error("Não foi possível abrir a chamada: " + (e?.message ?? ""));
      }
    },
    [ensureConversa],
  );

  return { abrirAprovacao, abrirUrgente };
}
