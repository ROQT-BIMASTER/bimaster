-- =============================================
-- COMPLETAR POLÍTICAS RLS FALTANTES
-- =============================================

-- 1. PROFILES - Garantir RLS está habilitado
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Dropar políticas antigas se existirem e recriar
DROP POLICY IF EXISTS "Usuários veem próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Usuários atualizam próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Admins gerenciam perfis" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.profiles;

CREATE POLICY "Usuários veem próprio perfil RLS" ON public.profiles
FOR SELECT USING (
  id = auth.uid() OR 
  is_admin_or_supervisor(auth.uid()) OR
  is_supervisor_of(auth.uid(), id)
);

CREATE POLICY "Usuários atualizam próprio perfil RLS" ON public.profiles
FOR UPDATE USING (id = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins gerenciam perfis RLS" ON public.profiles
FOR ALL USING (has_role(auth.uid(), 'admin'));

-- 2. USER_WHATSAPP - Garantir RLS
ALTER TABLE public.user_whatsapp ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários veem próprio whatsapp" ON public.user_whatsapp;
DROP POLICY IF EXISTS "Usuários gerenciam próprio whatsapp" ON public.user_whatsapp;

CREATE POLICY "Usuários veem próprio whatsapp RLS" ON public.user_whatsapp
FOR SELECT USING (user_id = auth.uid() OR is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Usuários gerenciam próprio whatsapp RLS" ON public.user_whatsapp
FOR ALL USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

-- 3. PROSPECTS - Garantir RLS
ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários veem prospects permitidos" ON public.prospects;
DROP POLICY IF EXISTS "Usuários gerenciam próprios prospects" ON public.prospects;
DROP POLICY IF EXISTS "Users can view own prospects" ON public.prospects;

CREATE POLICY "Usuários veem prospects RLS" ON public.prospects
FOR SELECT USING (
  vendedor_id = auth.uid() OR
  is_admin_or_supervisor(auth.uid()) OR
  usuario_tem_acesso_prospect(auth.uid(), id)
);

CREATE POLICY "Usuários gerenciam prospects RLS" ON public.prospects
FOR ALL USING (
  vendedor_id = auth.uid() OR 
  has_role(auth.uid(), 'admin')
);

-- 4. STORES - Garantir RLS
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários veem lojas permitidas" ON public.stores;
DROP POLICY IF EXISTS "Usuários gerenciam lojas permitidas" ON public.stores;
DROP POLICY IF EXISTS "Users can view accessible stores" ON public.stores;

CREATE POLICY "Usuários veem lojas RLS" ON public.stores
FOR SELECT USING (
  usuario_tem_acesso_loja(auth.uid(), id) OR
  is_admin_or_supervisor(auth.uid())
);

CREATE POLICY "Usuários gerenciam lojas RLS" ON public.stores
FOR ALL USING (
  created_by = auth.uid() OR
  vendedor_id = auth.uid() OR
  is_admin_or_supervisor(auth.uid())
);

-- 5. SALES - Garantir RLS
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vendedores veem próprias vendas" ON public.sales;
DROP POLICY IF EXISTS "Vendedores gerenciam próprias vendas" ON public.sales;

CREATE POLICY "Vendedores veem vendas RLS" ON public.sales
FOR SELECT USING (
  salesperson_id = auth.uid() OR
  created_by = auth.uid() OR
  is_admin_or_supervisor(auth.uid())
);

CREATE POLICY "Vendedores gerenciam vendas RLS" ON public.sales
FOR ALL USING (
  salesperson_id = auth.uid() OR
  created_by = auth.uid() OR
  has_role(auth.uid(), 'admin')
);

-- 6. TRADE_INVESTMENTS - Garantir RLS
ALTER TABLE public.trade_investments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários veem investimentos de lojas permitidas" ON public.trade_investments;
DROP POLICY IF EXISTS "Admins gerenciam investimentos" ON public.trade_investments;

CREATE POLICY "Usuários veem investimentos RLS" ON public.trade_investments
FOR SELECT USING (
  created_by = auth.uid() OR
  is_admin_or_supervisor(auth.uid())
);

CREATE POLICY "Admins gerenciam investimentos RLS" ON public.trade_investments
FOR ALL USING (is_admin_or_supervisor(auth.uid()));

-- 7. FABRICA_MATERIAS_PRIMAS - Garantir RLS
ALTER TABLE public.fabrica_materias_primas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários fabrica veem MPs" ON public.fabrica_materias_primas;
DROP POLICY IF EXISTS "Admins gerenciam MPs" ON public.fabrica_materias_primas;

CREATE POLICY "Usuários fabrica veem MPs RLS" ON public.fabrica_materias_primas
FOR SELECT USING (usuario_tem_permissao_modulo(auth.uid(), 'fabrica'));

CREATE POLICY "Admins gerenciam MPs RLS" ON public.fabrica_materias_primas
FOR ALL USING (is_admin_or_supervisor(auth.uid()));

-- 8. FABRICA_PRODUTOS - Melhorar RLS
DROP POLICY IF EXISTS "Usuários autenticados podem ver produtos" ON public.fabrica_produtos;

CREATE POLICY "Usuários fabrica veem produtos RLS" ON public.fabrica_produtos
FOR SELECT USING (usuario_tem_permissao_modulo(auth.uid(), 'fabrica'));

-- 9. FABRICA_FORMULAS - Garantir RLS
ALTER TABLE public.fabrica_formulas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários fabrica veem fórmulas" ON public.fabrica_formulas;
DROP POLICY IF EXISTS "Admins gerenciam fórmulas" ON public.fabrica_formulas;

CREATE POLICY "Usuários fabrica veem fórmulas RLS" ON public.fabrica_formulas
FOR SELECT USING (usuario_tem_permissao_modulo(auth.uid(), 'fabrica'));

CREATE POLICY "Admins gerenciam fórmulas RLS" ON public.fabrica_formulas
FOR ALL USING (is_admin_or_supervisor(auth.uid()));

-- 10. TRADE_BUDGETS - Garantir RLS
ALTER TABLE public.trade_budgets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários trade veem verbas" ON public.trade_budgets;
DROP POLICY IF EXISTS "Admins gerenciam verbas" ON public.trade_budgets;

CREATE POLICY "Usuários veem verbas RLS" ON public.trade_budgets
FOR SELECT USING (
  created_by = auth.uid() OR 
  is_admin_or_supervisor(auth.uid())
);

CREATE POLICY "Admins gerenciam verbas RLS" ON public.trade_budgets
FOR ALL USING (is_admin_or_supervisor(auth.uid()));

-- 11. TRANSACOES_FINANCEIRAS - Garantir RLS
ALTER TABLE public.transacoes_financeiras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins veem transacoes" ON public.transacoes_financeiras;
DROP POLICY IF EXISTS "Admins gerenciam transacoes" ON public.transacoes_financeiras;

CREATE POLICY "Admins veem transacoes RLS" ON public.transacoes_financeiras
FOR SELECT USING (is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Admins gerenciam transacoes RLS" ON public.transacoes_financeiras
FOR ALL USING (has_role(auth.uid(), 'admin'));