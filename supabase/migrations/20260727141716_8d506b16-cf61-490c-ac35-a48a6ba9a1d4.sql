-- =====================================================================
-- China — alinhar regras de Storage com as regras de escrita do banco
-- =====================================================================

-- Helper de leitura (mesma lógica do SELECT em china_produto_documentos)
CREATE OR REPLACE FUNCTION public.user_can_read_china_submissao(_submissao_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    _user_id IS NOT NULL
    AND (
      public.is_admin_or_supervisor(_user_id)
      OR public.check_user_access(_user_id, 'china'::text)
      OR public.check_user_access(_user_id, 'fabrica'::text)
      OR public.check_user_access(_user_id, 'fabrica_china'::text)
      OR EXISTS (
        SELECT 1 FROM public.china_produto_submissoes s
        WHERE s.id = _submissao_id AND s.created_by = _user_id
      )
      OR EXISTS (
        SELECT 1
        FROM public.china_submissao_projetos sp
        JOIN public.projeto_membros pm ON pm.projeto_id = sp.projeto_id
        WHERE sp.submissao_id = _submissao_id AND pm.user_id = _user_id
      )
    )
$$;

REVOKE ALL ON FUNCTION public.user_can_read_china_submissao(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_can_read_china_submissao(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_read_china_submissao(uuid, uuid) TO service_role;

-- Extrai o submissao_id de um path <uid>/<submissao>/... ou <submissao>/...
CREATE OR REPLACE FUNCTION public.china_path_submissao_id(_name text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    NULLIF((storage.foldername(_name))[2], '')::uuid,
    NULLIF((storage.foldername(_name))[1], '')::uuid
  )
$$;

-- Versão tolerante a segmentos não-uuid (ex.: legado "versoes/...")
CREATE OR REPLACE FUNCTION public.china_path_submissao_id_safe(_name text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  parts text[];
  p text;
  re constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
BEGIN
  parts := storage.foldername(_name);
  IF parts IS NULL THEN RETURN NULL; END IF;
  FOREACH p IN ARRAY parts LOOP
    IF p ~* re THEN
      IF EXISTS (SELECT 1 FROM public.china_produto_submissoes s WHERE s.id = p::uuid) THEN
        RETURN p::uuid;
      END IF;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.china_path_submissao_id_safe(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.china_path_submissao_id_safe(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.china_path_submissao_id_safe(text) TO service_role;

-- ---------------------------------------------------------------------
-- Bucket: china-documentos
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "china_documentos_insert" ON storage.objects;
DROP POLICY IF EXISTS "china_documentos_update" ON storage.objects;
DROP POLICY IF EXISTS "china_documentos_delete" ON storage.objects;
DROP POLICY IF EXISTS "china_documentos_select" ON storage.objects;

CREATE POLICY "china_documentos_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'china-documentos'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR public.is_admin_or_supervisor(auth.uid())
    OR public.user_can_read_china_submissao(
         public.china_path_submissao_id_safe(name), auth.uid())
  )
);

CREATE POLICY "china_documentos_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'china-documentos'
  AND (storage.foldername(name))[1] = (auth.uid())::text
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.user_can_write_china_submissao(
         public.china_path_submissao_id_safe(name), auth.uid())
  )
);

CREATE POLICY "china_documentos_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'china-documentos'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.user_can_write_china_submissao(
         public.china_path_submissao_id_safe(name), auth.uid())
  )
)
WITH CHECK (
  bucket_id = 'china-documentos'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.user_can_write_china_submissao(
         public.china_path_submissao_id_safe(name), auth.uid())
  )
);

CREATE POLICY "china_documentos_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'china-documentos'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.user_can_write_china_submissao(
         public.china_path_submissao_id_safe(name), auth.uid())
  )
);

-- ---------------------------------------------------------------------
-- Bucket: china-pasta-digital (não possuía NENHUMA policy)
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "china_pasta_digital_select" ON storage.objects;
DROP POLICY IF EXISTS "china_pasta_digital_insert" ON storage.objects;
DROP POLICY IF EXISTS "china_pasta_digital_update" ON storage.objects;
DROP POLICY IF EXISTS "china_pasta_digital_delete" ON storage.objects;

CREATE POLICY "china_pasta_digital_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'china-pasta-digital'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR public.is_admin_or_supervisor(auth.uid())
    OR public.user_can_read_china_submissao(
         public.china_path_submissao_id_safe(name), auth.uid())
  )
);

CREATE POLICY "china_pasta_digital_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'china-pasta-digital'
  AND (storage.foldername(name))[1] = (auth.uid())::text
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.user_can_write_china_submissao(
         public.china_path_submissao_id_safe(name), auth.uid())
  )
);

CREATE POLICY "china_pasta_digital_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'china-pasta-digital'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.user_can_write_china_submissao(
         public.china_path_submissao_id_safe(name), auth.uid())
  )
)
WITH CHECK (
  bucket_id = 'china-pasta-digital'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.user_can_write_china_submissao(
         public.china_path_submissao_id_safe(name), auth.uid())
  )
);

CREATE POLICY "china_pasta_digital_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'china-pasta-digital'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.user_can_write_china_submissao(
         public.china_path_submissao_id_safe(name), auth.uid())
  )
);