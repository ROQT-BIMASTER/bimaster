-- 1) process_events
DROP POLICY IF EXISTS "Authenticated users can manage process_events" ON public.process_events;

-- 2) process_step_history
DROP POLICY IF EXISTS "Authenticated users can manage process_step_history" ON public.process_step_history;

-- 3) china-chat-anexos SELECT
DROP POLICY IF EXISTS "china-chat-anexos: leitura por acesso à submissão" ON storage.objects;
CREATE POLICY "china-chat-anexos: leitura por acesso à submissão"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'china-chat-anexos'
    AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND (
      public.check_user_access(auth.uid(), 'china')
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
    AND ((storage.foldername(name))[1])::uuid IN (
      SELECT id FROM public.china_produto_submissoes
    )
  );

-- 4) user_presence_status: próprio, admin, ou mesmo departamento
DROP POLICY IF EXISTS presence_status_select ON public.user_presence_status;
CREATE POLICY presence_status_select ON public.user_presence_status
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.profiles p_me
      JOIN public.profiles p_other ON p_other.departamento_id = p_me.departamento_id
      WHERE p_me.id = auth.uid()
        AND p_other.id = user_presence_status.user_id
        AND p_me.departamento_id IS NOT NULL
    )
  );