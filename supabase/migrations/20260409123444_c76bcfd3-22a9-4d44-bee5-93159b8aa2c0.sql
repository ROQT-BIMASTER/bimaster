
-- ============================================================
-- FINDING 1: empresas — já dropou na tentativa anterior, recriar
-- ============================================================
DROP POLICY IF EXISTS "empresas_scoped_select" ON public.empresas;

CREATE POLICY "empresas_scoped_select" ON public.empresas
  FOR SELECT TO authenticated
  USING (
    id IN (SELECT empresa_id FROM public.user_empresas WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
    OR public.is_admin_or_supervisor(auth.uid())
  );

-- ============================================================
-- FINDING 2: stores — view segura com masking bancário
-- ============================================================
DROP VIEW IF EXISTS public.stores_safe_v2;

CREATE VIEW public.stores_safe_v2
WITH (security_invoker = on) AS
SELECT
  id, name, cnpj, address, city, state, zip_code, phone, email,
  manager_name, manager_phone, status, created_at, updated_at, latitude, longitude,
  vendedor_id, supervisor_id, category, classification, size, priority,
  chain, code, visit_frequency, notes, monthly_revenue, branch_count,
  created_by, capital_social, cnae_principal, matriz_filial, porte_empresa,
  regime_tributario, situacao_cadastral, linha_digitavel, pix_tipo, tipo_conta,
  CASE
    WHEN public.has_role(auth.uid(), 'admin')
      OR public.is_admin_or_supervisor(auth.uid())
      OR usuario_tem_permissao_modulo(auth.uid(), 'financeiro')
    THEN pix_chave ELSE '***'
  END AS pix_chave,
  CASE
    WHEN public.has_role(auth.uid(), 'admin')
      OR public.is_admin_or_supervisor(auth.uid())
      OR usuario_tem_permissao_modulo(auth.uid(), 'financeiro')
    THEN banco ELSE '***'
  END AS banco,
  CASE
    WHEN public.has_role(auth.uid(), 'admin')
      OR public.is_admin_or_supervisor(auth.uid())
      OR usuario_tem_permissao_modulo(auth.uid(), 'financeiro')
    THEN agencia ELSE '***'
  END AS agencia,
  CASE
    WHEN public.has_role(auth.uid(), 'admin')
      OR public.is_admin_or_supervisor(auth.uid())
      OR usuario_tem_permissao_modulo(auth.uid(), 'financeiro')
    THEN conta ELSE '***'
  END AS conta,
  CASE
    WHEN public.has_role(auth.uid(), 'admin')
      OR public.is_admin_or_supervisor(auth.uid())
      OR usuario_tem_permissao_modulo(auth.uid(), 'financeiro')
    THEN favorecido ELSE '***'
  END AS favorecido
FROM public.stores;

-- ============================================================
-- FINDING 3: fornecedores — recriar sem fabrica
-- ============================================================
DROP POLICY IF EXISTS "select_fornecedores_by_role" ON public.fornecedores;

CREATE POLICY "select_fornecedores_by_role" ON public.fornecedores
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.is_admin_or_supervisor(auth.uid())
    OR usuario_tem_permissao_modulo(auth.uid(), 'financeiro')
    OR usuario_tem_permissao_modulo(auth.uid(), 'comercial')
    OR usuario_tem_permissao_modulo(auth.uid(), 'compras')
  );

-- ============================================================
-- FINDING 4: clientes — remover policy sem escopo por empresa
-- ============================================================
DROP POLICY IF EXISTS "clientes_select_module" ON public.clientes;
