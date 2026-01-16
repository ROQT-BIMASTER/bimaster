
-- =====================================================
-- CORREÇÃO DE SEGURANÇA: RLS para todas as tabelas expostas - PARTE 2
-- =====================================================

-- 6. COBRANCAS - Apenas financeiro, admin, supervisor
ALTER TABLE public.cobrancas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view cobrancas" ON public.cobrancas;
DROP POLICY IF EXISTS "Finance and admins can view cobrancas" ON public.cobrancas;
DROP POLICY IF EXISTS "Finance and admins can manage cobrancas" ON public.cobrancas;

CREATE POLICY "Finance and admins can view cobrancas"
ON public.cobrancas FOR SELECT
TO authenticated
USING (
  responsavel_id = auth.uid() OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'financeiro')
);

CREATE POLICY "Finance and admins can insert cobrancas"
ON public.cobrancas FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'financeiro')
);

CREATE POLICY "Finance and admins can update cobrancas"
ON public.cobrancas FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'financeiro')
);

CREATE POLICY "Finance and admins can delete cobrancas"
ON public.cobrancas FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor')
);

-- 7. CLIENTES - Acesso baseado em módulos
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view clientes" ON public.clientes;
DROP POLICY IF EXISTS "Admins and supervisors can manage clientes" ON public.clientes;

CREATE POLICY "Users can view clientes based on modules"
ON public.clientes FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'vendas') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'financeiro')
);

CREATE POLICY "Admins and supervisors can insert clientes"
ON public.clientes FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor')
);

CREATE POLICY "Admins and supervisors can update clientes"
ON public.clientes FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor')
);

CREATE POLICY "Admins can delete clientes"
ON public.clientes FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
);

-- 8. CLIENTES_PERFIL_CREDITO - Apenas financeiro, admin, supervisor
ALTER TABLE public.clientes_perfil_credito ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view credit profiles" ON public.clientes_perfil_credito;
DROP POLICY IF EXISTS "Finance and admins can view credit profiles" ON public.clientes_perfil_credito;
DROP POLICY IF EXISTS "Finance and admins can manage credit profiles" ON public.clientes_perfil_credito;

CREATE POLICY "Finance and admins can view credit profiles"
ON public.clientes_perfil_credito FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'financeiro')
);

CREATE POLICY "Finance and admins can insert credit profiles"
ON public.clientes_perfil_credito FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'financeiro')
);

CREATE POLICY "Finance and admins can update credit profiles"
ON public.clientes_perfil_credito FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'financeiro')
);

CREATE POLICY "Finance and admins can delete credit profiles"
ON public.clientes_perfil_credito FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor')
);

-- 9. USER_WHATSAPP - Usuário vê apenas próprio número
ALTER TABLE public.user_whatsapp ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own whatsapp" ON public.user_whatsapp;
DROP POLICY IF EXISTS "Users can manage own whatsapp" ON public.user_whatsapp;
DROP POLICY IF EXISTS "Admins can manage all whatsapp" ON public.user_whatsapp;

CREATE POLICY "Users can view own whatsapp or admin"
ON public.user_whatsapp FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR
  public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Users can insert own whatsapp"
ON public.user_whatsapp FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own whatsapp"
ON public.user_whatsapp FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can delete whatsapp"
ON public.user_whatsapp FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
);

-- 10. FABRICA_MATERIAS_PRIMAS - Apenas fábrica, preços, admin, supervisor
ALTER TABLE public.fabrica_materias_primas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view materias_primas" ON public.fabrica_materias_primas;
DROP POLICY IF EXISTS "Factory and admins can view materias_primas" ON public.fabrica_materias_primas;
DROP POLICY IF EXISTS "Factory and admins can manage materias_primas" ON public.fabrica_materias_primas;

CREATE POLICY "Factory and admins can view materias_primas"
ON public.fabrica_materias_primas FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'fabrica') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'precos')
);

CREATE POLICY "Factory and admins can insert materias_primas"
ON public.fabrica_materias_primas FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'fabrica')
);

CREATE POLICY "Factory and admins can update materias_primas"
ON public.fabrica_materias_primas FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'fabrica')
);

CREATE POLICY "Admins can delete materias_primas"
ON public.fabrica_materias_primas FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor')
);

-- Revogar acesso anônimo
REVOKE ALL ON public.cobrancas FROM anon;
REVOKE ALL ON public.clientes FROM anon;
REVOKE ALL ON public.clientes_perfil_credito FROM anon;
REVOKE ALL ON public.user_whatsapp FROM anon;
REVOKE ALL ON public.fabrica_materias_primas FROM anon;
