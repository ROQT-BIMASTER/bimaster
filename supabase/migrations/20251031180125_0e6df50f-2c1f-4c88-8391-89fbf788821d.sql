-- ========================================
-- CORREÇÕES DE SEGURANÇA PARA PRODUÇÃO
-- ========================================

-- 1. CORRIGIR FUNÇÕES SEM search_path DEFINIDO
-- ========================================

-- Atualizar função calculate_user_level
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

-- Atualizar função trigger_update_rankings
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

-- 2. REVOGAR ACESSO PÚBLICO ÀS VIEWS MATERIALIZADAS
-- ========================================

-- Revogar acesso do role anon (público) às views materializadas
REVOKE SELECT ON public.mv_sales_performance FROM anon;
REVOKE SELECT ON public.mv_conversion_funnel FROM anon;
REVOKE SELECT ON public.mv_trade_performance FROM anon;

-- Apenas authenticated users podem ver as views
GRANT SELECT ON public.mv_sales_performance TO authenticated;
GRANT SELECT ON public.mv_conversion_funnel TO authenticated;
GRANT SELECT ON public.mv_trade_performance TO authenticated;

-- 3. LIMPAR TODOS OS TRIGGERS RELACIONADOS A PONTOS
-- ========================================

-- Remover TODOS os triggers antigos de pontos
DROP TRIGGER IF EXISTS points_financial_entry ON trade_financial_entries CASCADE;
DROP TRIGGER IF EXISTS points_visit_complete ON visits CASCADE;
DROP TRIGGER IF EXISTS points_photo_approval ON photos CASCADE;
DROP TRIGGER IF EXISTS points_shelf_measurement ON shelf_measurements CASCADE;
DROP TRIGGER IF EXISTS points_audit_complete ON gondola_audits CASCADE;
DROP TRIGGER IF EXISTS financial_entry_points_trigger ON trade_financial_entries CASCADE;
DROP TRIGGER IF EXISTS visit_points_trigger ON visits CASCADE;
DROP TRIGGER IF EXISTS photo_points_trigger ON photos CASCADE;
DROP TRIGGER IF EXISTS shelf_measurement_points_trigger ON shelf_measurements CASCADE;
DROP TRIGGER IF EXISTS audit_points_trigger ON gondola_audits CASCADE;
DROP TRIGGER IF EXISTS financial_entry_points_v2_trigger ON trade_financial_entries CASCADE;
DROP TRIGGER IF EXISTS visit_points_v2_trigger ON visits CASCADE;
DROP TRIGGER IF EXISTS photo_points_v2_trigger ON photos CASCADE;
DROP TRIGGER IF EXISTS shelf_measurement_points_v2_trigger ON shelf_measurements CASCADE;
DROP TRIGGER IF EXISTS audit_points_v2_trigger ON gondola_audits CASCADE;

-- Remover funções antigas duplicadas (se existirem)
DROP FUNCTION IF EXISTS trigger_financial_entry_points() CASCADE;
DROP FUNCTION IF EXISTS trigger_visit_points() CASCADE;
DROP FUNCTION IF EXISTS trigger_photo_points() CASCADE;
DROP FUNCTION IF EXISTS trigger_shelf_measurement_points() CASCADE;
DROP FUNCTION IF EXISTS trigger_audit_points() CASCADE;
DROP FUNCTION IF EXISTS trigger_financial_entry_points_v2() CASCADE;
DROP FUNCTION IF EXISTS trigger_visit_points_v2() CASCADE;
DROP FUNCTION IF EXISTS trigger_photo_points_v2() CASCADE;
DROP FUNCTION IF EXISTS trigger_shelf_measurement_points_v2() CASCADE;
DROP FUNCTION IF EXISTS trigger_audit_points_v2() CASCADE;
DROP FUNCTION IF EXISTS points_on_visit_complete() CASCADE;
DROP FUNCTION IF EXISTS points_on_photo_approval() CASCADE;
DROP FUNCTION IF EXISTS points_on_shelf_measurement() CASCADE;
DROP FUNCTION IF EXISTS points_on_audit_complete() CASCADE;

