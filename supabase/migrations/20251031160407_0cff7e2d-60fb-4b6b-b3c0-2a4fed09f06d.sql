-- ============================================
-- MÓDULO TRADE PERFORMANCE - SISTEMA DE GAMIFICAÇÃO (v2)
-- ============================================

-- Remover objetos existentes se houver
DROP TABLE IF EXISTS public.user_challenge_progress CASCADE;
DROP TABLE IF EXISTS public.trade_challenges CASCADE;
DROP TABLE IF EXISTS public.user_rewards_received CASCADE;
DROP TABLE IF EXISTS public.trade_rewards CASCADE;
DROP TABLE IF EXISTS public.user_rankings CASCADE;
DROP TABLE IF EXISTS public.user_points_history CASCADE;
DROP TABLE IF EXISTS public.trade_action_points CASCADE;

DROP FUNCTION IF EXISTS trigger_update_rankings() CASCADE;
DROP FUNCTION IF EXISTS update_user_ranking(UUID, VARCHAR, VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS register_user_points(UUID, VARCHAR, VARCHAR, UUID, JSONB) CASCADE;
DROP FUNCTION IF EXISTS calculate_user_level(INTEGER) CASCADE;

-- Tabela de configuração de pontos por ação
CREATE TABLE public.trade_action_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_code VARCHAR(50) NOT NULL UNIQUE,
  action_name VARCHAR(200) NOT NULL,
  base_points INTEGER NOT NULL DEFAULT 0,
  multiplier_conditions JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  CONSTRAINT check_base_points_positive CHECK (base_points >= 0)
);

CREATE INDEX idx_trade_action_points_active ON public.trade_action_points(is_active);
CREATE INDEX idx_trade_action_points_code ON public.trade_action_points(action_code);

-- Inserir ações padrão
INSERT INTO public.trade_action_points (action_code, action_name, base_points, multiplier_conditions) VALUES
('visit_complete', 'Visita Completa', 50, '{"quality_bonus": 1.5, "min_compliance": 80}'),
('photo_upload', 'Upload de Foto', 30, '{"quality_score_bonus": 1.3}'),
('audit_complete', 'Auditoria Completa', 100, '{"perfect_score_bonus": 2.0}'),
('shelf_measurement', 'Medição de Gôndola', 80, '{"accuracy_bonus": 1.4}'),
('competitor_intel', 'Inteligência Competitiva', 60, '{"detail_bonus": 1.2}'),
('promotion_check', 'Verificação de Promoção', 40, '{"compliance_bonus": 1.5}'),
('sellout_entry', 'Lançamento Sell Out', 70, '{"volume_bonus": 1.3}'),
('store_update', 'Atualização de Loja', 20, '{}'),
('daily_login', 'Login Diário', 5, '{}'),
('streak_bonus', 'Bônus de Sequência', 0, '{"days_multiplier": 5}');

-- Tabela de histórico de pontos
CREATE TABLE public.user_points_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_code VARCHAR(50) NOT NULL,
  base_points INTEGER NOT NULL,
  multiplier NUMERIC(10,2) DEFAULT 1.0,
  final_points INTEGER NOT NULL,
  metadata JSONB DEFAULT '{}',
  entity_type VARCHAR(50),
  entity_id UUID,
  earned_at TIMESTAMP DEFAULT now(),
  period_month VARCHAR(7) NOT NULL,
  
  CONSTRAINT check_points_positive CHECK (base_points >= 0 AND final_points >= 0),
  CONSTRAINT check_multiplier_positive CHECK (multiplier >= 1.0)
);

CREATE INDEX idx_user_points_user_period ON public.user_points_history(user_id, period_month);
CREATE INDEX idx_user_points_action ON public.user_points_history(action_code);
CREATE INDEX idx_user_points_earned_at ON public.user_points_history(earned_at DESC);
CREATE INDEX idx_user_points_entity ON public.user_points_history(entity_type, entity_id);

-- Tabela de rankings consolidados
CREATE TABLE public.user_rankings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_type VARCHAR(20) NOT NULL,
  period_key VARCHAR(20) NOT NULL,
  total_points INTEGER NOT NULL DEFAULT 0,
  ranking_position INTEGER,
  level_name VARCHAR(50),
  level_number INTEGER DEFAULT 1,
  badges JSONB DEFAULT '[]',
  streak_days INTEGER DEFAULT 0,
  last_activity_date DATE,
  region VARCHAR(100),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  CONSTRAINT check_total_points_positive CHECK (total_points >= 0),
  CONSTRAINT check_level_number_positive CHECK (level_number >= 1),
  UNIQUE(user_id, period_type, period_key)
);

