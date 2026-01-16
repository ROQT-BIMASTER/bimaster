
-- =====================================================
-- CORREÇÃO DE SEGURANÇA: RLS para todas as tabelas expostas - PARTE 3
-- =====================================================

-- 11. CLIENTES_ALERTAS_CREDITO - Apenas financeiro, admin, supervisor
ALTER TABLE public.clientes_alertas_credito ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view credit alerts" ON public.clientes_alertas_credito;
DROP POLICY IF EXISTS "Finance and admins can view credit alerts" ON public.clientes_alertas_credito;
DROP POLICY IF EXISTS "Finance and admins can manage credit alerts" ON public.clientes_alertas_credito;

CREATE POLICY "Finance and admins can view credit alerts"
ON public.clientes_alertas_credito FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'financeiro')
);

CREATE POLICY "Finance and admins can insert credit alerts"
ON public.clientes_alertas_credito FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'financeiro')
);

CREATE POLICY "Finance and admins can update credit alerts"
ON public.clientes_alertas_credito FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'financeiro')
);

CREATE POLICY "Finance and admins can delete credit alerts"
ON public.clientes_alertas_credito FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor')
);

-- 12. PROSPECTS - Vendedor vê próprios, supervisor vê equipe, admin vê tudo
ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view prospects" ON public.prospects;
DROP POLICY IF EXISTS "Users can view own prospects or team prospects" ON public.prospects;
DROP POLICY IF EXISTS "Users can insert prospects" ON public.prospects;
DROP POLICY IF EXISTS "Users can update own prospects" ON public.prospects;
DROP POLICY IF EXISTS "Admins can delete prospects" ON public.prospects;

CREATE POLICY "Users can view prospects based on role"
ON public.prospects FOR SELECT
TO authenticated
USING (
  vendedor_id = auth.uid() OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'vendas')
);

CREATE POLICY "Users can insert prospects"
ON public.prospects FOR INSERT
TO authenticated
WITH CHECK (
  vendedor_id = auth.uid() OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor')
);

CREATE POLICY "Users can update prospects based on role"
ON public.prospects FOR UPDATE
TO authenticated
USING (
  vendedor_id = auth.uid() OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor')
);

CREATE POLICY "Admins can delete prospects"
ON public.prospects FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor')
);

-- 13. FABRICA_FORMULAS - Apenas fábrica, preços, admin, supervisor
ALTER TABLE public.fabrica_formulas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view formulas" ON public.fabrica_formulas;
DROP POLICY IF EXISTS "Factory and admins can view formulas" ON public.fabrica_formulas;
DROP POLICY IF EXISTS "Factory and admins can manage formulas" ON public.fabrica_formulas;

CREATE POLICY "Factory and admins can view formulas"
ON public.fabrica_formulas FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'fabrica') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'precos')
);

CREATE POLICY "Factory and admins can insert formulas"
ON public.fabrica_formulas FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'fabrica')
);

CREATE POLICY "Factory and admins can update formulas"
ON public.fabrica_formulas FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'fabrica')
);

CREATE POLICY "Admins can delete formulas"
ON public.fabrica_formulas FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor')
);

-- 14. TRADE_BUDGETS - Apenas marketing, financeiro, trade, admin, supervisor
ALTER TABLE public.trade_budgets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view budgets" ON public.trade_budgets;
DROP POLICY IF EXISTS "Marketing finance and admins can view budgets" ON public.trade_budgets;
DROP POLICY IF EXISTS "Admins can manage budgets" ON public.trade_budgets;

CREATE POLICY "Trade marketing and admins can view budgets"
ON public.trade_budgets FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'marketing') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'financeiro') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'trade')
);

CREATE POLICY "Admins can insert budgets"
ON public.trade_budgets FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor')
);

CREATE POLICY "Admins can update budgets"
ON public.trade_budgets FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor')
);

CREATE POLICY "Admins can delete budgets"
ON public.trade_budgets FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
);

-- 15. FABRICA_PRECOS_PRODUTOS - Apenas preços, fábrica, vendas, admin, supervisor
ALTER TABLE public.fabrica_precos_produtos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view product prices" ON public.fabrica_precos_produtos;
DROP POLICY IF EXISTS "Pricing and admins can view product prices" ON public.fabrica_precos_produtos;
DROP POLICY IF EXISTS "Pricing and admins can manage product prices" ON public.fabrica_precos_produtos;

CREATE POLICY "Pricing and sales can view product prices"
ON public.fabrica_precos_produtos FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'precos') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'fabrica') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'vendas')
);

CREATE POLICY "Pricing and admins can insert product prices"
ON public.fabrica_precos_produtos FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'precos')
);

CREATE POLICY "Pricing and admins can update product prices"
ON public.fabrica_precos_produtos FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'precos')
);

CREATE POLICY "Admins can delete product prices"
ON public.fabrica_precos_produtos FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor')
);

-- 16. TRADE_INVESTMENTS - Apenas marketing, financeiro, trade, admin, supervisor
ALTER TABLE public.trade_investments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view investments" ON public.trade_investments;
DROP POLICY IF EXISTS "Marketing finance and admins can view investments" ON public.trade_investments;
DROP POLICY IF EXISTS "Admins can manage investments" ON public.trade_investments;

CREATE POLICY "Trade marketing and admins can view investments"
ON public.trade_investments FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'marketing') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'financeiro') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'trade')
);

CREATE POLICY "Trade and admins can insert investments"
ON public.trade_investments FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'trade')
);

CREATE POLICY "Trade and admins can update investments"
ON public.trade_investments FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'trade')
);

CREATE POLICY "Admins can delete investments"
ON public.trade_investments FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor')
);

-- Revogar acesso anônimo às tabelas restantes
REVOKE ALL ON public.clientes_alertas_credito FROM anon;
REVOKE ALL ON public.prospects FROM anon;
REVOKE ALL ON public.fabrica_formulas FROM anon;
REVOKE ALL ON public.trade_budgets FROM anon;
REVOKE ALL ON public.fabrica_precos_produtos FROM anon;
REVOKE ALL ON public.trade_investments FROM anon;
