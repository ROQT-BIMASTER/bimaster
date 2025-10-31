-- Tabela de configuração de regras de pontuação (editável por admins)
CREATE TABLE IF NOT EXISTS public.trade_points_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_type VARCHAR(50) NOT NULL, -- 'base_points' ou 'multiplier'
  action_code VARCHAR(100) NOT NULL, -- código da ação (visit_complete, photo_upload, etc)
  config_key VARCHAR(100), -- chave específica para multiplicadores (ex: '3_photos', 'observations')
  points_value NUMERIC(10,2) NOT NULL, -- valor em pontos ou percentual
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(config_type, action_code, config_key)
);

-- RLS para configuração de pontos
ALTER TABLE public.trade_points_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin pode gerenciar configurações de pontos"
ON public.trade_points_config
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Todos podem ver configurações de pontos"
ON public.trade_points_config
FOR SELECT
TO authenticated
USING (is_active = true);

-- Inserir configurações padrão (especificando todas as colunas)
INSERT INTO public.trade_points_config (config_type, action_code, config_key, points_value, description) VALUES
-- Pontos base
('base_points', 'visit_complete', NULL, 50, 'Visita completa'),
('base_points', 'audit_complete', NULL, 100, 'Auditoria completa'),
('base_points', 'shelf_measurement', NULL, 80, 'Medição de gôndola'),
('base_points', 'sellout_entry', NULL, 70, 'Lançamento Sell Out'),
('base_points', 'competitive_intel', NULL, 60, 'Inteligência competitiva'),
('base_points', 'photo_upload', NULL, 30, 'Upload de foto'),

-- Multiplicadores de visita
('multiplier', 'visit_complete', '3_photos', 40, 'Multiplicador para 3+ fotos'),
('multiplier', 'visit_complete', '1_photo', 20, 'Multiplicador para 1+ foto'),
('multiplier', 'visit_complete', 'observations', 15, 'Multiplicador para observações'),
('multiplier', 'visit_complete', 'checklist', 20, 'Multiplicador para checklist completo'),
('multiplier', 'visit_complete', 'duration', 15, 'Multiplicador para duração registrada'),
('multiplier', 'visit_complete', 'compliance_bonus', 20, 'Bônus máximo de compliance')
ON CONFLICT DO NOTHING;

-- Trigger para atualizar updated_at
CREATE TRIGGER update_trade_points_config_updated_at
BEFORE UPDATE ON public.trade_points_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- View para performance da equipe (supervisores)
CREATE OR REPLACE VIEW public.team_performance_view AS
SELECT 
  p.id as user_id,
  p.nome as user_name,
  p.supervisor_id,
  ur.role,
  
  -- Rankings por período
  (SELECT total_points FROM user_rankings WHERE user_id = p.id AND period_type = 'monthly' ORDER BY updated_at DESC LIMIT 1) as monthly_points,
  (SELECT ranking_position FROM user_rankings WHERE user_id = p.id AND period_type = 'monthly' ORDER BY updated_at DESC LIMIT 1) as monthly_position,
  (SELECT level_name FROM user_rankings WHERE user_id = p.id AND period_type = 'monthly' ORDER BY updated_at DESC LIMIT 1) as current_level,
  
  -- Estatísticas do mês atual
  (SELECT COUNT(*) FROM visits v WHERE v.user_id = p.id AND v.status = 'completed' AND DATE_TRUNC('month', v.scheduled_date) = DATE_TRUNC('month', CURRENT_DATE)) as visits_this_month,
  (SELECT COUNT(*) FROM photos ph WHERE ph.vendedor_id = p.id AND DATE_TRUNC('month', ph.upload_date) = DATE_TRUNC('month', CURRENT_DATE)) as photos_this_month,
  (SELECT COUNT(*) FROM gondola_audits ga WHERE ga.created_by = p.id AND DATE_TRUNC('month', ga.created_at) = DATE_TRUNC('month', CURRENT_DATE)) as audits_this_month,
  (SELECT COUNT(*) FROM shelf_measurements sm WHERE sm.vendedor_id = p.id AND DATE_TRUNC('month', sm.created_at) = DATE_TRUNC('month', CURRENT_DATE)) as measurements_this_month,
  
  -- Média de compliance
  (SELECT AVG(v2.compliance_score) FROM visits v2 WHERE v2.user_id = p.id AND v2.status = 'completed' AND v2.compliance_score IS NOT NULL) as avg_compliance,
  
  -- Última atividade
  (SELECT MAX(uph.earned_at) FROM user_points_history uph WHERE uph.user_id = p.id) as last_activity
  
FROM profiles p
LEFT JOIN user_roles ur ON ur.user_id = p.id
WHERE p.aprovado = true;

-- RLS para view de performance da equipe
ALTER VIEW public.team_performance_view SET (security_invoker = on);

COMMENT ON VIEW public.team_performance_view IS 'View para supervisores acompanharem performance da equipe';