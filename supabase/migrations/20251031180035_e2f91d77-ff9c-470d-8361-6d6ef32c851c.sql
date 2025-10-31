-- ========================================
-- CORREÇÕES DE SEGURANÇA PARA PRODUÇÃO (PARTE 1 - LIMPEZA COMPLETA)
-- ========================================

-- 1. REMOVER TODOS OS TRIGGERS DE PONTOS EXISTENTES
-- ========================================
DROP TRIGGER IF EXISTS points_financial_entry ON trade_financial_entries CASCADE;
DROP TRIGGER IF EXISTS points_visit_complete ON visits CASCADE;
DROP TRIGGER IF EXISTS points_photo_approval ON photos CASCADE;
DROP TRIGGER IF EXISTS points_shelf_measurement ON shelf_measurements CASCADE;
DROP TRIGGER IF EXISTS points_audit_complete ON gondola_audits CASCADE;

-- 2. CORRIGIR FUNÇÕES SEM search_path DEFINIDO
-- ========================================

CREATE OR REPLACE FUNCTION public.calculate_user_level(points integer)
RETURNS TABLE(level_number integer, level_name character varying)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE 
      WHEN points < 500 THEN 1
      WHEN points < 1500 THEN 2
      WHEN points < 3000 THEN 3
      WHEN points < 5000 THEN 4
      ELSE 5
    END AS level_number,
    CASE 
      WHEN points < 500 THEN 'Bronze'
      WHEN points < 1500 THEN 'Prata'
      WHEN points < 3000 THEN 'Ouro'
      WHEN points < 5000 THEN 'Platina'
      ELSE 'Elite'
    END AS level_name;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_update_rankings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM update_user_ranking(NEW.user_id, 'monthly', NEW.period_month);
  PERFORM update_user_ranking(
    NEW.user_id, 
    'quarterly', 
    LEFT(NEW.period_month, 4) || '-Q' || CEILING(CAST(RIGHT(NEW.period_month, 2) AS INTEGER) / 3.0)
  );
  PERFORM update_user_ranking(NEW.user_id, 'yearly', LEFT(NEW.period_month, 4));
  PERFORM update_user_ranking(NEW.user_id, 'all_time', 'all');
  
  RETURN NEW;
END;
$$;

-- 3. REVOGAR ACESSO PÚBLICO ÀS VIEWS MATERIALIZADAS
-- ========================================

REVOKE SELECT ON public.mv_sales_performance FROM anon;
REVOKE SELECT ON public.mv_conversion_funnel FROM anon;
REVOKE SELECT ON public.mv_trade_performance FROM anon;

GRANT SELECT ON public.mv_sales_performance TO authenticated;
GRANT SELECT ON public.mv_conversion_funnel TO authenticated;
GRANT SELECT ON public.mv_trade_performance TO authenticated;

-- 4. FORTALECER RLS POLICIES EM TABELAS CRÍTICAS
-- ========================================

-- Garantir que profiles tem RLS habilitado e policies corretas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT
  USING (
    auth.uid() = id 
    OR is_admin_or_supervisor(auth.uid())
  );

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE
  USING (
    auth.uid() = id 
    OR is_admin_or_supervisor(auth.uid())
  );

-- Garantir que user_roles tem RLS habilitado e policies corretas
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can manage roles" ON user_roles;
CREATE POLICY "Admin can manage roles" ON user_roles
  FOR ALL
  USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can view own role" ON user_roles;
CREATE POLICY "Users can view own role" ON user_roles
  FOR SELECT
  USING (
    auth.uid() = user_id 
    OR has_role(auth.uid(), 'admin')
  );

-- 5. GARANTIR RLS EM TODAS AS TABELAS SENSÍVEIS
-- ========================================

ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE shelf_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE gondola_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_financial_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_points_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_rankings ENABLE ROW LEVEL SECURITY;