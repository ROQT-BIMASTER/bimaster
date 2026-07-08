
-- 1. Revogar acesso de coluna aos campos sensíveis para authenticated / anon
REVOKE SELECT (cnpj_cpf, razao_social) ON public.vendedores FROM authenticated;
REVOKE SELECT (cnpj_cpf, razao_social) ON public.vendedores FROM anon;

-- Garantir SELECT nas demais colunas para authenticated (não-sensíveis)
GRANT SELECT (id, futura_id, nome, tipo_vendedor, coordenador_id, coord_futura_id, coord_futura_nome, ativo, created_at, updated_at)
  ON public.vendedores TO authenticated;

-- service_role mantém acesso total
GRANT ALL ON public.vendedores TO service_role;

-- 2. RPC auditada para leitura dos documentos por admin/supervisor
CREATE OR REPLACE FUNCTION public.get_vendedor_documento(_vendedor_id uuid)
RETURNS TABLE (
  id uuid,
  nome text,
  razao_social text,
  cnpj_cpf text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'supervisor'::app_role)
  ) THEN
    RAISE EXCEPTION 'forbidden: admin/supervisor role required' USING ERRCODE = '42501';
  END IF;

  -- Registrar acesso a dado sensível (best-effort; não falha em erro de log)
  BEGIN
    INSERT INTO public.sensitive_data_access_log (user_id, table_name, record_id, columns_accessed, access_type, accessed_at)
    VALUES (auth.uid(), 'vendedores', _vendedor_id, ARRAY['cnpj_cpf','razao_social'], 'read', now());
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN QUERY
    SELECT v.id, v.nome, v.razao_social, v.cnpj_cpf
    FROM public.vendedores v
    WHERE v.id = _vendedor_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_vendedor_documento(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_vendedor_documento(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_vendedor_documento(uuid) IS
  'Retorna CPF/CNPJ e razão social do vendedor. Restrito a admin/supervisor, com auditoria em sensitive_data_access_log.';
