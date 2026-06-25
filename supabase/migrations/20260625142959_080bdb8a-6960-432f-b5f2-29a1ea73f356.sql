-- ALLOW-DESTRUCTIVE: refator RLS p/ remover match por nome de departamento (BIM-ORC-F0)
-- Fase 0 — Fundação de Perfis por Departamento (Orçamento Corporativo)

-- =========================================================================
-- 1.1 Enums
-- =========================================================================
DO $$ BEGIN
  CREATE TYPE public.dept_member_role AS ENUM ('solicitante','executor','gestor','financeiro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.budget_period_status AS ENUM ('rascunho','ativo','encerrado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.budget_distribution_status AS ENUM ('pendente','aprovada','bloqueada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================================
-- 1.2 Tabela department_member_roles
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.department_member_roles (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES public.departamentos(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  perfil        public.dept_member_role NOT NULL,
  created_by    uuid REFERENCES auth.users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (department_id, user_id, perfil)
);

CREATE INDEX IF NOT EXISTS idx_dmr_department ON public.department_member_roles(department_id);
CREATE INDEX IF NOT EXISTS idx_dmr_user       ON public.department_member_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_dmr_user_dep_perfil
  ON public.department_member_roles(user_id, department_id, perfil);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.department_member_roles TO authenticated;
GRANT ALL ON public.department_member_roles TO service_role;

ALTER TABLE public.department_member_roles ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- 1.3 Funções SECURITY DEFINER
-- =========================================================================
CREATE OR REPLACE FUNCTION public.has_dept_role(
  _user_id uuid,
  _dep uuid,
  _perfil public.dept_member_role
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.department_member_roles
    WHERE user_id = _user_id
      AND department_id = _dep
      AND perfil = _perfil
  ) OR public.has_role(_user_id, 'admin');
$$;

CREATE OR REPLACE FUNCTION public.is_dept_financeiro(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.department_member_roles
    WHERE user_id = _user_id AND perfil = 'financeiro'
  ) OR public.has_role(_user_id, 'admin');
$$;

-- =========================================================================
-- 1.5 Backfill (antes das policies novas, para garantir cobertura)
-- =========================================================================

-- Gestores: responsavel_id de cada departamento
INSERT INTO public.department_member_roles (department_id, user_id, perfil)
SELECT d.id, d.responsavel_id, 'gestor'::public.dept_member_role
  FROM public.departamentos d
 WHERE d.responsavel_id IS NOT NULL
ON CONFLICT (department_id, user_id, perfil) DO NOTHING;

-- Solicitantes: todo profile com departamento_id vira solicitante do seu dep
INSERT INTO public.department_member_roles (department_id, user_id, perfil)
SELECT p.departamento_id, p.id, 'solicitante'::public.dept_member_role
  FROM public.profiles p
 WHERE p.departamento_id IS NOT NULL
ON CONFLICT (department_id, user_id, perfil) DO NOTHING;

-- Financeiro: membros do departamento "Financeiro" (uso único do match por nome)
INSERT INTO public.department_member_roles (department_id, user_id, perfil)
SELECT d.id, p.id, 'financeiro'::public.dept_member_role
  FROM public.profiles p
  JOIN public.departamentos d ON d.id = p.departamento_id
 WHERE d.nome = 'Financeiro'
ON CONFLICT (department_id, user_id, perfil) DO NOTHING;

-- =========================================================================
-- 1.4 RLS de department_member_roles
-- =========================================================================
DROP POLICY IF EXISTS dmr_select ON public.department_member_roles;
CREATE POLICY dmr_select ON public.department_member_roles
FOR SELECT TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR public.has_dept_role((SELECT auth.uid()), department_id, 'gestor')
  OR public.is_dept_financeiro((SELECT auth.uid()))
);

DROP POLICY IF EXISTS dmr_insert ON public.department_member_roles;
CREATE POLICY dmr_insert ON public.department_member_roles
FOR INSERT TO authenticated
WITH CHECK (
  public.is_dept_financeiro((SELECT auth.uid()))
  OR public.has_dept_role((SELECT auth.uid()), department_id, 'gestor')
);

DROP POLICY IF EXISTS dmr_update ON public.department_member_roles;
CREATE POLICY dmr_update ON public.department_member_roles
FOR UPDATE TO authenticated
USING (
  public.is_dept_financeiro((SELECT auth.uid()))
  OR public.has_dept_role((SELECT auth.uid()), department_id, 'gestor')
)
WITH CHECK (
  public.is_dept_financeiro((SELECT auth.uid()))
  OR public.has_dept_role((SELECT auth.uid()), department_id, 'gestor')
);

DROP POLICY IF EXISTS dmr_delete ON public.department_member_roles;
CREATE POLICY dmr_delete ON public.department_member_roles
FOR DELETE TO authenticated
USING (
  public.is_dept_financeiro((SELECT auth.uid()))
  OR public.has_dept_role((SELECT auth.uid()), department_id, 'gestor')
);

-- =========================================================================
-- 1.6 Refator de RLS antigas em department_expenses
--     (remover match por nome de departamento)
-- =========================================================================

-- UPDATE policy: antes usava d.nome = 'Financeiro'
DROP POLICY IF EXISTS "Allow users to update department expenses" ON public.department_expenses;
CREATE POLICY "Allow users to update department expenses"
ON public.department_expenses
FOR UPDATE TO authenticated
USING (
  (created_by = (SELECT auth.uid()) AND status = 'pending')
  OR public.has_dept_role((SELECT auth.uid()), department_id, 'gestor')
  OR public.is_dept_financeiro((SELECT auth.uid()))
)
WITH CHECK (
  (created_by = (SELECT auth.uid()) AND status = 'pending')
  OR public.has_dept_role((SELECT auth.uid()), department_id, 'gestor')
  OR public.is_dept_financeiro((SELECT auth.uid()))
);

-- SELECT policy: substituir ramo responsavel_id por has_dept_role(...,'gestor')
DROP POLICY IF EXISTS dep_expenses_select_policy ON public.department_expenses;
CREATE POLICY dep_expenses_select_policy
ON public.department_expenses
FOR SELECT TO authenticated
USING (
  created_by = (SELECT auth.uid())
  OR public.has_dept_role((SELECT auth.uid()), department_id, 'gestor')
  OR public.is_dept_financeiro((SELECT auth.uid()))
  OR public.can_access_payment_queue((SELECT auth.uid()))
  OR public.is_admin_or_supervisor((SELECT auth.uid()))
  OR public.user_has_empresa_access((SELECT auth.uid()), empresa_id)
);

-- =========================================================================
-- ROLLBACK (snapshot das policies originais, para colar se precisar reverter)
-- =========================================================================
-- DROP POLICY IF EXISTS "Allow users to update department expenses" ON public.department_expenses;
-- CREATE POLICY "Allow users to update department expenses" ON public.department_expenses
-- FOR UPDATE TO authenticated USING (
--   ((created_by = (SELECT auth.uid())) AND (status = 'pending'))
--   OR EXISTS (SELECT 1 FROM departamentos d WHERE d.id = department_expenses.department_id AND d.responsavel_id = (SELECT auth.uid()))
--   OR EXISTS (SELECT 1 FROM profiles p JOIN departamentos d ON d.id = p.departamento_id WHERE p.id = (SELECT auth.uid()) AND d.nome = 'Financeiro')
-- );
--
-- DROP POLICY IF EXISTS dep_expenses_select_policy ON public.department_expenses;
-- CREATE POLICY dep_expenses_select_policy ON public.department_expenses
-- FOR SELECT TO authenticated USING (
--   created_by = (SELECT auth.uid())
--   OR EXISTS (SELECT 1 FROM departamentos d WHERE d.id = department_expenses.department_id AND d.responsavel_id = (SELECT auth.uid()))
--   OR can_access_payment_queue((SELECT auth.uid()))
--   OR is_admin_or_supervisor((SELECT auth.uid()))
--   OR user_has_empresa_access((SELECT auth.uid()), empresa_id)
-- );
