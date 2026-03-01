
-- =====================================================
-- SECURITY HARDENING: Comprehensive fix
-- 1. Block direct SELECT on fabrica_fornecedores
-- 2. Fix ALL SECURITY DEFINER search_path = public → ''
-- =====================================================

-- 1. FORNECEDORES: Block direct SELECT, force safe view
DROP POLICY IF EXISTS "Factory and purchasing can view suppliers" ON public.fabrica_fornecedores;
DROP POLICY IF EXISTS "Usuários com permissão fabrica podem ver fornecedores" ON public.fabrica_fornecedores;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'fabrica_fornecedores' AND policyname = 'fabrica_fornecedores_no_direct_select') THEN
    CREATE POLICY "fabrica_fornecedores_no_direct_select" ON public.fabrica_fornecedores FOR SELECT TO authenticated USING (false);
  END IF;
END $$;

DROP VIEW IF EXISTS public.fabrica_fornecedores_safe;
CREATE VIEW public.fabrica_fornecedores_safe WITH (security_invoker = false) AS
SELECT id, razao_social, nome_fantasia, cnpj, contato, telefone, email, endereco, ativo, created_at, updated_at,
  CASE WHEN (has_role(auth.uid(), 'admin'::app_role) OR check_user_access(auth.uid(), 'financeiro'::text)) THEN banco ELSE NULL END AS banco,
  CASE WHEN (has_role(auth.uid(), 'admin'::app_role) OR check_user_access(auth.uid(), 'financeiro'::text)) THEN agencia ELSE NULL END AS agencia,
  CASE WHEN (has_role(auth.uid(), 'admin'::app_role) OR check_user_access(auth.uid(), 'financeiro'::text)) THEN conta ELSE NULL END AS conta,
  CASE WHEN (has_role(auth.uid(), 'admin'::app_role) OR check_user_access(auth.uid(), 'financeiro'::text)) THEN tipo_conta ELSE NULL END AS tipo_conta,
  CASE WHEN (has_role(auth.uid(), 'admin'::app_role) OR check_user_access(auth.uid(), 'financeiro'::text)) THEN pix_chave ELSE NULL END AS pix_chave,
  CASE WHEN (has_role(auth.uid(), 'admin'::app_role) OR check_user_access(auth.uid(), 'financeiro'::text)) THEN pix_tipo ELSE NULL END AS pix_tipo,
  CASE WHEN (has_role(auth.uid(), 'admin'::app_role) OR check_user_access(auth.uid(), 'financeiro'::text)) THEN favorecido ELSE NULL END AS favorecido,
  CASE WHEN (has_role(auth.uid(), 'admin'::app_role) OR check_user_access(auth.uid(), 'financeiro'::text)) THEN linha_digitavel ELSE NULL END AS linha_digitavel
FROM public.fabrica_fornecedores;
GRANT SELECT ON public.fabrica_fornecedores_safe TO authenticated;

-- 2. FIX ALL SECURITY DEFINER search_path dynamically
DO $$
DECLARE
  func_oid oid;
BEGIN
  FOR func_oid IN
    SELECT p.oid
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND p.proconfig IS NOT NULL
      AND EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%public%')
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = ''''', func_oid::regprocedure);
  END LOOP;
END $$;
