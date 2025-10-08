-- Adicionar políticas RLS para gerenciar vinculações de usuários a prospects
-- Permitir que admins e supervisores possam inserir, atualizar e deletar vinculações

CREATE POLICY "Admins e supervisores podem inserir vinculações"
ON public.usuario_prospects
FOR INSERT
TO authenticated
WITH CHECK (is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Admins e supervisores podem atualizar vinculações"
ON public.usuario_prospects
FOR UPDATE
TO authenticated
USING (is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Admins e supervisores podem deletar vinculações"
ON public.usuario_prospects
FOR DELETE
TO authenticated
USING (is_admin_or_supervisor(auth.uid()));