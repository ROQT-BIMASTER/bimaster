-- Criar tabela de módulos do sistema
CREATE TABLE IF NOT EXISTS public.modulos_sistema (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  nome text NOT NULL,
  descricao text,
  icone text,
  ordem integer DEFAULT 0,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Criar tabela de permissões de módulos por role
CREATE TABLE IF NOT EXISTS public.role_permissoes_modulos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  modulo_id uuid NOT NULL REFERENCES modulos_sistema(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(role, modulo_id)
);

-- Criar tabela de permissões de módulos por usuário (override do role)
CREATE TABLE IF NOT EXISTS public.usuario_permissoes_modulos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  modulo_id uuid NOT NULL REFERENCES modulos_sistema(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(usuario_id, modulo_id)
);

-- Habilitar RLS
ALTER TABLE public.modulos_sistema ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissoes_modulos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuario_permissoes_modulos ENABLE ROW LEVEL SECURITY;

-- Políticas para modulos_sistema
CREATE POLICY "Todos podem ver módulos ativos" ON modulos_sistema
FOR SELECT USING (ativo = true);

CREATE POLICY "Admins podem gerenciar módulos" ON modulos_sistema
FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Políticas para role_permissoes_modulos
CREATE POLICY "Todos podem ver permissões de roles" ON role_permissoes_modulos
FOR SELECT USING (true);

CREATE POLICY "Admins podem gerenciar permissões de roles" ON role_permissoes_modulos
FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Políticas para usuario_permissoes_modulos
CREATE POLICY "Acesso total permissoes_modulos - SELECT" ON usuario_permissoes_modulos
FOR SELECT USING (true);

CREATE POLICY "Admins e supervisores podem gerenciar permissões de usuários" ON usuario_permissoes_modulos
FOR ALL USING (is_admin_or_supervisor(auth.uid()));

-- Função para verificar se usuário tem permissão de módulo
CREATE OR REPLACE FUNCTION public.usuario_tem_permissao_modulo(_user_id uuid, _modulo_codigo text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Verificar permissão específica do usuário (override)
  SELECT EXISTS (
    SELECT 1
    FROM public.usuario_permissoes_modulos upm
    JOIN public.modulos_sistema ms ON upm.modulo_id = ms.id
    WHERE upm.usuario_id = _user_id
    AND ms.codigo = _modulo_codigo
    AND ms.ativo = true
  ) OR
  -- Verificar permissão por role
  EXISTS (
    SELECT 1
    FROM public.role_permissoes_modulos rpm
    JOIN public.modulos_sistema ms ON rpm.modulo_id = ms.id
    JOIN public.user_roles ur ON rpm.role = ur.role
    WHERE ur.user_id = _user_id
    AND ms.codigo = _modulo_codigo
    AND ms.ativo = true
  ) OR
  -- Admin tem acesso a tudo
  has_role(_user_id, 'admin');
$$;

-- Inserir módulos padrão
INSERT INTO public.modulos_sistema (codigo, nome, descricao, icone, ordem) VALUES
('dashboard', 'Dashboard', 'Painel principal com métricas e KPIs', 'LayoutDashboard', 1),
('prospects', 'Módulo de Prospects', 'Gestão completa de prospects e vendas', 'Users', 2),
('trade', 'Trade Marketing', 'Gestão de PDVs, visitas e trade marketing', 'Store', 3),
('relatorios', 'Relatórios', 'Relatórios e análises', 'FileText', 4),
('configuracoes', 'Configurações', 'Configurações do sistema', 'Settings', 5)
ON CONFLICT (codigo) DO NOTHING;

-- Permissões padrão por role
-- Admin tem acesso a tudo (verificado pela função)
-- Supervisor tem acesso a tudo exceto configurações avançadas
INSERT INTO public.role_permissoes_modulos (role, modulo_id)
SELECT 'supervisor', id FROM modulos_sistema WHERE codigo IN ('dashboard', 'prospects', 'trade', 'relatorios')
ON CONFLICT DO NOTHING;

-- Vendedor tem acesso a prospects, trade e dashboard
INSERT INTO public.role_permissoes_modulos (role, modulo_id)
SELECT 'vendedor', id FROM modulos_sistema WHERE codigo IN ('dashboard', 'prospects', 'trade')
ON CONFLICT DO NOTHING;

-- Promotor tem acesso apenas a trade e dashboard
INSERT INTO public.role_permissoes_modulos (role, modulo_id)
SELECT 'promotor', id FROM modulos_sistema WHERE codigo IN ('dashboard', 'trade')
ON CONFLICT DO NOTHING;