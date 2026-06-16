
-- ============================================================
-- LOTE 3 / 3 — Storage + aperto a membros
-- ============================================================

-- ---------- Step 1: china_produto_documentos ----------
DROP POLICY IF EXISTS china_doc_select ON public.china_produto_documentos;
CREATE POLICY china_doc_select ON public.china_produto_documentos
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.china_produto_submissoes s
    WHERE s.id = china_produto_documentos.submissao_id
      AND (
        s.created_by = (select auth.uid())
        OR public.is_admin_or_supervisor((select auth.uid()))
        OR public.check_user_access((select auth.uid()), 'china')
        OR public.check_user_access((select auth.uid()), 'fabrica')
      )
  )
  OR EXISTS (
    SELECT 1 FROM public.china_submissao_projetos sp
    JOIN public.projeto_membros pm ON pm.projeto_id = sp.projeto_id
    WHERE sp.submissao_id = china_produto_documentos.submissao_id
      AND pm.user_id = (select auth.uid())
  )
);

DROP POLICY IF EXISTS china_doc_update ON public.china_produto_documentos;
CREATE POLICY china_doc_update ON public.china_produto_documentos
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.china_produto_submissoes s
    WHERE s.id = china_produto_documentos.submissao_id
      AND (
        s.created_by = (select auth.uid())
        OR public.is_admin_or_supervisor((select auth.uid()))
        OR public.check_user_access((select auth.uid()), 'china')
        OR public.check_user_access((select auth.uid()), 'fabrica')
      )
  )
  OR EXISTS (
    SELECT 1 FROM public.china_submissao_projetos sp
    JOIN public.projeto_membros pm ON pm.projeto_id = sp.projeto_id
    WHERE sp.submissao_id = china_produto_documentos.submissao_id
      AND pm.user_id = (select auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.china_produto_submissoes s
    WHERE s.id = china_produto_documentos.submissao_id
      AND (
        s.created_by = (select auth.uid())
        OR public.is_admin_or_supervisor((select auth.uid()))
        OR public.check_user_access((select auth.uid()), 'china')
        OR public.check_user_access((select auth.uid()), 'fabrica')
      )
  )
  OR EXISTS (
    SELECT 1 FROM public.china_submissao_projetos sp
    JOIN public.projeto_membros pm ON pm.projeto_id = sp.projeto_id
    WHERE sp.submissao_id = china_produto_documentos.submissao_id
      AND pm.user_id = (select auth.uid())
  )
);

DROP POLICY IF EXISTS china_doc_delete ON public.china_produto_documentos;
CREATE POLICY china_doc_delete ON public.china_produto_documentos
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.china_produto_submissoes s
    WHERE s.id = china_produto_documentos.submissao_id
      AND (
        s.created_by = (select auth.uid())
        OR public.is_admin_or_supervisor((select auth.uid()))
        OR public.check_user_access((select auth.uid()), 'china')
        OR public.check_user_access((select auth.uid()), 'fabrica')
      )
  )
  OR EXISTS (
    SELECT 1 FROM public.china_submissao_projetos sp
    JOIN public.projeto_membros pm ON pm.projeto_id = sp.projeto_id
    WHERE sp.submissao_id = china_produto_documentos.submissao_id
      AND pm.user_id = (select auth.uid())
  )
);

-- ---------- Step 2: china_produto_submissoes ----------
DROP POLICY IF EXISTS china_sub_select ON public.china_produto_submissoes;
CREATE POLICY china_sub_select ON public.china_produto_submissoes
FOR SELECT TO authenticated
USING (
  created_by = (select auth.uid())
  OR public.is_admin_or_supervisor((select auth.uid()))
  OR public.check_user_access((select auth.uid()), 'china')
  OR public.check_user_access((select auth.uid()), 'fabrica')
  OR EXISTS (
    SELECT 1 FROM public.china_submissao_projetos sp
    JOIN public.projeto_membros pm ON pm.projeto_id = sp.projeto_id
    WHERE sp.submissao_id = china_produto_submissoes.id
      AND pm.user_id = (select auth.uid())
  )
);

