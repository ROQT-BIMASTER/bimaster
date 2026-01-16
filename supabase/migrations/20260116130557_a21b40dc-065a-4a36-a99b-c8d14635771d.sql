
-- =====================================================
-- CORREÇÃO DE SEGURANÇA: RLS para todas as tabelas expostas - PARTE 1
-- =====================================================

-- 1. PROFILES - Restringir acesso ao próprio perfil ou admin/supervisor
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;

CREATE POLICY "Users can view own profile or admin"
ON public.profiles FOR SELECT
TO authenticated
USING (
  id = auth.uid() OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor')
);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- 2. CONTAS_PAGAR - Apenas financeiro, admin, supervisor
ALTER TABLE public.contas_pagar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view contas_pagar" ON public.contas_pagar;
DROP POLICY IF EXISTS "Finance can manage contas_pagar" ON public.contas_pagar;
DROP POLICY IF EXISTS "Finance and admins can view contas_pagar" ON public.contas_pagar;
DROP POLICY IF EXISTS "Finance and admins can insert contas_pagar" ON public.contas_pagar;
DROP POLICY IF EXISTS "Finance and admins can update contas_pagar" ON public.contas_pagar;
DROP POLICY IF EXISTS "Finance and admins can delete contas_pagar" ON public.contas_pagar;

CREATE POLICY "Finance and admins can view contas_pagar"
ON public.contas_pagar FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'financeiro')
);

CREATE POLICY "Finance and admins can insert contas_pagar"
ON public.contas_pagar FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'financeiro')
);

CREATE POLICY "Finance and admins can update contas_pagar"
ON public.contas_pagar FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'financeiro')
);

CREATE POLICY "Finance and admins can delete contas_pagar"
ON public.contas_pagar FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor')
);

-- 3. CONTAS_RECEBER - Apenas financeiro, admin, supervisor
ALTER TABLE public.contas_receber ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view contas_receber" ON public.contas_receber;
DROP POLICY IF EXISTS "Finance and admins can view contas_receber" ON public.contas_receber;
DROP POLICY IF EXISTS "Finance and admins can insert contas_receber" ON public.contas_receber;
DROP POLICY IF EXISTS "Finance and admins can update contas_receber" ON public.contas_receber;
DROP POLICY IF EXISTS "Finance and admins can delete contas_receber" ON public.contas_receber;

CREATE POLICY "Finance and admins can view contas_receber"
ON public.contas_receber FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'financeiro')
);

CREATE POLICY "Finance and admins can insert contas_receber"
ON public.contas_receber FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'financeiro')
);

CREATE POLICY "Finance and admins can update contas_receber"
ON public.contas_receber FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'financeiro')
);

CREATE POLICY "Finance and admins can delete contas_receber"
ON public.contas_receber FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor')
);

-- 4. ADS_ACCOUNTS - Apenas marketing, admin, supervisor
ALTER TABLE public.ads_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own ads accounts" ON public.ads_accounts;
DROP POLICY IF EXISTS "Marketing and admins can view ads_accounts" ON public.ads_accounts;
DROP POLICY IF EXISTS "Users can manage own ads_accounts" ON public.ads_accounts;
DROP POLICY IF EXISTS "Admins can manage all ads_accounts" ON public.ads_accounts;

CREATE POLICY "Users can view own ads_accounts or marketing"
ON public.ads_accounts FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'marketing')
);

CREATE POLICY "Users can insert own ads_accounts"
ON public.ads_accounts FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() OR
  public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Users can update own ads_accounts"
ON public.ads_accounts FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid() OR
  public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can delete ads_accounts"
ON public.ads_accounts FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
);

-- 5. SALES - Vendedor vê próprias vendas, supervisor vê equipe, admin vê tudo
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view sales" ON public.sales;
DROP POLICY IF EXISTS "Users can view own sales or team sales" ON public.sales;
DROP POLICY IF EXISTS "Users can insert sales" ON public.sales;
DROP POLICY IF EXISTS "Users can update own sales" ON public.sales;

CREATE POLICY "Users can view sales based on role"
ON public.sales FOR SELECT
TO authenticated
USING (
  vendedor_id = auth.uid() OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'vendas')
);

CREATE POLICY "Users can insert sales"
ON public.sales FOR INSERT
TO authenticated
WITH CHECK (
  vendedor_id = auth.uid() OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor')
);

CREATE POLICY "Users can update sales based on role"
ON public.sales FOR UPDATE
TO authenticated
USING (
  vendedor_id = auth.uid() OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor')
);

CREATE POLICY "Admins can delete sales"
ON public.sales FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor')
);

-- Revogar acesso anônimo às tabelas
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.contas_pagar FROM anon;
REVOKE ALL ON public.contas_receber FROM anon;
REVOKE ALL ON public.ads_accounts FROM anon;
REVOKE ALL ON public.sales FROM anon;
