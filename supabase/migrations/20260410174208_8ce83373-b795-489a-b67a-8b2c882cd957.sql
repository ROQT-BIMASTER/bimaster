
-- ERRO 1
DROP POLICY IF EXISTS "empresas_select_policy" ON public.empresas;

-- ERRO 2
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'security_audit_log'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.security_audit_log;
  END IF;
END $$;

-- ERRO 3a
DROP POLICY IF EXISTS "Authenticated users can view china_ficha_visibilidade" ON public.china_ficha_visibilidade;
CREATE POLICY "china_ficha_visibilidade_scoped_select"
  ON public.china_ficha_visibilidade FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'supervisor')
    OR EXISTS (
      SELECT 1 FROM public.china_produto_submissoes cps
      WHERE cps.id = china_ficha_visibilidade.submissao_id
      AND cps.created_by = auth.uid()
    )
  );

-- ERRO 3b
DROP POLICY IF EXISTS "Authenticated users can view fluxo_aprovacao_aprovadores" ON public.fluxo_aprovacao_aprovadores;
CREATE POLICY "fluxo_aprovacao_aprovadores_scoped_select"
  ON public.fluxo_aprovacao_aprovadores FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'supervisor')
    OR usuario_id = auth.uid()
  );

-- ERRO 3c
DROP POLICY IF EXISTS "Authenticated users can view produto_brasil_pasta_digital" ON public.produto_brasil_pasta_digital;
CREATE POLICY "produto_brasil_pasta_digital_scoped_select"
  ON public.produto_brasil_pasta_digital FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'supervisor')
    OR created_by = auth.uid()
  );

-- SESSION_INVALIDATION
DROP POLICY IF EXISTS "Anyone can insert invalidation" ON public.session_invalidation_queue;
DROP POLICY IF EXISTS "Authenticated users can insert session_invalidation_queue" ON public.session_invalidation_queue;
CREATE POLICY "Users can only invalidate own sessions"
  ON public.session_invalidation_queue FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());
