
-- 1. china_doc_comentarios: scope select by submissao access
DROP POLICY IF EXISTS "china_doc_comentarios select" ON public.china_doc_comentarios;
CREATE POLICY "china_doc_comentarios select"
ON public.china_doc_comentarios FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR public.user_can_access_china_submissao(auth.uid(), submissao_id)
);

-- 2. china_submissao_pareceres: scope select by submissao access
DROP POLICY IF EXISTS "china_submissao_pareceres select" ON public.china_submissao_pareceres;
CREATE POLICY "china_submissao_pareceres select"
ON public.china_submissao_pareceres FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR public.user_can_access_china_submissao(auth.uid(), submissao_id)
);

-- 3. china_submissao_parecer_anexos: scope select via parent parecer's submissao
DROP POLICY IF EXISTS "china_subm_parecer_anexos select" ON public.china_submissao_parecer_anexos;
CREATE POLICY "china_subm_parecer_anexos select"
ON public.china_submissao_parecer_anexos FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1
    FROM public.china_submissao_pareceres p
    WHERE p.id = china_submissao_parecer_anexos.parecer_id
      AND public.user_can_access_china_submissao(auth.uid(), p.submissao_id)
  )
);

-- 4. produto_fluxo_artes: scope select to fabrica module access
DROP POLICY IF EXISTS pfa_select ON public.produto_fluxo_artes;
CREATE POLICY pfa_select
ON public.produto_fluxo_artes FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'supervisor'::app_role)
  OR check_user_access(auth.uid(), 'fabrica'::text)
  OR created_by = auth.uid()
);

-- 5. produto_etiqueta_bula: scope select to fabrica module access
DROP POLICY IF EXISTS peb_select ON public.produto_etiqueta_bula;
CREATE POLICY peb_select
ON public.produto_etiqueta_bula FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'supervisor'::app_role)
  OR check_user_access(auth.uid(), 'fabrica'::text)
  OR created_by = auth.uid()
);

-- 6. vw_departamento_canonico: enforce querying user's permissions (security invoker)
ALTER VIEW public.vw_departamento_canonico SET (security_invoker = true);