-- 4. RECRIAR TRIGGERS DE PONTOS DE FORMA LIMPA
-- ========================================

-- Criar função para visitas
CREATE FUNCTION points_on_visit_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' 
     AND (OLD IS NULL OR OLD.status != 'completed')
     AND NEW.user_id IS NOT NULL THEN
    
    BEGIN
      PERFORM register_action_points(
        NEW.user_id,
        'visit_complete',
        'visit',
        NEW.id,
        jsonb_build_object(
          'store_id', NEW.store_id,
          'created_at', NEW.created_at
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Erro ao registrar pontos visita: %', SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar função para fotos
CREATE FUNCTION points_on_photo_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.approved = true 
     AND (OLD IS NULL OR OLD.approved = false) 
     AND NEW.vendedor_id IS NOT NULL THEN
    
    BEGIN
      PERFORM register_action_points(
        NEW.vendedor_id,
        'photo_upload',
        'photo',
        NEW.id,
        jsonb_build_object(
          'store_id', NEW.store_id,
          'visit_id', NEW.visit_id
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Erro ao registrar pontos foto: %', SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar função para medições
CREATE FUNCTION points_on_shelf_measurement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.vendedor_id IS NOT NULL THEN
    BEGIN
      PERFORM register_action_points(
        NEW.vendedor_id,
        'shelf_measurement',
        'shelf_measurement',
        NEW.id,
        jsonb_build_object(
          'store_id', NEW.store_id,
          'shelf_share_percentage', NEW.shelf_share_percentage
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Erro ao registrar pontos medição: %', SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar função para auditorias
CREATE FUNCTION points_on_audit_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.vendedor_id IS NOT NULL THEN
    BEGIN
      PERFORM register_action_points(
        NEW.vendedor_id,
        'audit_complete',
        'gondola_audit',
        NEW.id,
        jsonb_build_object(
          'store_id', NEW.store_id,
          'compliance_score', NEW.overall_compliance_score
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Erro ao registrar pontos auditoria: %', SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Agora criar os triggers (já removemos todos acima)
CREATE TRIGGER points_financial_entry
  AFTER INSERT OR UPDATE OF approval_status
  ON trade_financial_entries
  FOR EACH ROW
  EXECUTE FUNCTION points_on_financial_approval();

CREATE TRIGGER points_visit_complete
  AFTER INSERT OR UPDATE OF status
  ON visits
  FOR EACH ROW
  EXECUTE FUNCTION points_on_visit_complete();

CREATE TRIGGER points_photo_approval
  AFTER INSERT OR UPDATE OF approved
  ON photos
  FOR EACH ROW
  EXECUTE FUNCTION points_on_photo_approval();

CREATE TRIGGER points_shelf_measurement
  AFTER INSERT
  ON shelf_measurements
  FOR EACH ROW
  EXECUTE FUNCTION points_on_shelf_measurement();

CREATE TRIGGER points_audit_complete
  AFTER INSERT
  ON gondola_audits
  FOR EACH ROW
  EXECUTE FUNCTION points_on_audit_complete();

-- 5. FORTALECER RLS POLICIES
-- ========================================

-- Garantir RLS habilitado
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE shelf_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE gondola_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_financial_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_points_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_rankings ENABLE ROW LEVEL SECURITY;

-- Policies para profiles
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

-- Policies para user_roles
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

-- 6. DOCUMENTAÇÃO
-- ========================================

COMMENT ON FUNCTION points_on_financial_approval() IS 
  'Registra pontos quando um lançamento financeiro é aprovado. Seguro contra falhas.';

COMMENT ON FUNCTION points_on_visit_complete() IS 
  'Registra pontos quando uma visita é completada. Seguro contra falhas.';

COMMENT ON FUNCTION points_on_photo_approval() IS 
  'Registra pontos quando uma foto é aprovada. Seguro contra falhas.';

COMMENT ON FUNCTION points_on_shelf_measurement() IS 
  'Registra pontos quando uma medição de prateleira é criada. Seguro contra falhas.';

COMMENT ON FUNCTION points_on_audit_complete() IS 
  'Registra pontos quando uma auditoria é criada. Seguro contra falhas.';