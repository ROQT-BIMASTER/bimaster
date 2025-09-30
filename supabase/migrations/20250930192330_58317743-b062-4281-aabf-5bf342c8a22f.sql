-- Remover políticas problemáticas
DROP POLICY IF EXISTS "Usuários podem ver participantes de suas conversas" ON public.conversas_participantes;
DROP POLICY IF EXISTS "Usuários podem adicionar participantes" ON public.conversas_participantes;
DROP POLICY IF EXISTS "Usuários podem atualizar sua própria participação" ON public.conversas_participantes;

-- Criar função security definer para verificar participação
CREATE OR REPLACE FUNCTION public.is_participant_of_conversa(conversa_id_param uuid, user_id_param uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversas_participantes
    WHERE conversa_id = conversa_id_param
    AND usuario_id = user_id_param
  );
$$;

-- Criar novas políticas usando a função
CREATE POLICY "Usuários podem ver participantes de suas conversas"
ON public.conversas_participantes FOR SELECT
USING (public.is_participant_of_conversa(conversa_id, auth.uid()));

CREATE POLICY "Usuários podem adicionar participantes às suas conversas"
ON public.conversas_participantes FOR INSERT
WITH CHECK (public.is_participant_of_conversa(conversa_id, auth.uid()));

CREATE POLICY "Usuários podem atualizar sua própria participação"
ON public.conversas_participantes FOR UPDATE
USING (usuario_id = auth.uid());