// Dispara o agente IA quando o usuário envia mensagem no canal Suporte do Sistema.
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const SUPORTE_CONV_ID = "3daf9772-404f-42f4-adbf-8a2566d91870";
const BOT_USER_ID = "1ee5b9de-4864-475f-9602-ee039197e46e";

/**
 * Quando uma mensagem é inserida na conversa de Suporte por um usuário (não-bot),
 * invoca o edge function `suporte-agente` para gerar a resposta.
 */
export function useSuporteAgenteTrigger(currentUserId: string | null | undefined) {
  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel(`suporte-agente-${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mensagens",
          filter: `conversa_id=eq.${SUPORTE_CONV_ID}`,
        },
        async (payload) => {
          const msg = payload.new as { id: string; remetente_id: string };
          // Só dispara se a mensagem foi do próprio usuário logado (evita 108 triggers concorrentes).
          if (msg.remetente_id !== currentUserId || msg.remetente_id === BOT_USER_ID) return;

          try {
            await supabase.functions.invoke("suporte-agente", {
              body: { mensagem_id: msg.id },
            });
          } catch (err) {
            console.warn("[suporte-agente] invoke falhou:", err);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);
}