DROP POLICY IF EXISTS china_sub_update ON public.china_produto_submissoes;
CREATE POLICY china_sub_update ON public.china_produto_submissoes
FOR UPDATE TO authenticated
USING (
  created_by = (select auth.uid())
  OR public.is_admin_or_supervisor((select auth.uid()))
  OR public.check_user_access((select auth.uid()), 'china')
  OR public.check_user_access((select auth.uid()), 'fabrica')
  OR EXISTS (
    SELECT 1 FROM public.china_submissao_projetos sp
    JOIN public.projeto_membros pm ON pm.projeto_id = sp.projeto_id
    WHERE sp.submissao_id = china_produto_submissoes.id
      AND pm.user_id = (select auth.uid())
  )
)
WITH CHECK (
  created_by = (select auth.uid())
  OR public.is_admin_or_supervisor((select auth.uid()))
  OR public.check_user_access((select auth.uid()), 'china')
  OR public.check_user_access((select auth.uid()), 'fabrica')
  OR EXISTS (
    SELECT 1 FROM public.china_submissao_projetos sp
    JOIN public.projeto_membros pm ON pm.projeto_id = sp.projeto_id
    WHERE sp.submissao_id = china_produto_submissoes.id
      AND pm.user_id = (select auth.uid())
  )
);

-- ---------- Step 3: storage china-documentos ----------
DROP POLICY IF EXISTS china_documentos_select ON storage.objects;
CREATE POLICY china_documentos_select ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'china-documentos'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR public.is_admin_or_supervisor(auth.uid())
    OR public.check_user_access(auth.uid(), 'fabrica')
    OR public.check_user_access(auth.uid(), 'china')
    OR EXISTS (
      SELECT 1 FROM public.china_produto_submissoes s
      WHERE (s.id)::text = (storage.foldername(name))[2]
        AND (
          s.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.china_submissao_projetos sp
            JOIN public.projeto_membros pm ON pm.projeto_id = sp.projeto_id
            WHERE sp.submissao_id = s.id AND pm.user_id = auth.uid()
          )
        )
    )
  )
);

DROP POLICY IF EXISTS china_documentos_update ON storage.objects;
CREATE POLICY china_documentos_update ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'china-documentos'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.china_produto_submissoes s
      WHERE (s.id)::text = (storage.foldername(name))[2]
        AND (
          s.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.china_submissao_projetos sp
            JOIN public.projeto_membros pm ON pm.projeto_id = sp.projeto_id
            WHERE sp.submissao_id = s.id AND pm.user_id = auth.uid()
          )
        )
    )
  )
)
WITH CHECK (
  bucket_id = 'china-documentos'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

-- ---------- Step 4: storage projeto-anexos — função SECURITY DEFINER + ramo membership ----------
CREATE OR REPLACE FUNCTION public.user_can_access_anexo_path(_user_id uuid, _path text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projeto_tarefa_anexos a
    WHERE a.storage_path = _path
      AND public.user_can_access_projeto_via_tarefa(_user_id, a.tarefa_id)
  );
$$;

REVOKE ALL ON FUNCTION public.user_can_access_anexo_path(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.user_can_access_anexo_path(uuid, text) TO authenticated;

DROP POLICY IF EXISTS projeto_anexos_select_owned ON storage.objects;
CREATE POLICY projeto_anexos_select_owned ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'projeto-anexos'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR public.is_admin_or_supervisor(auth.uid())
    OR public.user_can_access_anexo_path((select auth.uid()), name)
  )
);

-- ---------- Bônus: fechar grant aberto nas RPCs do Lote 2 ----------
REVOKE ALL ON FUNCTION public.rpc_china_criar_projeto_espelho(uuid, uuid, uuid, text, text, date, date, integer, integer, text, boolean, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_china_criar_projeto_espelho(uuid, uuid, uuid, text, text, date, date, integer, integer, text, boolean, text, boolean) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.rpc_china_resincronizar_espelho(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_china_resincronizar_espelho(uuid) TO authenticated, service_role;
