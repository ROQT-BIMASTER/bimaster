-- Lote 2: Drop redundant permissive policies that bypass restricted ones.
-- These weak policies (auth.uid() IS NOT NULL) coexist with proper *_restricted policies;
-- because PERMISSIVE policies OR together, the weak one fully overrides the restricted one.

-- ============== fabrica_itens_nf_saida ==============
DROP POLICY IF EXISTS "Authenticated users can insert itens NF saida" ON public.fabrica_itens_nf_saida;
DROP POLICY IF EXISTS "Authenticated users can update itens NF saida" ON public.fabrica_itens_nf_saida;
DROP POLICY IF EXISTS "Authenticated users can delete itens NF saida" ON public.fabrica_itens_nf_saida;

-- ============== fabrica_notas_fiscais_saida ==============
DROP POLICY IF EXISTS "Authenticated users can insert NF saida" ON public.fabrica_notas_fiscais_saida;
DROP POLICY IF EXISTS "Authenticated users can update NF saida" ON public.fabrica_notas_fiscais_saida;
DROP POLICY IF EXISTS "Authenticated users can delete NF saida" ON public.fabrica_notas_fiscais_saida;

-- ============== fabrica_tax_rates_iva ==============
DROP POLICY IF EXISTS "Authenticated users can insert tax rates iva" ON public.fabrica_tax_rates_iva;
DROP POLICY IF EXISTS "Authenticated users can update tax rates iva" ON public.fabrica_tax_rates_iva;
DROP POLICY IF EXISTS "Authenticated users can delete tax rates iva" ON public.fabrica_tax_rates_iva;

-- ============== produtos_brasil — replace weak UPDATE with role-restricted ==============
DROP POLICY IF EXISTS "Authenticated users can update produtos_brasil" ON public.produtos_brasil;
CREATE POLICY "produtos_brasil_update_restricted"
ON public.produtos_brasil FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role) OR usuario_tem_acesso_modulo(auth.uid(), 'fábrica'::text))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role) OR usuario_tem_acesso_modulo(auth.uid(), 'fábrica'::text));

-- ============== produtos_brasil_custos ==============
DROP POLICY IF EXISTS "Authenticated users can update produtos_brasil_custos" ON public.produtos_brasil_custos;
DROP POLICY IF EXISTS "Authenticated users can delete produtos_brasil_custos" ON public.produtos_brasil_custos;
CREATE POLICY "produtos_brasil_custos_update_restricted"
ON public.produtos_brasil_custos FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role) OR usuario_tem_acesso_modulo(auth.uid(), 'fábrica'::text))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role) OR usuario_tem_acesso_modulo(auth.uid(), 'fábrica'::text));
CREATE POLICY "produtos_brasil_custos_delete_restricted"
ON public.produtos_brasil_custos FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role) OR usuario_tem_acesso_modulo(auth.uid(), 'fábrica'::text));

-- ============== produtos_brasil_precos ==============
DROP POLICY IF EXISTS "Authenticated users can update produtos_brasil_precos" ON public.produtos_brasil_precos;
DROP POLICY IF EXISTS "Authenticated users can delete produtos_brasil_precos" ON public.produtos_brasil_precos;
CREATE POLICY "produtos_brasil_precos_update_restricted"
ON public.produtos_brasil_precos FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role) OR usuario_tem_acesso_modulo(auth.uid(), 'fábrica'::text))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role) OR usuario_tem_acesso_modulo(auth.uid(), 'fábrica'::text));
CREATE POLICY "produtos_brasil_precos_delete_restricted"
ON public.produtos_brasil_precos FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role) OR usuario_tem_acesso_modulo(auth.uid(), 'fábrica'::text));

-- ============== boletos — replace weak UPDATE with empresa-scoped ==============
DROP POLICY IF EXISTS "Authenticated users can update boletos" ON public.boletos;
CREATE POLICY "boletos_update_empresa_scoped"
ON public.boletos FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR empresa_id IN (SELECT (ue.empresa_id)::text FROM user_empresas ue WHERE ue.user_id = auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR empresa_id IN (SELECT (ue.empresa_id)::text FROM user_empresas ue WHERE ue.user_id = auth.uid())
);

-- ============== cofre_produto_itens — replace weak UPDATE with role-restricted ==============
DROP POLICY IF EXISTS "Authenticated can update cofre itens" ON public.cofre_produto_itens;
CREATE POLICY "cofre_produto_itens_update_restricted"
ON public.cofre_produto_itens FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role) OR usuario_tem_acesso_modulo(auth.uid(), 'fábrica'::text))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role) OR usuario_tem_acesso_modulo(auth.uid(), 'fábrica'::text));