
-- Remove legacy insecure policies that grant access to 'public' role (includes anon)
-- contas_pagar already has proper cp_select/insert/update/delete_empresa policies
DROP POLICY IF EXISTS "Authenticated full access" ON contas_pagar;

-- empresas already has empresas_admin_policy and empresas_select_policy
DROP POLICY IF EXISTS "Authenticated full access" ON empresas;
