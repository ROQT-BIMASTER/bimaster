
-- =====================================================
-- MARKETING MISSION CONTROL - Infrastructure
-- =====================================================

-- 1. Tabela de Pontos e Gamificação do Marketing
CREATE TABLE public.marketing_user_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  total_points INTEGER DEFAULT 0,
  tasks_completed INTEGER DEFAULT 0,
  tasks_on_time INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  best_streak INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Tabela de Badges/Conquistas
CREATE TABLE public.marketing_badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo VARCHAR(50) NOT NULL UNIQUE,
  nome VARCHAR(100) NOT NULL,
  descricao TEXT,
  icone VARCHAR(50) DEFAULT 'Award',
  pontos_necessarios INTEGER DEFAULT 0,
  tipo VARCHAR(50) DEFAULT 'achievement', -- achievement, milestone, special
  cor VARCHAR(20) DEFAULT 'gold',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Tabela de Badges Conquistados
CREATE TABLE public.marketing_user_badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  badge_id UUID NOT NULL REFERENCES public.marketing_badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, badge_id)
);

-- 4. Tabela de Histórico de Pontos
CREATE TABLE public.marketing_points_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  pontos INTEGER NOT NULL,
  tipo VARCHAR(50) NOT NULL, -- task_complete, on_time_bonus, creative_bonus, approval_bonus
  descricao TEXT,
  tarefa_id UUID REFERENCES public.lancamentos_tarefas_marketing(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 5. Tabela de Notificações do Marketing
CREATE TABLE public.marketing_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tipo VARCHAR(50) NOT NULL, -- task_assigned, deadline_warning, approval_needed, badge_earned
  titulo VARCHAR(200) NOT NULL,
  mensagem TEXT,
  link VARCHAR(500),
  lida BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 6. Tabela de Comentários em Tarefas (para aprovação visual)
CREATE TABLE public.marketing_task_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tarefa_id UUID NOT NULL REFERENCES public.lancamentos_tarefas_marketing(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  comentario TEXT NOT NULL,
  tipo VARCHAR(50) DEFAULT 'comment', -- comment, approval, rejection, revision
  anexo_url TEXT,
  posicao_x DECIMAL, -- para comentários posicionados em imagem
  posicao_y DECIMAL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 7. Adicionar campos extras na tabela de tarefas
ALTER TABLE public.lancamentos_tarefas_marketing 
ADD COLUMN IF NOT EXISTS pontos_base INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS pontos_bonus INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS prioridade_ai INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS alerta_gargalo BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS tempo_estimado_horas DECIMAL DEFAULT 2,
ADD COLUMN IF NOT EXISTS tempo_real_horas DECIMAL,
ADD COLUMN IF NOT EXISTS dependencia_tarefa_id UUID REFERENCES public.lancamentos_tarefas_marketing(id),
ADD COLUMN IF NOT EXISTS aprovado_por UUID,
ADD COLUMN IF NOT EXISTS aprovado_em TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS versao INTEGER DEFAULT 1;

-- Enable RLS
ALTER TABLE public.marketing_user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_points_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_task_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view all stats" ON public.marketing_user_stats FOR SELECT USING (true);
CREATE POLICY "Users can update own stats" ON public.marketing_user_stats FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "System can insert stats" ON public.marketing_user_stats FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view badges" ON public.marketing_badges FOR SELECT USING (true);
CREATE POLICY "Admin can manage badges" ON public.marketing_badges FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view user badges" ON public.marketing_user_badges FOR SELECT USING (true);
CREATE POLICY "System can insert user badges" ON public.marketing_user_badges FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view points history" ON public.marketing_points_history FOR SELECT USING (true);
CREATE POLICY "System can insert points" ON public.marketing_points_history FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view own notifications" ON public.marketing_notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.marketing_notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "System can insert notifications" ON public.marketing_notifications FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view task comments" ON public.marketing_task_comments FOR SELECT USING (true);
CREATE POLICY "Users can insert comments" ON public.marketing_task_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own comments" ON public.marketing_task_comments FOR UPDATE USING (auth.uid() = user_id);

-- Insert default badges
INSERT INTO public.marketing_badges (codigo, nome, descricao, icone, pontos_necessarios, tipo, cor) VALUES
('first_task', 'Primeira Tarefa', 'Completou sua primeira tarefa de marketing', 'Star', 0, 'milestone', 'bronze'),
('speed_demon', 'Velocista', 'Completou 5 tarefas antes do prazo', 'Zap', 50, 'achievement', 'silver'),
('creative_master', 'Mestre Criativo', 'Criou 10 peças aprovadas de primeira', 'Palette', 100, 'achievement', 'gold'),
('streak_7', 'Semana Perfeita', 'Manteve streak de 7 dias', 'Flame', 70, 'milestone', 'orange'),
('streak_30', 'Mês Imbatível', 'Manteve streak de 30 dias', 'Trophy', 300, 'milestone', 'purple'),
('team_player', 'Trabalho em Equipe', 'Ajudou em 20 tarefas de colegas', 'Users', 200, 'achievement', 'blue'),
('launch_hero', 'Herói do Lançamento', 'Participou de 5 lançamentos bem-sucedidos', 'Rocket', 500, 'special', 'gradient'),
('perfectionist', 'Perfeccionista', '100% de aprovação em 15 tarefas', 'CheckCircle', 150, 'achievement', 'green'),
('early_bird', 'Madrugador', 'Entregou 10 tarefas com 2+ dias de antecedência', 'Sun', 100, 'achievement', 'yellow'),
('centurion', 'Centurião', 'Acumulou 1000 pontos', 'Crown', 1000, 'milestone', 'gold');

-- Create indexes for performance
CREATE INDEX idx_marketing_user_stats_user ON public.marketing_user_stats(user_id);
CREATE INDEX idx_marketing_points_history_user ON public.marketing_points_history(user_id);
CREATE INDEX idx_marketing_notifications_user ON public.marketing_notifications(user_id, lida);
CREATE INDEX idx_marketing_task_comments_tarefa ON public.marketing_task_comments(tarefa_id);
CREATE INDEX idx_lancamentos_tarefas_dependencia ON public.lancamentos_tarefas_marketing(dependencia_tarefa_id);
