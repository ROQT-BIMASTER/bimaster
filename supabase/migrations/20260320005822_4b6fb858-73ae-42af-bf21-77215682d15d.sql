-- FIX5: Função server-side para validação multi-tenant
CREATE OR REPLACE FUNCTION public.get_empresa_ids_do_usuario()
RETURNS integer[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    ARRAY(SELECT empresa_id FROM user_empresas WHERE user_id = auth.uid()),
    ARRAY[]::integer[]
  );
$$;

-- Policy para erp_sync_log SELECT com filtro de empresa
-- (as policies de contas_pagar e contas_receber já usam user_has_empresa_access)
DO $$
BEGIN
  -- Remover a policy permissiva existente e substituir por uma restritiva
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'erp_sync_log' 
    AND policyname = 'Authenticated users can read erp_sync_log'
  ) THEN
    DROP POLICY "Authenticated users can read erp_sync_log" ON erp_sync_log;
  END IF;
END $$;

CREATE POLICY "erp_sync_log_select_empresa"
  ON erp_sync_log
  FOR SELECT
  TO authenticated
  USING (
    empresa_id = ANY(get_empresa_ids_do_usuario())
    OR has_role(auth.uid(), 'admin')
  );

-- Policy para INSERT no erp_sync_log — authenticated + service_role mantém existente
-- Apenas reforçar que leitura agora é filtrada por empresa