-- =====================================================
-- PASSO 0: Inserir módulos lowercase que faltam
-- =====================================================

INSERT INTO modulos_sistema (codigo, nome, descricao, icone, ordem, ativo)
SELECT 'relatorios', 'Relatórios', 'Módulo de relatórios', 'FileText', 99, true
WHERE NOT EXISTS (SELECT 1 FROM modulos_sistema WHERE codigo = 'relatorios');

-- =====================================================
-- PASSO 1: Atualizar referências de telas para lowercase
-- =====================================================

UPDATE telas_sistema SET modulo_codigo = LOWER(modulo_codigo) 
WHERE modulo_codigo != LOWER(modulo_codigo);

-- =====================================================
-- PASSO 2: Deletar módulos uppercase duplicados
-- =====================================================

DELETE FROM modulos_sistema 
WHERE codigo IN ('MARKETING', 'PROSPECTS', 'RELATORIOS', 'TRADE');

-- =====================================================
-- PASSO 3: Cadastrar Telas do Módulo Financeiro
-- =====================================================

INSERT INTO telas_sistema (codigo, nome, rota, modulo_codigo, icone, ordem, ativo)
SELECT * FROM (VALUES
  ('financeiro_dashboard', 'Dashboard Financeiro', '/dashboard/financeiro', 'financeiro', 'DollarSign', 1, true),
  ('financeiro_dre', 'DRE Analítico', '/dashboard/financeiro/dre-analitico', 'financeiro', 'FileText', 2, true),
  ('financeiro_departamentos', 'Visão Departamentos', '/dashboard/financeiro/visao-departamentos', 'financeiro', 'Building2', 3, true),
  ('financeiro_verbas', 'Gestão de Verbas', '/dashboard/financeiro/trade', 'financeiro', 'Store', 4, true),
  ('financeiro_contas_pagar', 'Contas a Pagar', '/dashboard/financeiro/contas-a-pagar', 'financeiro', 'Receipt', 5, true),
  ('financeiro_contas_receber', 'Contas a Receber', '/dashboard/financeiro/contas-a-receber', 'financeiro', 'DollarSign', 6, true),
  ('financeiro_fluxo_caixa', 'Fluxo de Caixa', '/dashboard/financeiro/fluxo-de-caixa', 'financeiro', 'TrendingUp', 7, true),
  ('financeiro_plano_contas', 'Plano de Contas', '/dashboard/financeiro/plano-contas', 'financeiro', 'List', 8, true),
  ('financeiro_classificar', 'Classificar Banco', '/dashboard/financeiro/classificar-banco', 'financeiro', 'ClipboardCheck', 9, true),
  ('financeiro_cobrancas', 'Gestão de Cobranças', '/dashboard/financeiro/gestao-cobrancas', 'financeiro', 'MessageSquare', 10, true),
  ('financeiro_credito', 'Análise de Crédito', '/dashboard/financeiro/analise-credito', 'financeiro', 'ShieldCheck', 11, true)
) AS v(codigo, nome, rota, modulo_codigo, icone, ordem, ativo)
WHERE NOT EXISTS (SELECT 1 FROM telas_sistema WHERE codigo = v.codigo);

-- =====================================================
-- PASSO 4: Dropar e recriar função RPC de permissões
-- =====================================================

DROP FUNCTION IF EXISTS get_all_user_permissions(UUID);

