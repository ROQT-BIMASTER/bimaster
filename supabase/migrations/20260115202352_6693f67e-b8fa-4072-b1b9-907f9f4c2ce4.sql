
-- Adicionar políticas à tabela sync_chunks_tracking (sem IF NOT EXISTS)
DROP POLICY IF EXISTS "Admins podem ver sync_chunks" ON public.sync_chunks_tracking;
CREATE POLICY "Admins podem ver sync_chunks"
ON public.sync_chunks_tracking FOR SELECT
TO authenticated
USING (public.is_admin_or_supervisor(auth.uid()));

DROP POLICY IF EXISTS "Admins podem inserir sync_chunks" ON public.sync_chunks_tracking;
CREATE POLICY "Admins podem inserir sync_chunks"
ON public.sync_chunks_tracking FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_or_supervisor(auth.uid()));

DROP POLICY IF EXISTS "Admins podem atualizar sync_chunks" ON public.sync_chunks_tracking;
CREATE POLICY "Admins podem atualizar sync_chunks"
ON public.sync_chunks_tracking FOR UPDATE
TO authenticated
USING (public.is_admin_or_supervisor(auth.uid()));
