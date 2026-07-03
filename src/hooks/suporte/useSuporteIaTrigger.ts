import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Dispara a IA da fila ao enviar mensagem no chamado aberto.
 * Monta na página do chamado, passando conversa_id e user.id.
 * Idempotente no backend (checa metadata.replies_to).
 */
export function useSuporteIaTrigger(
  conversaId: string | null | undefined,
  currentUserId: string | null | undefined,
) {
  useEffect(() => {
    if (!conversaId || !currentUserId) return;
    const ch = supabase
      .channel(`suporte-ia-${conversaId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mensagens", filter: `conversa_id=eq.${conversaId}` },
        async (payload) => {
          const m = payload.new as { id: string; remetente_id: string; tipo: string };
          if (m.remetente_id !== currentUserId || m.tipo === "sistema") return;
          try {
            await supabase.functions.invoke("suporte-agente-v2", { body: { mensagem_id: m.id } });
          } catch (e) {
            console.warn("[suporte-ia] invoke", e);
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [conversaId, currentUserId]);
}
