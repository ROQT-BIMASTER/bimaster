
-- Tabela de permissões de módulos por departamento
CREATE TABLE IF NOT EXISTS public.departamento_permissoes_modulos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  departamento_id UUID NOT NULL REFERENCES public.departamentos(id) ON DELETE CASCADE,
  modulo_id UUID NOT NULL REFERENCES public.modulos_sistema(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(departamento_id, modulo_id)
);

-- Tabela de permissões de telas por departamento
CREATE TABLE IF NOT EXISTS public.departamento_permissoes_telas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  departamento_id UUID NOT NULL REFERENCES public.departamentos(id) ON DELETE CASCADE,
  tela_id UUID NOT NULL REFERENCES public.telas_sistema(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(departamento_id, tela_id)
);

-- Adicionar departamento_id na tabela profiles se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'departamento_id'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN departamento_id UUID REFERENCES public.departamentos(id);
  END IF;
END $$;

-- Enable RLS
ALTER TABLE public.departamento_permissoes_modulos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departamento_permissoes_telas ENABLE ROW LEVEL SECURITY;

-- Policies para departamento_permissoes_modulos
CREATE POLICY "Todos podem ver permissões de departamentos - módulos"
ON public.departamento_permissoes_modulos FOR SELECT
USING (true);

CREATE POLICY "Admins podem gerenciar permissões de departamentos - módulos"
ON public.departamento_permissoes_modulos FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Policies para departamento_permissoes_telas
CREATE POLICY "Todos podem ver permissões de departamentos - telas"
ON public.departamento_permissoes_telas FOR SELECT
USING (true);

CREATE POLICY "Admins podem gerenciar permissões de departamentos - telas"
ON public.departamento_permissoes_telas FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Função RPC otimizada para buscar todas as permissões do usuário
CREATE OR REPLACE FUNCTION public.get_user_combined_module_permissions(_user_id uuid)
RETURNS TABLE(modulo_codigo character varying)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Admin tem acesso a todos os módulos
  SELECT ms.codigo
  FROM modulos_sistema ms
  WHERE ms.ativo = true
    AND EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = _user_id AND role = 'admin'
    )
  
  UNION
  
  -- Permissões específicas do usuário (override - maior prioridade)
  SELECT ms.codigo
  FROM usuario_permissoes_modulos upm
  JOIN modulos_sistema ms ON upm.modulo_id = ms.id
  WHERE upm.usuario_id = _user_id
    AND ms.ativo = true
  
  UNION
  
  -- Permissões por departamento
  SELECT ms.codigo
  FROM departamento_permissoes_modulos dpm
  JOIN modulos_sistema ms ON dpm.modulo_id = ms.id
  JOIN profiles p ON p.departamento_id = dpm.departamento_id
  WHERE p.id = _user_id
    AND ms.ativo = true
    AND NOT EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = _user_id AND role = 'admin'
    )
  
  UNION
  
  -- Permissões por role (menor prioridade)
  SELECT ms.codigo
  FROM role_permissoes_modulos rpm
  JOIN modulos_sistema ms ON rpm.modulo_id = ms.id
  JOIN user_roles ur ON rpm.role = ur.role
  WHERE ur.user_id = _user_id
    AND ms.ativo = true
    AND NOT EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = _user_id AND role = 'admin'
    );
$$;

-- Função RPC otimizada para buscar todas as permissões de telas do usuário
CREATE OR REPLACE FUNCTION public.get_user_combined_screen_permissions(_user_id uuid)
RETURNS TABLE(tela_codigo character varying)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Admin tem acesso a todas as telas
  SELECT ts.codigo
  FROM telas_sistema ts
  WHERE ts.ativo = true
    AND EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = _user_id AND role = 'admin'
    )
  
  UNION
  
  -- Permissões específicas do usuário (override - maior prioridade)
  SELECT ts.codigo
  FROM usuario_permissoes_telas upt
  JOIN telas_sistema ts ON upt.tela_id = ts.id
  WHERE upt.usuario_id = _user_id
    AND ts.ativo = true
  
  UNION
  
  -- Permissões por departamento
  SELECT ts.codigo
  FROM departamento_permissoes_telas dpt
  JOIN telas_sistema ts ON dpt.tela_id = ts.id
  JOIN profiles p ON p.departamento_id = dpt.departamento_id
  WHERE p.id = _user_id
    AND ts.ativo = true
    AND NOT EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = _user_id AND role = 'admin'
    )
  
  UNION
  
  -- Permissões por role (menor prioridade)
  SELECT ts.codigo
  FROM role_permissoes_telas rpt
  JOIN telas_sistema ts ON rpt.tela_id = ts.id
  JOIN user_roles ur ON rpt.role = ur.role
  WHERE ur.user_id = _user_id
    AND ts.ativo = true
    AND NOT EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = _user_id AND role = 'admin'
    );
$$;

-- Tabela de log de acesso
CREATE TABLE IF NOT EXISTS public.access_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  tela_codigo VARCHAR(100),
  modulo_codigo VARCHAR(100),
  action VARCHAR(50) NOT NULL,
  success BOOLEAN NOT NULL DEFAULT false,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.access_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver logs de acesso"
ON public.access_audit_log FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Sistema pode inserir logs"
ON public.access_audit_log FOR INSERT
WITH CHECK (true);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_departamento_permissoes_modulos_dept ON public.departamento_permissoes_modulos(departamento_id);
CREATE INDEX IF NOT EXISTS idx_departamento_permissoes_telas_dept ON public.departamento_permissoes_telas(departamento_id);
CREATE INDEX IF NOT EXISTS idx_profiles_departamento ON public.profiles(departamento_id);
CREATE INDEX IF NOT EXISTS idx_access_audit_log_user ON public.access_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_access_audit_log_created ON public.access_audit_log(created_at DESC);
