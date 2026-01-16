
-- =====================================================
-- CORREÇÃO DE SEGURANÇA - TABELAS MARKETING E OUTRAS CRÍTICAS
-- =====================================================

-- MARKETING_CAMPANHAS
ALTER TABLE public.marketing_campanhas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Marketing can view campanhas"
ON public.marketing_campanhas FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'marketing')
);

CREATE POLICY "Marketing can manage campanhas"
ON public.marketing_campanhas FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'marketing')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'marketing')
);

-- DEPARTAMENTOS
ALTER TABLE public.departamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view departamentos"
ON public.departamentos FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage departamentos"
ON public.departamentos FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- MODULOS_SISTEMA - Acesso de leitura para todos autenticados
ALTER TABLE public.modulos_sistema ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view modulos"
ON public.modulos_sistema FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage modulos"
ON public.modulos_sistema FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- TELAS_SISTEMA
ALTER TABLE public.telas_sistema ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view telas"
ON public.telas_sistema FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage telas"
ON public.telas_sistema FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- USUARIO_PERMISSOES_MODULOS
ALTER TABLE public.usuario_permissoes_modulos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own module permissions or admins all"
ON public.usuario_permissoes_modulos FOR SELECT
TO authenticated
USING (
  usuario_id = auth.uid() OR
  public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can manage module permissions"
ON public.usuario_permissoes_modulos FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- USUARIO_PERMISSOES_TELAS
ALTER TABLE public.usuario_permissoes_telas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own screen permissions or admins all"
ON public.usuario_permissoes_telas FOR SELECT
TO authenticated
USING (
  usuario_id = auth.uid() OR
  public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can manage screen permissions"
ON public.usuario_permissoes_telas FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ROLE_PERMISSOES_MODULOS
ALTER TABLE public.role_permissoes_modulos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view role module permissions"
ON public.role_permissoes_modulos FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage role module permissions"
ON public.role_permissoes_modulos FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ROLE_PERMISSOES_TELAS
ALTER TABLE public.role_permissoes_telas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view role screen permissions"
ON public.role_permissoes_telas FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage role screen permissions"
ON public.role_permissoes_telas FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- DEPARTAMENTO_PERMISSOES_MODULOS
ALTER TABLE public.departamento_permissoes_modulos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view dept module permissions"
ON public.departamento_permissoes_modulos FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage dept module permissions"
ON public.departamento_permissoes_modulos FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- DEPARTAMENTO_PERMISSOES_TELAS
ALTER TABLE public.departamento_permissoes_telas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view dept screen permissions"
ON public.departamento_permissoes_telas FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage dept screen permissions"
ON public.departamento_permissoes_telas FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- CLIENTES_SCORE_HISTORICO
ALTER TABLE public.clientes_score_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance can view score history"
ON public.clientes_score_historico FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'financeiro')
);

CREATE POLICY "Finance can insert score history"
ON public.clientes_score_historico FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'financeiro')
);

-- FILA_COBRANCAS
ALTER TABLE public.fila_cobrancas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance can view fila cobrancas"
ON public.fila_cobrancas FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'financeiro')
);

CREATE POLICY "Finance can manage fila cobrancas"
ON public.fila_cobrancas FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'financeiro')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'financeiro')
);

-- Revogar acesso anônimo
REVOKE ALL ON public.marketing_campanhas FROM anon;
REVOKE ALL ON public.departamentos FROM anon;
REVOKE ALL ON public.modulos_sistema FROM anon;
REVOKE ALL ON public.telas_sistema FROM anon;
REVOKE ALL ON public.usuario_permissoes_modulos FROM anon;
REVOKE ALL ON public.usuario_permissoes_telas FROM anon;
REVOKE ALL ON public.role_permissoes_modulos FROM anon;
REVOKE ALL ON public.role_permissoes_telas FROM anon;
REVOKE ALL ON public.departamento_permissoes_modulos FROM anon;
REVOKE ALL ON public.departamento_permissoes_telas FROM anon;
REVOKE ALL ON public.clientes_score_historico FROM anon;
REVOKE ALL ON public.fila_cobrancas FROM anon;