CREATE INDEX idx_user_rankings_period ON public.user_rankings(period_type, period_key);
CREATE INDEX idx_user_rankings_points ON public.user_rankings(period_type, period_key, total_points DESC);
CREATE INDEX idx_user_rankings_user ON public.user_rankings(user_id);
CREATE INDEX idx_user_rankings_region ON public.user_rankings(region, period_type, period_key);

-- Tabela de configuração de recompensas
CREATE TABLE public.trade_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_name VARCHAR(200) NOT NULL,
  description TEXT,
  reward_type VARCHAR(50) NOT NULL,
  min_points INTEGER,
  max_points INTEGER,
  points_value NUMERIC(10,2),
  fixed_amount NUMERIC(10,2),
  period_type VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  requires_approval BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  CONSTRAINT check_points_range CHECK (min_points IS NULL OR max_points IS NULL OR min_points <= max_points)
);

CREATE INDEX idx_trade_rewards_active ON public.trade_rewards(is_active);
CREATE INDEX idx_trade_rewards_period ON public.trade_rewards(period_type);

-- Tabela de recompensas recebidas
CREATE TABLE public.user_rewards_received (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_id UUID REFERENCES public.trade_rewards(id),
  points_used INTEGER NOT NULL,
  amount_received NUMERIC(10,2),
  period_key VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP,
  paid_at TIMESTAMP,
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT now(),
  
  CONSTRAINT check_points_used_positive CHECK (points_used > 0)
);

CREATE INDEX idx_user_rewards_user ON public.user_rewards_received(user_id);
CREATE INDEX idx_user_rewards_status ON public.user_rewards_received(status);
CREATE INDEX idx_user_rewards_period ON public.user_rewards_received(period_key);

-- Tabela de desafios temporais
CREATE TABLE public.trade_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_name VARCHAR(200) NOT NULL,
  description TEXT,
  challenge_type VARCHAR(50) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  target_action_code VARCHAR(50),
  target_quantity INTEGER,
  bonus_points INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT now(),
  
  CONSTRAINT check_challenge_dates CHECK (start_date <= end_date),
  CONSTRAINT check_bonus_points_positive CHECK (bonus_points >= 0)
);

CREATE INDEX idx_trade_challenges_active ON public.trade_challenges(is_active, start_date, end_date);
CREATE INDEX idx_trade_challenges_dates ON public.trade_challenges(start_date, end_date);

-- Tabela de progresso em desafios
CREATE TABLE public.user_challenge_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL REFERENCES public.trade_challenges(id) ON DELETE CASCADE,
  current_progress INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP,
  bonus_awarded BOOLEAN DEFAULT false,
  
  UNIQUE(user_id, challenge_id)
);

CREATE INDEX idx_user_challenge_progress_user ON public.user_challenge_progress(user_id, completed);
CREATE INDEX idx_user_challenge_progress_challenge ON public.user_challenge_progress(challenge_id);

-- Função para calcular nível
CREATE OR REPLACE FUNCTION calculate_user_level(points INTEGER)
RETURNS TABLE(level_number INTEGER, level_name VARCHAR) AS $$
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
$$ LANGUAGE plpgsql;

