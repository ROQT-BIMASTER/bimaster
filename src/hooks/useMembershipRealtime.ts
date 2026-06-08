import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { uniqueChannelName } from "@/lib/realtime/channelName";
import { logger } from "@/lib/logger";

/**
 * Subscription realtime global, escopada ao usuário logado, que invalida
 * caches de projetos/tarefas assim que o usuário é adicionado/removido
 * como membro de um projeto ou ganha/perde acesso a uma seção.
 *
 * Garante que o projeto/tarefa apareça (ou desapareça) sem F5, sem piscar
 * a tela — TanStack Query apenas refaz o fetch em background usando as
 * mesmas RLS/RPC, então o escopo de visibilidade é preservado.
 *
 * Deve ser montado uma única vez em nível raiz autenticado.
 */
export function useMembershipRealtime() {
  const { user } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    if (!user) return;

    const invalidate = () => {
      qc.invalidateQueries({ queryKey: ["projetos"] });
      qc.invalidateQueries({ queryKey: ["projetos-metrics"] });
      qc.invalidateQueries({ queryKey: ["projetos-membros"] });
      qc.invalidateQueries({ queryKey: ["projetos-team-data"] });
      qc.invalidateQueries({ queryKey: ["projeto-tarefas-v2"] });
      qc.invalidateQueries({ queryKey: ["projeto-single"] });
      qc.invalidateQueries({ queryKey: ["inbox-scope-tipos", user.id] });
      qc.invalidateQueries({ queryKey: ["minhas-tarefas"] });
    };

    const channelName = uniqueChannelName(`membership-self-${user.id}`);
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "projeto_membros",
          filter: `user_id=eq.${user.id}`,
        },
        invalidate,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "projeto_membro_secoes",
          filter: `user_id=eq.${user.id}`,
        },
        invalidate,
      )
      .subscribe((status, err) => {
        if (err) {
          logger.warn(`[useMembershipRealtime] channel error (${channelName})`, { error: err });
        }
      });

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch (err) {
        logger.warn(`[useMembershipRealtime] removeChannel falhou (${channelName})`, { error: err });
      }
    };
  }, [user, qc]);
}
