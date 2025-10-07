-- Create enum for geographic zones
CREATE TYPE public.zona_geografica AS ENUM ('norte', 'sul', 'leste', 'oeste', 'centro', 'nordeste', 'noroeste', 'sudeste', 'sudoeste');

-- Add geographic zone fields to prospects and municipios
ALTER TABLE public.prospects
ADD COLUMN IF NOT EXISTS zona zona_geografica,
ADD COLUMN IF NOT EXISTS subdistrito TEXT;

ALTER TABLE public.municipios
ADD COLUMN IF NOT EXISTS zona_padrao zona_geografica;

-- Create system screens table
CREATE TABLE IF NOT EXISTS public.telas_sistema (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  icone TEXT,
  rota TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create user screen permissions table
CREATE TABLE IF NOT EXISTS public.usuario_permissoes_telas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tela_id UUID REFERENCES public.telas_sistema(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(usuario_id, tela_id)
);

-- Create user-prospect binding table
CREATE TABLE IF NOT EXISTS public.usuario_prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  prospect_id UUID REFERENCES public.prospects(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(usuario_id, prospect_id)
);

-- Enable RLS
ALTER TABLE public.telas_sistema ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuario_permissoes_telas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuario_prospects ENABLE ROW LEVEL SECURITY;

-- RLS Policies for telas_sistema
CREATE POLICY "Todos podem ver telas ativas"
ON public.telas_sistema FOR SELECT
USING (ativo = true);

CREATE POLICY "Admins podem gerenciar telas"
ON public.telas_sistema FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for usuario_permissoes_telas
CREATE POLICY "Usuários podem ver suas próprias permissões"
ON public.usuario_permissoes_telas FOR SELECT
USING (usuario_id = auth.uid() OR is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Admins podem gerenciar permissões"
ON public.usuario_permissoes_telas FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for usuario_prospects
CREATE POLICY "Usuários podem ver suas vinculações"
ON public.usuario_prospects FOR SELECT
USING (usuario_id = auth.uid() OR is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Admins e supervisores podem gerenciar vinculações"
ON public.usuario_prospects FOR ALL
USING (is_admin_or_supervisor(auth.uid()));

-- Function to check if user has screen permission
CREATE OR REPLACE FUNCTION public.usuario_tem_permissao_tela(_user_id UUID, _tela_codigo TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuario_permissoes_telas upt
    JOIN public.telas_sistema ts ON upt.tela_id = ts.id
    WHERE upt.usuario_id = _user_id
    AND ts.codigo = _tela_codigo
    AND ts.ativo = true
  ) OR has_role(_user_id, 'admin');
$$;

-- Function to check if user has access to prospect
CREATE OR REPLACE FUNCTION public.usuario_tem_acesso_prospect(_user_id UUID, _prospect_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuario_prospects
    WHERE usuario_id = _user_id
    AND prospect_id = _prospect_id
  ) OR is_admin_or_supervisor(_user_id);
$$;

-- Update prospects RLS to include user-prospect binding
DROP POLICY IF EXISTS "Vendedores can view their own prospects" ON public.prospects;
CREATE POLICY "Vendedores can view their own prospects"
ON public.prospects FOR SELECT
USING (
  vendedor_id = auth.uid() 
  OR is_admin_or_supervisor(auth.uid())
  OR usuario_tem_acesso_prospect(auth.uid(), id)
  OR EXISTS (
    SELECT 1
    FROM profiles p1
    JOIN profiles p2 ON p1.id = p2.supervisor_id
    WHERE p1.id = auth.uid() AND p2.id = prospects.vendedor_id
  )
);

-- Insert default system screens
INSERT INTO public.telas_sistema (codigo, nome, descricao, icone, rota, ordem) VALUES
  ('dashboard', 'Dashboard', 'Painel principal com métricas e KPIs', 'LayoutDashboard', '/dashboard', 1),
  ('prospects', 'Prospects', 'Gerenciamento de prospects e clientes', 'Users', '/dashboard/prospects', 2),
  ('kanban', 'Kanban', 'Visualização em quadro Kanban', 'KanbanSquare', '/dashboard/kanban', 3),
  ('mapa', 'Mapa', 'Visualização geográfica', 'Map', '/dashboard/mapa', 4),
  ('atividades', 'Atividades', 'Registro de atividades e follow-ups', 'Activity', '/dashboard/atividades', 5),
  ('tarefas', 'Tarefas', 'Gerenciamento de tarefas', 'CheckSquare', '/dashboard/tarefas', 6),
  ('chat', 'Chat', 'Mensagens e conversas', 'MessageSquare', '/dashboard/chat', 7),
  ('municipios', 'Municípios', 'Gerenciamento de municípios e territórios', 'MapPin', '/dashboard/municipios', 8),
  ('importar', 'Importar Clientes', 'Importação em massa via planilha', 'Upload', '/dashboard/importar-clientes', 9),
  ('auditoria', 'Auditoria', 'Logs de auditoria e histórico', 'Shield', '/dashboard/auditoria', 10),
  ('aguardando', 'Aguardando Aprovação', 'Usuários pendentes de aprovação', 'Clock', '/dashboard/aguardando-aprovacao', 11),
  ('configuracoes', 'Configurações', 'Configurações do sistema e perfil', 'Settings', '/dashboard/configuracoes', 12)
ON CONFLICT (codigo) DO NOTHING;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_prospects_zona ON public.prospects(zona);
CREATE INDEX IF NOT EXISTS idx_prospects_subdistrito ON public.prospects(subdistrito);
CREATE INDEX IF NOT EXISTS idx_usuario_permissoes_usuario ON public.usuario_permissoes_telas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_usuario_prospects_usuario ON public.usuario_prospects(usuario_id);
CREATE INDEX IF NOT EXISTS idx_usuario_prospects_prospect ON public.usuario_prospects(prospect_id);