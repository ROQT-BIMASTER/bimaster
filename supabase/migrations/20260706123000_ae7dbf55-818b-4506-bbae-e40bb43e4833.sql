-- Suporte B4: Notas internas em tickets
-- Mensagens com visibilidade='interna' são visíveis apenas ao autor,
-- admins e usuários com papel 'suporte' — o solicitante (ticket_owner)
-- NÃO enxerga estas mensagens, permitindo discussão interna entre
-- agentes dentro do mesmo thread do chamado.

DROP POLICY IF EXISTS "Ver mensagens conforme visibilidade e participação" ON public.mensagens;

CREATE POLICY "Ver mensagens conforme visibilidade e participação"
ON public.mensagens
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.conversas_participantes cp
    WHERE cp.conversa_id = mensagens.conversa_id
      AND cp.usuario_id = (SELECT auth.uid())
  )
  AND (
    CASE
      WHEN visibilidade = 'interna' THEN
        remetente_id = (SELECT auth.uid())
        OR public.has_role((SELECT auth.uid()), 'admin'::app_role)
        OR public.has_role((SELECT auth.uid()), 'suporte'::app_role)
      ELSE
        visibilidade = 'broadcast'
        OR remetente_id = (SELECT auth.uid())
        OR ticket_owner_id = (SELECT auth.uid())
        OR public.has_role((SELECT auth.uid()), 'admin'::app_role)
        OR public.has_role((SELECT auth.uid()), 'suporte'::app_role)
    END
  )
);