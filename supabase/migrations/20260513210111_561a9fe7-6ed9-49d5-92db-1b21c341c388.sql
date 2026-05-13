-- Permite que usuários autenticados criem conversas (marcando-se como criador)
CREATE POLICY "Usuários autenticados podem criar conversas"
ON public.conversas
FOR INSERT
TO authenticated
WITH CHECK (criado_por = auth.uid());

-- Permite que o criador atualize sua conversa
CREATE POLICY "Criador pode atualizar a conversa"
ON public.conversas
FOR UPDATE
TO authenticated
USING (criado_por = auth.uid())
WITH CHECK (criado_por = auth.uid());