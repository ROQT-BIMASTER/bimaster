/**
 * useSubmissaoChatUnread — conta mensagens do chat (`china_chat_mensagens`)
 * de uma submissão que ainda não foram lidas pelo usuário atual.
 *
 * Considera não lida quando `usuario_id != current_user` e o uid não está em `lida_por`.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { uniqueChannelName } from "@/lib/realtime/channelName";

export function useSubmissaoChatUnread(submissaoId: string | undefined): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!submissaoId) {
      setCount(0);
      return;
    }
    let alive = true;
    let uid: string | null = null;

    const recompute = async () => {
      if (!uid) return;
      const { data } = await supabase
        .from("china_chat_mensagens" as any)
        .select("id, usuario_id, lida_por")
        .eq("submissao_id", submissaoId);
      if (!alive) return;
      const rows = (data || []) as Array<{ usuario_id: string | null; lida_por: string[] | null }>;
      const n = rows.filter(
        (m) => m.usuario_id !== uid && !((m.lida_por || []).includes(uid as string)),
      ).length;
      setCount(n);
    };

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      uid = user?.id ?? null;
      if (!uid) return;
      await recompute();
    })();

    const channel = supabase
      .channel(uniqueChannelName(`chat-unread-${submissaoId}`))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "china_chat_mensagens", filter: `submissao_id=eq.${submissaoId}` },
        () => { recompute(); },
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [submissaoId]);

  return count;
}
