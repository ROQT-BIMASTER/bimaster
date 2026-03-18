
-- =============================================
-- Fase 1: ui_permissions (controle de componentes/ações)
-- =============================================

CREATE TABLE public.ui_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text,
  departamento_id uuid REFERENCES public.departamentos(id) ON DELETE CASCADE,
  tela_codigo text NOT NULL,
  componente_codigo text NOT NULL,
  visivel boolean NOT NULL DEFAULT true,
  editavel boolean NOT NULL DEFAULT true,
  configurado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ui_permissions_unique UNIQUE NULLS NOT DISTINCT (role, departamento_id, tela_codigo, componente_codigo),
  CONSTRAINT ui_permissions_check CHECK (role IS NOT NULL OR departamento_id IS NOT NULL)
);

ALTER TABLE public.ui_permissions ENABLE ROW LEVEL SECURITY;

-- Audit table for ui_permissions
CREATE TABLE public.ui_permissions_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ui_permission_id uuid,
  tela_codigo text NOT NULL,
  componente_codigo text NOT NULL,
  acao text NOT NULL,
  valor_anterior jsonb,
  valor_novo jsonb,
  alterado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ui_permissions_audit ENABLE ROW LEVEL SECURITY;

-- =============================================
-- Fase 5: feature_flags
-- =============================================

CREATE TABLE public.feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  nome text NOT NULL,
  descricao text,
  ativo boolean NOT NULL DEFAULT false,
  roles_permitidos text[] DEFAULT '{}',
  departamentos_permitidos uuid[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS Policies
-- =============================================

-- ui_permissions: all authenticated can read, only admin can write
CREATE POLICY "Authenticated users can read ui_permissions"
  ON public.ui_permissions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage ui_permissions"
  ON public.ui_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ui_permissions_audit: all authenticated can read and insert
CREATE POLICY "Authenticated users can read ui_permissions_audit"
  ON public.ui_permissions_audit FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert ui_permissions_audit"
  ON public.ui_permissions_audit FOR INSERT TO authenticated
  WITH CHECK (true);

-- feature_flags: all authenticated can read, only admin can write
CREATE POLICY "Authenticated users can read feature_flags"
  ON public.feature_flags FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage feature_flags"
  ON public.feature_flags FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- Security definer function: componente_permitido
-- =============================================

CREATE OR REPLACE FUNCTION public.componente_permitido(p_tela text, p_componente text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT up.visivel
      FROM public.ui_permissions up
      LEFT JOIN public.profiles p ON p.id = auth.uid()
      LEFT JOIN public.user_roles ur ON ur.user_id = auth.uid()
      WHERE up.tela_codigo = p_tela
        AND up.componente_codigo = p_componente
        AND (
          up.role = ur.role::text
          OR up.departamento_id = p.departamento_id
        )
      ORDER BY
        CASE WHEN up.departamento_id IS NOT NULL THEN 0 ELSE 1 END
      LIMIT 1
    ),
    true
  );
$$;

-- =============================================
-- Security definer function: componente_editavel
-- =============================================

CREATE OR REPLACE FUNCTION public.componente_editavel(p_tela text, p_componente text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT up.editavel
      FROM public.ui_permissions up
      LEFT JOIN public.profiles p ON p.id = auth.uid()
      LEFT JOIN public.user_roles ur ON ur.user_id = auth.uid()
      WHERE up.tela_codigo = p_tela
        AND up.componente_codigo = p_componente
        AND (
          up.role = ur.role::text
          OR up.departamento_id = p.departamento_id
        )
      ORDER BY
        CASE WHEN up.departamento_id IS NOT NULL THEN 0 ELSE 1 END
      LIMIT 1
    ),
    true
  );
$$;

-- =============================================
-- Insert default feature flags
-- =============================================

INSERT INTO public.feature_flags (codigo, nome, descricao, ativo, roles_permitidos) VALUES
  ('modulo_reunioes', 'Módulo Reuniões', 'Ativa/desativa o módulo de reuniões', true, '{"admin","gerente"}'),
  ('exportar_excel', 'Exportar Excel', 'Permite exportar dados em Excel', true, '{"admin","gerente","supervisor"}'),
  ('exportar_pdf', 'Exportar PDF', 'Permite exportar dados em PDF', true, '{"admin","gerente","supervisor"}'),
  ('modulo_ia', 'Módulo IA', 'Ativa funcionalidades de inteligência artificial', true, '{"admin"}'),
  ('chat_china', 'Chat China', 'Chat integrado nas submissões China', true, '{"admin","gerente"}');
