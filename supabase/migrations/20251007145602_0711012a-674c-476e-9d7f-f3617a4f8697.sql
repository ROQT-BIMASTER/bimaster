-- =====================================================
-- MIGRAÇÃO SEGURA: SISTEMA DE ROLES E REMOÇÃO DE PLANOS
-- =====================================================

-- 1. Criar enum para roles
CREATE TYPE public.app_role AS ENUM ('admin', 'supervisor', 'vendedor');

-- 2. Criar tabela user_roles
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Políticas RLS para user_roles
CREATE POLICY "Admins podem gerenciar todas as roles"
ON public.user_roles FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  )
);

CREATE POLICY "Usuários podem ver suas próprias roles"
ON public.user_roles FOR SELECT
USING (user_id = auth.uid());

-- 4. Função security definer para verificar roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 5. Função helper para admin/supervisor
CREATE OR REPLACE FUNCTION public.is_admin_or_supervisor_new(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'supervisor')
  )
$$;

-- 6. Migrar dados (conversão manual de string)
INSERT INTO public.user_roles (user_id, role)
SELECT 
  id,
  CASE tipo_usuario::text
    WHEN 'admin' THEN 'admin'::app_role
    WHEN 'supervisor' THEN 'supervisor'::app_role
    ELSE 'vendedor'::app_role
  END
FROM public.profiles
WHERE tipo_usuario IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- =====================================================
-- ATUALIZAR RLS POLICIES
-- =====================================================

-- PROFILES
DROP POLICY IF EXISTS "Admins and supervisors update all" ON public.profiles;
DROP POLICY IF EXISTS "Admins and supervisors view all" ON public.profiles;

CREATE POLICY "Admins and supervisors update all"
ON public.profiles FOR UPDATE
USING (is_admin_or_supervisor_new(auth.uid()));

CREATE POLICY "Admins and supervisors view all"
ON public.profiles FOR SELECT
USING (is_admin_or_supervisor_new(auth.uid()));

-- PROSPECTS
DROP POLICY IF EXISTS "Only supervisors and admins can delete prospects" ON public.prospects;
DROP POLICY IF EXISTS "Vendedores can create prospects" ON public.prospects;
DROP POLICY IF EXISTS "Vendedores can update their own prospects" ON public.prospects;
DROP POLICY IF EXISTS "Vendedores can view their own prospects" ON public.prospects;

CREATE POLICY "Only supervisors and admins can delete prospects"
ON public.prospects FOR DELETE
USING (is_admin_or_supervisor_new(auth.uid()));

CREATE POLICY "Vendedores can create prospects"
ON public.prospects FOR INSERT
WITH CHECK ((vendedor_id = auth.uid()) OR is_admin_or_supervisor_new(auth.uid()));

CREATE POLICY "Vendedores can update their own prospects"
ON public.prospects FOR UPDATE
USING ((vendedor_id = auth.uid()) OR is_admin_or_supervisor_new(auth.uid()));

CREATE POLICY "Vendedores can view their own prospects"
ON public.prospects FOR SELECT
USING (
  (vendedor_id = auth.uid()) 
  OR is_admin_or_supervisor_new(auth.uid())
  OR EXISTS (
    SELECT 1 FROM profiles p1
    JOIN profiles p2 ON p1.id = p2.supervisor_id
    WHERE p1.id = auth.uid() AND p2.id = prospects.vendedor_id
  )
);

-- ATIVIDADES
DROP POLICY IF EXISTS "Users can create activities" ON public.atividades;
DROP POLICY IF EXISTS "Users can update their own activities" ON public.atividades;
DROP POLICY IF EXISTS "Users can view activities for their prospects" ON public.atividades;

CREATE POLICY "Users can create activities"
ON public.atividades FOR INSERT
WITH CHECK ((vendedor_id = auth.uid()) OR is_admin_or_supervisor_new(auth.uid()));

CREATE POLICY "Users can update their own activities"
ON public.atividades FOR UPDATE
USING ((vendedor_id = auth.uid()) OR is_admin_or_supervisor_new(auth.uid()));

CREATE POLICY "Users can view activities for their prospects"
ON public.atividades FOR SELECT
USING (
  (vendedor_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM prospects
    WHERE prospects.id = atividades.prospect_id AND prospects.vendedor_id = auth.uid()
  )
  OR is_admin_or_supervisor_new(auth.uid())
);

-- MUNICIPIOS
DROP POLICY IF EXISTS "Supervisors and admins can manage municipalities" ON public.municipios;
CREATE POLICY "Supervisors and admins can manage municipalities"
ON public.municipios FOR ALL
USING (is_admin_or_supervisor_new(auth.uid()));

-- MUNICIPIOS_USUARIOS
DROP POLICY IF EXISTS "Admins e supervisores podem ver todos os vínculos" ON public.municipios_usuarios;
DROP POLICY IF EXISTS "Admins podem gerenciar vínculos" ON public.municipios_usuarios;

CREATE POLICY "Admins e supervisores podem ver todos os vínculos"
ON public.municipios_usuarios FOR SELECT
USING (is_admin_or_supervisor_new(auth.uid()));

CREATE POLICY "Admins podem gerenciar vínculos"
ON public.municipios_usuarios FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- AUDITORIA
DROP POLICY IF EXISTS "Admins e supervisores podem ver auditoria" ON public.auditoria_atribuicoes;
CREATE POLICY "Admins e supervisores podem ver auditoria"
ON public.auditoria_atribuicoes FOR SELECT
USING (is_admin_or_supervisor_new(auth.uid()));

-- ASSINATURAS
DROP POLICY IF EXISTS "Admins e supervisores podem gerenciar assinaturas" ON public.assinaturas;
DROP POLICY IF EXISTS "Usuários podem ver suas assinaturas" ON public.assinaturas;

CREATE POLICY "Admins e supervisores podem gerenciar assinaturas"
ON public.assinaturas FOR ALL
USING (is_admin_or_supervisor_new(auth.uid()));

CREATE POLICY "Usuários podem ver suas assinaturas"
ON public.assinaturas FOR SELECT
USING ((usuario_id = auth.uid()) OR is_admin_or_supervisor_new(auth.uid()));

-- PLANOS
DROP POLICY IF EXISTS "Admins podem gerenciar planos" ON public.planos;
CREATE POLICY "Admins podem gerenciar planos"
ON public.planos FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- =====================================================
-- REMOVER COLUNAS ANTIGAS
-- =====================================================

ALTER TABLE public.profiles DROP COLUMN IF EXISTS plano_id;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS tipo_usuario;

-- =====================================================
-- ATUALIZAR TRIGGER handle_new_user
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tipo_usuario text;
  v_role app_role;
  v_aprovado boolean;
BEGIN
  v_tipo_usuario := COALESCE(NEW.raw_user_meta_data->>'tipo_usuario', 'vendedor');
  
  v_role := CASE v_tipo_usuario
    WHEN 'admin' THEN 'admin'::app_role
    WHEN 'supervisor' THEN 'supervisor'::app_role
    ELSE 'vendedor'::app_role
  END;
  
  v_aprovado := (v_role = 'admin');
  
  INSERT INTO public.profiles (id, nome, email, aprovado)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', 'Novo Usuário'),
    NEW.email,
    v_aprovado
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- =====================================================
-- SUBSTITUIR FUNÇÃO ANTIGA
-- =====================================================

DROP FUNCTION IF EXISTS public.is_admin_or_supervisor(uuid);
ALTER FUNCTION public.is_admin_or_supervisor_new(uuid) RENAME TO is_admin_or_supervisor;

-- =====================================================
-- ÍNDICES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);