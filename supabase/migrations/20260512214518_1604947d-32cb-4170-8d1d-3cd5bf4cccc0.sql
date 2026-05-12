
-- Tighten SELECT RLS to prevent broad Realtime data leakage

-- 1) china_chat_mensagens: only participants of the submissao or admins
DROP POLICY IF EXISTS "Read chat when submission is visible" ON public.china_chat_mensagens;
CREATE POLICY "Read chat when participant of submission"
ON public.china_chat_mensagens
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR usuario_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.china_ficha_visibilidade v
    WHERE v.submissao_id = china_chat_mensagens.submissao_id
      AND v.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.china_produto_submissoes s
    WHERE s.id = china_chat_mensagens.submissao_id
      AND s.created_by = auth.uid()
  )
);

-- 2) process_despacho_documento: scope to creator, ciencia recipient, admin/supervisor, or submission participants
DROP POLICY IF EXISTS despacho_doc_select ON public.process_despacho_documento;
CREATE POLICY despacho_doc_select
ON public.process_despacho_documento
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'supervisor'::app_role)
  OR created_by = auth.uid()
  OR ciencia_por = auth.uid()
  OR parecer_por = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.china_ficha_visibilidade v
    WHERE v.submissao_id = process_despacho_documento.submissao_id
      AND v.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.china_produto_submissoes s
    WHERE s.id = process_despacho_documento.submissao_id
      AND s.created_by = auth.uid()
  )
);

-- 3) china_doc_alertas: scope to admins, dispensador, or submission participants
DROP POLICY IF EXISTS alertas_select ON public.china_doc_alertas;
CREATE POLICY alertas_select
ON public.china_doc_alertas
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'supervisor'::app_role)
  OR dispensado_por = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.china_ficha_visibilidade v
    WHERE v.submissao_id = china_doc_alertas.submissao_id
      AND v.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.china_produto_submissoes s
    WHERE s.id = china_doc_alertas.submissao_id
      AND s.created_by = auth.uid()
  )
);

DROP POLICY IF EXISTS alertas_update ON public.china_doc_alertas;
CREATE POLICY alertas_update
ON public.china_doc_alertas
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'supervisor'::app_role)
  OR dispensado_por = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.china_ficha_visibilidade v
    WHERE v.submissao_id = china_doc_alertas.submissao_id
      AND v.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.china_produto_submissoes s
    WHERE s.id = china_doc_alertas.submissao_id
      AND s.created_by = auth.uid()
  )
);