-- Função para registrar pontos
CREATE OR REPLACE FUNCTION register_user_points(
  p_user_id UUID,
  p_action_code VARCHAR,
  p_entity_type VARCHAR DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS INTEGER AS $$
DECLARE
  v_base_points INTEGER;
  v_multiplier NUMERIC := 1.0;
  v_final_points INTEGER;
  v_period_month VARCHAR(7);
BEGIN
  SELECT base_points INTO v_base_points
  FROM trade_action_points
  WHERE action_code = p_action_code AND is_active = true;
  
  IF v_base_points IS NULL THEN
    RETURN 0;
  END IF;
  
  v_period_month := to_char(CURRENT_DATE, 'YYYY-MM');
  v_final_points := FLOOR(v_base_points * v_multiplier);
  
  INSERT INTO user_points_history (
    user_id, action_code, base_points, multiplier, final_points,
    metadata, entity_type, entity_id, period_month
  ) VALUES (
    p_user_id, p_action_code, v_base_points, v_multiplier, v_final_points,
    p_metadata, p_entity_type, p_entity_id, v_period_month
  );
  
  RETURN v_final_points;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para atualizar rankings
CREATE OR REPLACE FUNCTION update_user_ranking(p_user_id UUID, p_period_type VARCHAR, p_period_key VARCHAR)
RETURNS VOID AS $$
DECLARE
  v_total_points INTEGER;
  v_level_info RECORD;
BEGIN
  SELECT COALESCE(SUM(final_points), 0) INTO v_total_points
  FROM user_points_history
  WHERE user_id = p_user_id
    AND (
      (p_period_type = 'monthly' AND period_month = p_period_key) OR
      (p_period_type = 'quarterly' AND LEFT(period_month, 4) || '-Q' || CEILING(CAST(RIGHT(period_month, 2) AS INTEGER) / 3.0) = p_period_key) OR
      (p_period_type = 'yearly' AND LEFT(period_month, 4) = p_period_key) OR
      (p_period_type = 'all_time')
    );
  
  SELECT * INTO v_level_info FROM calculate_user_level(v_total_points);
  
  INSERT INTO user_rankings (user_id, period_type, period_key, total_points, level_number, level_name, updated_at)
  VALUES (p_user_id, p_period_type, p_period_key, v_total_points, v_level_info.level_number, v_level_info.level_name, now())
  ON CONFLICT (user_id, period_type, period_key)
  DO UPDATE SET
    total_points = v_total_points,
    level_number = v_level_info.level_number,
    level_name = v_level_info.level_name,
    updated_at = now();
    
  WITH ranked_users AS (
    SELECT 
      user_id,
      ROW_NUMBER() OVER (ORDER BY total_points DESC) as position
    FROM user_rankings
    WHERE period_type = p_period_type AND period_key = p_period_key
  )
  UPDATE user_rankings ur
  SET ranking_position = ru.position
  FROM ranked_users ru
  WHERE ur.user_id = ru.user_id
    AND ur.period_type = p_period_type
    AND ur.period_key = p_period_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para atualizar rankings
CREATE OR REPLACE FUNCTION trigger_update_rankings()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_points_insert
AFTER INSERT ON user_points_history
FOR EACH ROW
EXECUTE FUNCTION trigger_update_rankings();

-- RLS Policies
ALTER TABLE public.trade_action_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_points_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_rewards_received ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_challenge_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos podem ver configuração de pontos" ON public.trade_action_points FOR SELECT USING (is_active = true);
CREATE POLICY "Apenas admins e supervisores gerenciam pontos" ON public.trade_action_points FOR ALL USING (is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Usuários veem seu próprio histórico" ON public.user_points_history FOR SELECT USING (user_id = auth.uid() OR is_admin_or_supervisor(auth.uid()));
CREATE POLICY "Sistema insere pontos automaticamente" ON public.user_points_history FOR INSERT WITH CHECK (true);

CREATE POLICY "Todos podem ver rankings" ON public.user_rankings FOR SELECT USING (true);
CREATE POLICY "Sistema atualiza rankings automaticamente" ON public.user_rankings FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Todos podem ver recompensas ativas" ON public.trade_rewards FOR SELECT USING (is_active = true);
CREATE POLICY "Apenas admins gerenciam recompensas" ON public.trade_rewards FOR ALL USING (is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Usuários veem suas recompensas" ON public.user_rewards_received FOR SELECT USING (user_id = auth.uid() OR is_admin_or_supervisor(auth.uid()));
CREATE POLICY "Usuários solicitam recompensas" ON public.user_rewards_received FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins aprovam recompensas" ON public.user_rewards_received FOR UPDATE USING (is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Todos podem ver desafios ativos" ON public.trade_challenges FOR SELECT USING (is_active = true);
CREATE POLICY "Apenas admins gerenciam desafios" ON public.trade_challenges FOR ALL USING (is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Usuários veem seu progresso" ON public.user_challenge_progress FOR SELECT USING (user_id = auth.uid() OR is_admin_or_supervisor(auth.uid()));
CREATE POLICY "Sistema atualiza progresso" ON public.user_challenge_progress FOR ALL USING (true) WITH CHECK (true);