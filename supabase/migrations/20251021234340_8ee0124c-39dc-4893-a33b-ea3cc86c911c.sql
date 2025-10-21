-- Corrigir política de INSERT para conversas_participantes
-- O problema: a política atual exige que o usuário já seja participante para adicionar alguém
-- Isso impede criar novas conversas (chicken-and-egg problem)

DROP POLICY IF EXISTS "Usuários podem adicionar participantes às suas conversas" ON public.conversas_participantes;

-- Nova política: permite adicionar a si mesmo ou adicionar outros se já for participante
CREATE POLICY "Usuários podem adicionar participantes às suas conversas"
ON public.conversas_participantes FOR INSERT
WITH CHECK (
  -- Permite adicionar a si mesmo
  usuario_id = auth.uid()
  OR
  -- Permite adicionar outros se já for participante
  public.is_participant_of_conversa(conversa_id, auth.uid())
);