CREATE FUNCTION get_all_user_permissions(p_user_id UUID)
RETURNS TABLE(
  modules TEXT[],
  screens TEXT[],
  role TEXT,
  is_admin BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_is_admin BOOLEAN;
  v_department_id UUID;
  v_modules TEXT[];
  v_screens TEXT[];
BEGIN
  SELECT ur.role INTO v_role FROM user_roles ur WHERE ur.user_id = p_user_id LIMIT 1;
  
  IF v_role IS NULL THEN
    RETURN QUERY SELECT ARRAY[]::TEXT[], ARRAY[]::TEXT[], NULL::TEXT, FALSE;
    RETURN;
  END IF;
  
  v_is_admin := (v_role = 'admin');
  
  IF v_is_admin THEN
    SELECT ARRAY_AGG(DISTINCT codigo) INTO v_modules FROM modulos_sistema WHERE ativo = true;
    SELECT ARRAY_AGG(DISTINCT codigo) INTO v_screens FROM telas_sistema WHERE ativo = true;
    RETURN QUERY SELECT COALESCE(v_modules, ARRAY[]::TEXT[]), COALESCE(v_screens, ARRAY[]::TEXT[]), v_role, TRUE;
    RETURN;
  END IF;
  
  SELECT p.departamento_id INTO v_department_id FROM profiles p WHERE p.id = p_user_id;
  
  IF v_department_id IS NOT NULL THEN
    -- COM departamento: APENAS permissões do departamento + individuais (IGNORA role!)
    SELECT ARRAY_AGG(DISTINCT modulo) INTO v_modules FROM (
      SELECT dpm.modulo_codigo AS modulo FROM departamento_permissoes_modulos dpm WHERE dpm.departamento_id = v_department_id
      UNION
      SELECT upm.modulo_codigo AS modulo FROM usuario_permissoes_modulos upm WHERE upm.user_id = p_user_id
    ) sub;
    
    SELECT ARRAY_AGG(DISTINCT tela) INTO v_screens FROM (
      SELECT ts.codigo AS tela FROM departamento_permissoes_telas dpt
      JOIN telas_sistema ts ON ts.id = dpt.tela_id
      WHERE dpt.departamento_id = v_department_id AND ts.ativo = true
      UNION
      SELECT ts.codigo AS tela FROM usuario_permissoes_telas upt
      JOIN telas_sistema ts ON ts.id = upt.tela_id
      WHERE upt.user_id = p_user_id AND ts.ativo = true
    ) sub;
  ELSE
    -- SEM departamento: permissões do ROLE + individuais
    SELECT ARRAY_AGG(DISTINCT modulo) INTO v_modules FROM (
      SELECT rpm.modulo_codigo AS modulo FROM role_permissoes_modulos rpm WHERE rpm.role = v_role
      UNION
      SELECT upm.modulo_codigo AS modulo FROM usuario_permissoes_modulos upm WHERE upm.user_id = p_user_id
    ) sub;
    
    SELECT ARRAY_AGG(DISTINCT tela) INTO v_screens FROM (
      SELECT ts.codigo AS tela FROM role_permissoes_telas rpt
      JOIN telas_sistema ts ON ts.id = rpt.tela_id
      WHERE rpt.role = v_role AND ts.ativo = true
      UNION
      SELECT ts.codigo AS tela FROM usuario_permissoes_telas upt
      JOIN telas_sistema ts ON ts.id = upt.tela_id
      WHERE upt.user_id = p_user_id AND ts.ativo = true
    ) sub;
  END IF;
  
  RETURN QUERY SELECT COALESCE(v_modules, ARRAY[]::TEXT[]), COALESCE(v_screens, ARRAY[]::TEXT[]), v_role, FALSE;
END;
$$;

-- =====================================================
-- PASSO 5: Criar tabelas de permissões do departamento
-- =====================================================

CREATE TABLE IF NOT EXISTS departamento_permissoes_modulos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  departamento_id UUID NOT NULL REFERENCES departamentos(id) ON DELETE CASCADE,
  modulo_codigo TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(departamento_id, modulo_codigo)
);

CREATE TABLE IF NOT EXISTS departamento_permissoes_telas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  departamento_id UUID NOT NULL REFERENCES departamentos(id) ON DELETE CASCADE,
  tela_id UUID NOT NULL REFERENCES telas_sistema(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(departamento_id, tela_id)
);

ALTER TABLE departamento_permissoes_modulos ENABLE ROW LEVEL SECURITY;
ALTER TABLE departamento_permissoes_telas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage departamento_permissoes_modulos" ON departamento_permissoes_modulos;
CREATE POLICY "Admins manage departamento_permissoes_modulos" ON departamento_permissoes_modulos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage departamento_permissoes_telas" ON departamento_permissoes_telas;
CREATE POLICY "Admins manage departamento_permissoes_telas" ON departamento_permissoes_telas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Auth read departamento_permissoes_modulos" ON departamento_permissoes_modulos;
CREATE POLICY "Auth read departamento_permissoes_modulos" ON departamento_permissoes_modulos FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Auth read departamento_permissoes_telas" ON departamento_permissoes_telas;
CREATE POLICY "Auth read departamento_permissoes_telas" ON departamento_permissoes_telas FOR SELECT TO authenticated USING (true);